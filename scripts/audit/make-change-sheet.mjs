// Sets the build's page change beside the tenth preview's (follow-ups Task 22, "check by eye"): one sheet, a row for each of 20, 35, 50, 65 and
// 80% of the change's length, the build in the left column and the preview in the right. Two runs first (see make-glass-frames.mjs):
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/change-beside-build.json <dir>/build
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/change-beside-preview.json <dir>/preview     (needs docs/redesign on 127.0.0.1:5190)
// then: node scripts/audit/make-change-sheet.mjs <dir> [cellWidth]    and    BASE=http://localhost:5180 node scripts/audit/cdp.mjs <dir>/sheet.json <dir>/sheets
// which writes <dir>/sheets/r54-change-beside-preview.jpg. The preview's frames are whole screencast frames: each is cropped to the stage's box.
import { readdirSync, writeFileSync } from "node:fs";

const [dir, width = "640"] = process.argv.slice(2);
if (!dir) throw new Error("usage: make-change-sheet.mjs <dir> [cellWidth]");
const cw = Number(width);
const TIMES = [20, 35, 50, 65, 80];
const preview = readdirSync(`${dir}/preview`)
  .filter((f) => /^beside-preview-\d+\.jpg$/.test(f))
  .sort((a, b) => parseInt(a.split("-")[2]) - parseInt(b.split("-")[2]));
if (preview.length !== TIMES.length) throw new Error(`expected ${TIMES.length} preview frames in ${dir}/preview, found ${preview.length}`);
// the stage's box in the page (1440 by 900, the preview's layout): left 208, top 191, 1024 by 640
const STAGE = { x: 208, y: 191, w: 1024, h: 640 };
const ch = Math.round((cw * STAGE.h) / STAGE.w);
const k = cw / STAGE.w;
const cell = (label, inner) => `<div style='position:relative;width:${cw}px;height:${ch}px;overflow:hidden;background:#000'>${inner}<span style='position:absolute;left:4px;top:2px;background:#000a;padding:1px 4px'>${label}</span></div>`;
const build = (i) => cell(`build ${TIMES[i]}%`, `<img src='file://${dir}/build/beside-build-0${i}.jpg' style='width:${cw}px;height:${ch}px;object-fit:cover;display:block'>`);
const prev = (i) =>
  cell(
    `preview ${TIMES[i]}%`,
    `<img src='file://${dir}/preview/${preview[i]}' style='position:absolute;width:${1440 * k}px;height:${900 * k}px;left:${-STAGE.x * k}px;top:${-STAGE.y * k}px'>`,
  );
const html = `<body style='margin:0;background:#222;display:grid;grid-template-columns:repeat(2,${cw}px);gap:4px;font:11px monospace;color:#fff'>${TIMES.map((_, i) => build(i) + prev(i)).join("")}</body>`;
writeFileSync(`${dir}/sheet.html`, html);
writeFileSync(
  `${dir}/sheet.json`,
  JSON.stringify([{ size: [2 * cw + 4, TIMES.length * (ch + 4)], go: `file://${dir}/sheet.html`, wait: 900, shot: "r54-change-beside-preview" }]),
);
console.log(`${dir}/sheet.json`);
