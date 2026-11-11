#!/usr/bin/env node
// Builds the Olympus Mons tile pyramid in public/mars/ (spec 9.1). Run with `yarn mars`.
//
//   1. Fetches the THEMIS daytime infrared mosaic from the USGS Astrogeology WMS, centred on the summit
//      caldera. The service caps a request at 4096 px, so the 8192 px frame comes as four 4096 px blocks
//      (one request each, one at a time, a pause between, retries with backoff, generic user agent).
//      Raw blocks are cached; a rerun fetches nothing that is already there.
//   2. Grades the grey picture (level 4 after a 3 px median against sensor grain) through the orange ramp (scripts/mars-grade.mjs).
//   3. Writes level 4 (8192 px, 16 by 16 tiles) and, by downsampling that mosaic, levels 3 to 0, as 512 px
//      WebP tiles at public/mars/{z}/{x}_{y}.webp (y counted from the north), plus manifest.json.
//   4. Writes the grade check picture docs/redesign/screenshots/r40-mars-grade.jpg (level 1 beside a
//      swatch of #fc4c00).
//
// Env: MARS_CACHE (raw download folder, default .cache/mars), MARS_QUALITY (WebP quality, default 62, 13.1 MiB in all; 70 is 14.5 MiB, too close to the 16 MB budget),
// MARS_PREVIEW=<dir> (only write level 1 and 2 mosaics as JPEG into <dir>; no tiles, no manifest),
// MARS_GRADE=black,white,gamma (with MARS_PREVIEW only).
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BLOCK, BLOCKS, CENTRE, LEVELS, LON_SCALE, LON_SPAN_DEG, SIZE, SPAN_DEG, TILE, blockBox } from "./mars-frame.mjs";
import { GRADE, gradeLut } from "./mars-grade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/mars");
const cacheDir = path.resolve(process.env.MARS_CACHE ?? path.join(root, ".cache/mars"));
const shotPath = path.join(root, "docs/redesign/screenshots/r40-mars-grade.jpg");
const previewDir = process.env.MARS_PREVIEW ? path.resolve(process.env.MARS_PREVIEW) : null;
const QUALITY = Number(process.env.MARS_QUALITY ?? 62);
// Preview only: MARS_GRADE="black,white,gamma" tries another curve without touching the shipped one.
const [pb, pw, pg] = (process.env.MARS_GRADE ?? "").split(",").map(Number);
const PARAMS = previewDir && pg ? { black: pb, white: pw, gamma: pg } : GRADE;

const LAYER = "THEMIS";
const WMS = "https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map";
const USER_AGENT = "Mozilla/5.0 (compatible; map-tile-fetch)";
const PAUSE_MS = 2500;
const ATTEMPTS = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function fetchBlock(bx, by) {
  const bbox = blockBox(bx, by).map((n) => n.toFixed(6)).join(",");
  const file = path.join(cacheDir, `${LAYER}_${BLOCK}_${bx}_${by}.jpg`);
  try {
    await stat(file);
    return file;
  } catch {
    // not cached yet
  }
  const url =
    `${WMS}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${LAYER}&STYLES=&SRS=EPSG:4326` +
    `&BBOX=${bbox}&WIDTH=${BLOCK}&HEIGHT=${BLOCK}&FORMAT=image/jpeg`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      if (requests > 0) await sleep(PAUSE_MS);
      requests++;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(300_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/jpeg")) throw new Error(`HTTP ${res.status} ${type}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      if (meta.width !== BLOCK || meta.height !== BLOCK) throw new Error(`got ${meta.width}x${meta.height}`);
      await writeFile(file, bytes);
      console.log(`fetched block ${bx},${by} (${bbox}): ${(bytes.length / 1048576).toFixed(1)} MB`);
      return file;
    } catch (err) {
      const wait = 5000 * 2 ** (attempt - 1);
      console.warn(`block ${bx},${by} attempt ${attempt}/${ATTEMPTS} failed: ${err.message}`);
      if (attempt === ATTEMPTS) throw err;
      await sleep(wait);
    }
  }
}

/** The four blocks as one grey picture, SIZE by SIZE, one byte per pixel. */
async function greyMosaic() {
  await mkdir(cacheDir, { recursive: true });
  const mosaic = Buffer.alloc(SIZE * SIZE);
  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const file = await fetchBlock(bx, by);
      const data = await sharp(file).extractChannel(0).raw().toBuffer();
      for (let row = 0; row < BLOCK; row++) {
        data.copy(mosaic, (by * BLOCK + row) * SIZE + bx * BLOCK, row * BLOCK, (row + 1) * BLOCK);
      }
    }
  }
  return mosaic;
}

