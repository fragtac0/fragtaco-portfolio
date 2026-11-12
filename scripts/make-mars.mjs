#!/usr/bin/env node
// Builds the two Mars pictures of the experience map (spec 9.1, 10) from NASA Mars Trek tiles. Run with `yarn mars`.
//
//   public/mars/relief.webp   Viking MDIM 2.1 colour mosaic (level 6) for FRAME, 40 by 26 degrees, 2800 by 1820,
//                             toned grey first, then one orange multiplied over (scripts/mars-tone.mjs).
//   public/mars/heights.png   MOLA height map (level 5) for HEIGHTS, 64 by 41.6 degrees, 1000 by 650,
//                             8 bit grey, blurred by 1 px.
//
// Tiles are fetched a few at a time with a generic user agent, retried with backoff and cached in MARS_CACHE
// (default .cache/mars), so a rerun fetches nothing that is already there. The public/mars/0 to 4 pyramid of
// round 6 is left alone (Task 19 deletes it).
// Env: MARS_CACHE, MARS_QUALITY (WebP quality, default 80), MARS_LIMIT_KB (relief size limit, default 700).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { FRAME, HEIGHTS, tileRange } from "./mars-frame.mjs";
import { grey, toneLut } from "./mars-tone.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/mars");
const cacheDir = path.resolve(process.env.MARS_CACHE ?? path.join(root, ".cache/mars"));
const QUALITY = Number(process.env.MARS_QUALITY ?? 80);
const LIMIT = Number(process.env.MARS_LIMIT_KB ?? 700) * 1024;

const BASE = "https://trek.nasa.gov/tiles/Mars/EQ";
const USER_AGENT = "Mozilla/5.0 (compatible; map-tile-fetch)";
const CONCURRENCY = 4;
const ATTEMPTS = 5;
const TILE = 256;

const RELIEF = { layer: "Mars_Viking_MDIM21_ClrMosaic_global_232m", ext: "jpg", level: 6, size: [2800, 1820] };
const DEM = { layer: "Mars_MGS_MOLA_DEM_mosaic_global_463m_8", ext: "png", level: 5, size: [1000, 650] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0;

async function tile(src, row, col) {
  const file = path.join(cacheDir, src.layer, String(src.level), `${row}_${col}.${src.ext}`);
  try {
    return await readFile(file); // cached, the fetched bytes unchanged
  } catch {
    // not cached yet
  }
  const url = `${BASE}/${src.layer}/1.0.0/default/default028mm/${src.level}/${row}/${col}.${src.ext}`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status} ${type}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      if (meta.width !== TILE || meta.height !== TILE) throw new Error(`got ${meta.width}x${meta.height}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      fetched++;
      return bytes;
    } catch (err) {
      console.warn(`tile ${src.level}/${row}/${col} attempt ${attempt}/${ATTEMPTS}: ${err.message}`);
      if (attempt === ATTEMPTS) throw err;
      await sleep(1500 * 2 ** (attempt - 1));
    }
  }
}

/** The frame as one picture at the tiles' own resolution, cropped to the frame, as raw 8 bit RGB. */
async function stitch(src, frame) {
  const r = tileRange(frame, src.level);
  const nc = r.cols[1] - r.cols[0] + 1;
  const nr = r.rows[1] - r.rows[0] + 1;
  const jobs = [];
  for (let row = r.rows[0]; row <= r.rows[1]; row++) {
    for (let col = r.cols[0]; col <= r.cols[1]; col++) jobs.push({ row, col });
  }
  const parts = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const i = next++;
        const { row, col } = jobs[i];
        const input = await sharp(await tile(src, row, col)).removeAlpha().toColourspace("srgb").png().toBuffer();
        parts[i] = { input, left: (col - r.cols[0]) * TILE, top: (row - r.rows[0]) * TILE };
        await sleep(120);
      }
    }),
  );
  console.log(`${src.layer}: ${jobs.length} tiles (${nc} by ${nr}), fetched ${fetched} this run`);
  const block = await sharp({ create: { width: nc * TILE, height: nr * TILE, channels: 3, background: "#000" } })
    .composite(parts)
    .removeAlpha()
    .png()
    .toBuffer();
  const left = Math.round(r.left);
  const top = Math.round(r.top);
  const width = Math.min(Math.round(r.width), nc * TILE - left);
  const height = Math.min(Math.round(r.height), nr * TILE - top);
  return sharp(block).extract({ left, top, width, height });
}

async function relief() {
  const [w, h] = RELIEF.size;
  const { data } = await (await stitch(RELIEF, FRAME))
    .resize(w, h, { kernel: "lanczos3", fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lut = toneLut();
  const rgb = Buffer.allocUnsafe(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const g = Math.round(grey(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) * 255) * 3;
    rgb[i * 3] = lut[g];
    rgb[i * 3 + 1] = lut[g + 1];
    rgb[i * 3 + 2] = lut[g + 2];
  }
  const img = () => sharp(rgb, { raw: { width: w, height: h, channels: 3 } });
  // the highest quality (steps of 2) that fits under the size limit
  let out;
  let q = Math.max(QUALITY, 30);
  for (; q >= 30; q -= 2) {
    out = await img().webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer();
    if (out.length <= LIMIT) break;
  }
  if (out.length > LIMIT) throw new Error(`relief.webp is ${out.length} bytes at quality ${q + 2}, over the limit`);
  await writeFile(path.join(outDir, "relief.webp"), out);
  console.log(`public/mars/relief.webp ${w}x${h}, quality ${q}, ${(out.length / 1024).toFixed(0)} KiB`);
}

async function heights() {
  const [w, h] = DEM.size;
  const out = await (await stitch(DEM, HEIGHTS))
    .resize(w, h, { kernel: "lanczos3", fit: "fill" })
    .blur(1)
    .toColourspace("b-w")
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(outDir, "heights.png"), out);
  const meta = await sharp(out).metadata();
  console.log(`public/mars/heights.png ${meta.width}x${meta.height} ${meta.channels}ch ${meta.depth}, ${(out.length / 1024).toFixed(0)} KiB`);
}

await mkdir(outDir, { recursive: true });
await relief();
await heights();
