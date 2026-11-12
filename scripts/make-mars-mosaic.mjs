#!/usr/bin/env node
// Stitches level 2 of the Olympus Mons tile pyramid (public/mars/2/, 4 by 4 tiles of 512 px) into one picture,
// public/mars/mosaic.webp (2048 px across). The map page shows it where there is no canvas or the visitor asked
// for less data (spec 9.6); the map itself never loads it. Run after `yarn mars`: node scripts/make-mars-mosaic.mjs
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/mars");
const LEVEL = 2;
const TILE = 512;
const COUNT = 2 ** LEVEL;
const QUALITY = Number(process.env.MARS_QUALITY ?? 62);

const composite = [];
for (let y = 0; y < COUNT; y++) {
  for (let x = 0; x < COUNT; x++) {
    composite.push({ input: path.join(dir, String(LEVEL), `${x}_${y}.webp`), left: x * TILE, top: y * TILE });
  }
}
const out = await sharp({ create: { width: COUNT * TILE, height: COUNT * TILE, channels: 3, background: "#000" } })
  .composite(composite)
  .webp({ quality: QUALITY })
  .toBuffer();
await writeFile(path.join(dir, "mosaic.webp"), out);
console.log(`public/mars/mosaic.webp ${COUNT * TILE} px, ${(out.length / 1024).toFixed(0)} KiB`);
