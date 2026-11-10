#!/usr/bin/env node
// Re-encodes every available hero painting (content/site/hero-paintings.json, items without
// "missing": true) from the originals in public/paintings/ into:
//   public/paintings/1600/{name}.webp   quality 72      public/paintings/1600/{file}  mozjpeg quality 70
//   public/paintings/2560/{name}.webp   quality 74      public/paintings/2560/{file}  mozjpeg quality 72
// (the longest side is 1600 or 2560, never upscaled) and writes a `blur` field back into the JSON:
// a 24 px wide JPEG at quality 40 as a data URI. Prints a size table and exits non-zero when a
// 1600 px WebP is over 320 KB, a 2560 px WebP is over 750 KB, or a blur is 2,500 characters or more.
// A WebP over its cap at the base quality is re-encoded two quality points lower at a time, but never
// below MIN_WEBP_QUALITY (60); the table notes any painting that needed it. A painting still over
// its cap at that floor fails the run (exit 1, manifest not written). The one exception is the
// explicit CAP_OVERRIDES table below (fall-of-the-giants, a fine-line engraving, 1600 px WebP cap
// 500 KB at the base quality); any other painting that breaks a cap should be looked at, not
// quietly squeezed.
// The originals are never modified. Run with `yarn paintings`.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "content/site/hero-paintings.json");
const srcDir = path.join(root, "public/paintings");

const KB = 1024;
const MAX_WEBP_1600 = 320 * KB;
const MAX_WEBP_2560 = 750 * KB;
const MAX_BLUR_CHARS = 2500;
const MIN_WEBP_QUALITY = 60;

// Per-painting WebP caps (bytes) that replace the default for one size. Each entry needs a reason.
// fall-of-the-giants is a fine-line engraving (original 1813 px wide): its 1600 px WebP is 480 KB at
// the base quality 72 and would need quality 32 to fit 320 KB, which visibly softens the hatching.
const CAP_OVERRIDES = {
  "fall-of-the-giants": { 1600: 500 * KB },
};

const VARIANTS = [
  { size: 1600, webp: 72, jpeg: 70, maxWebp: MAX_WEBP_1600 },
  { size: 2560, webp: 74, jpeg: 72, maxWebp: MAX_WEBP_2560 },
];

const kb = (bytes) => (bytes / KB).toFixed(0).padStart(5);

/** Same layout as the hand-written file: indented, one painting per line. */
function serialize(manifest) {
  const { items, ...rest } = manifest;
  const head = Object.entries(rest).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = items.map((item) => {
    const fields = Object.entries(item).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return `    { ${fields.join(", ")} }`;
  });
  return `{\n${head.join("\n")}\n  "items": [\n${rows.join(",\n")}\n  ]\n}\n`;
}

const capFor = (id, variant) => CAP_OVERRIDES[id]?.[variant.size] ?? variant.maxWebp;

/** WebP at `quality`, lowered two points at a time while it is over `maxBytes`. */
async function encodeWebp(pipeline, quality, maxBytes) {
  let q = quality;
  let buf = await pipeline().webp({ quality: q, effort: 6 }).toBuffer();
  while (buf.length > maxBytes && q - 2 >= MIN_WEBP_QUALITY) {
    q -= 2;
    buf = await pipeline().webp({ quality: q, effort: 6 }).toBuffer();
  }
  return { buf, quality: q };
}

async function encode(item) {
  const { id, file } = item;
  const input = path.join(srcDir, file);
  const name = file.replace(/\.[^./]+$/, "");
  const sizes = { original: (await stat(input)).size };
  const lowered = [];
  for (const v of VARIANTS) {
    const resized = () =>
      sharp(input).resize({ width: v.size, height: v.size, fit: "inside", withoutEnlargement: true });
    const webpPath = path.join(srcDir, String(v.size), `${name}.webp`);
    const jpegPath = path.join(srcDir, String(v.size), file);
    const { buf, quality } = await encodeWebp(resized, v.webp, capFor(id, v));
    await writeFile(webpPath, buf);
    await resized().jpeg({ quality: v.jpeg, mozjpeg: true }).toFile(jpegPath);
    sizes[`webp${v.size}`] = buf.length;
    sizes[`jpeg${v.size}`] = (await stat(jpegPath)).size;
    if (quality !== v.webp) lowered.push(`${v.size}w q${quality}`);
  }
  const blurBuf = await sharp(input).resize({ width: 24 }).jpeg({ quality: 40 }).toBuffer();
  return { sizes, lowered, blur: `data:image/jpeg;base64,${blurBuf.toString("base64")}` };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const v of VARIANTS) await mkdir(path.join(srcDir, String(v.size)), { recursive: true });

const failures = [];
const totals = { original: 0, webp1600: 0, jpeg1600: 0, webp2560: 0, jpeg2560: 0 };
console.log(
  `${"painting".padEnd(30)} ${"orig".padStart(5)} ${"1600w".padStart(5)} ${"1600j".padStart(5)} ${"2560w".padStart(5)} ${"2560j".padStart(5)} ${"blur".padStart(5)}   (KB; blur in characters)`,
);

for (const item of manifest.items) {
  if (item.missing) continue;
  const { sizes, lowered, blur } = await encode(item);
  item.blur = blur;
  for (const key of Object.keys(totals)) totals[key] += sizes[key];
  console.log(
    `${item.id.padEnd(30)} ${kb(sizes.original)} ${kb(sizes.webp1600)} ${kb(sizes.jpeg1600)} ${kb(sizes.webp2560)} ${kb(sizes.jpeg2560)} ${String(blur.length).padStart(5)}${lowered.length ? `   ${lowered.join(", ")}` : ""}`,
  );
  for (const v of VARIANTS) {
    const cap = capFor(item.id, v);
    if (sizes[`webp${v.size}`] > cap) {
      failures.push(`${item.id}: ${v.size}px WebP is ${kb(sizes[`webp${v.size}`]).trim()} KB (quality stepped down to no lower than ${MIN_WEBP_QUALITY}), over ${cap / KB} KB`);
    }
  }
  if (blur.length >= MAX_BLUR_CHARS) failures.push(`${item.id}: blur is ${blur.length} characters, over ${MAX_BLUR_CHARS - 1}`);
}

console.log(
  `${"total".padEnd(30)} ${kb(totals.original)} ${kb(totals.webp1600)} ${kb(totals.jpeg1600)} ${kb(totals.webp2560)} ${kb(totals.jpeg2560)}`,
);

if (failures.length > 0) {
  console.error(`\nover the size limits (manifest not written):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}

await writeFile(manifestPath, serialize(manifest));
console.log(`wrote blur for ${manifest.items.filter((i) => !i.missing).length} paintings to content/site/hero-paintings.json`);