function grade(grey) {
  const lut = gradeLut(PARAMS);
  const rgb = Buffer.allocUnsafe(grey.length * 3);
  for (let i = 0; i < grey.length; i++) {
    const g = grey[i] * 3;
    rgb[i * 3] = lut[g];
    rgb[i * 3 + 1] = lut[g + 1];
    rgb[i * 3 + 2] = lut[g + 2];
  }
  return rgb;
}

const rawRgb = (buf, size) => sharp(buf, { raw: { width: size, height: size, channels: 3 } });

/**
 * The 0.22 to 0.78 stretch of the grade also stretches THEMIS's sensor grain, which shows at 1:1 on the
 * level 4 flanks. A 3 px median takes it out and keeps edges (the rim, the scarps) crisp; a blur would
 * soften them. Level 4 only: the lower levels are downsampled from the raw grey, which averages the grain away.
 */
function denoise(grey) {
  return sharp(grey, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .median(3)
    .extractChannel(0)
    .raw()
    .toBuffer();
}

async function levelPicture(greyFull, level) {
  const size = TILE * 2 ** level;
  if (size === SIZE) return grade(await denoise(greyFull));
  // downsample the grey, then grade: the same result and far less to colour
  const grey = await sharp(greyFull, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .resize(size, size, { kernel: "lanczos3" })
    .extractChannel(0) // sharp widens a grey raw input to three channels on output
    .raw()
    .toBuffer();
  return grade(grey);
}

async function writeChecks(greyFull, dir, withShot) {
  const l1 = await levelPicture(greyFull, 1);
  const l2 = await levelPicture(greyFull, 2);
  if (dir) {
    await mkdir(dir, { recursive: true });
    await rawRgb(l1, 1024).jpeg({ quality: 92 }).toFile(path.join(dir, "level1.jpg"));
    await rawRgb(l2, 2048).jpeg({ quality: 92 }).toFile(path.join(dir, "level2.jpg"));
  }
  if (withShot) {
    // level 1 beside a swatch of #fc4c00 (the accent), same height
    const swatch = { create: { width: 256, height: 1024, channels: 3, background: "#fc4c00" } };
    await mkdir(path.dirname(shotPath), { recursive: true });
    await sharp({ create: { width: 1024 + 24 + 256, height: 1024, channels: 3, background: "#0b0b0b" } })
      .composite([
        { input: await rawRgb(l1, 1024).png().toBuffer(), left: 0, top: 0 },
        { input: await sharp(swatch).png().toBuffer(), left: 1024 + 24, top: 0 },
      ])
      .jpeg({ quality: 90 })
      .toFile(shotPath);
  }
}

async function writeTiles(greyFull) {
  await rm(outDir, { recursive: true, force: true });
  let total = 0;
  for (let z = 0; z < LEVELS; z++) {
    const size = TILE * 2 ** z;
    const rgb = await levelPicture(greyFull, z);
    const n = 2 ** z;
    for (let y = 0; y < n; y++) {
      await mkdir(path.join(outDir, String(z)), { recursive: true });
      for (let x = 0; x < n; x++) {
        const file = path.join(outDir, String(z), `${x}_${y}.webp`);
        await rawRgb(rgb, size)
          .extract({ left: x * TILE, top: y * TILE, width: TILE, height: TILE })
          .webp({ quality: QUALITY, effort: 5, smartSubsample: true })
          .toFile(file);
      }
    }
    const count = (await readdir(path.join(outDir, String(z)))).length;
    console.log(`level ${z}: ${count} tiles`);
  }
  const manifest = {
    centre: CENTRE,
    spanDeg: SPAN_DEG,
    lonScale: LON_SCALE,
    lonSpanDeg: LON_SPAN_DEG,
    tile: TILE,
    levels: LEVELS,
    size: SIZE,
    credit: "NASA / JPL-Caltech / USGS / Arizona State University",
    sources: [
      `${WMS}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${LAYER}&SRS=EPSG:4326`,
      "https://astrogeology.usgs.gov/search/map/mars_themis_day_ir_global_mosaic_100m_v12",
    ],
    grade: GRADE,
  };
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  for (const z of await readdir(outDir)) {
    if (z === "manifest.json") continue;
    for (const f of await readdir(path.join(outDir, z))) total += (await stat(path.join(outDir, z, f))).size;
  }
  console.log(`tiles: ${(total / 1048576).toFixed(2)} MB`);
}

const greyFull = await greyMosaic();
console.log(`wms requests this run: ${requests}`);
if (previewDir) {
  await writeChecks(greyFull, previewDir, false);
  console.log(`preview written to ${previewDir}`);
} else {
  await writeTiles(greyFull);
  await writeChecks(greyFull, null, true);
}
