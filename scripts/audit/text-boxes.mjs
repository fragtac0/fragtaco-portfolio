// The text boxes of every page, before and after a change that could move a glyph (a font swap, a new subset, a changed axis).
//   record:  BASE=http://localhost:5180 node scripts/audit/text-boxes.mjs record <out.json> [pages=/,/#reading,...]
//   compare: node scripts/audit/text-boxes.mjs compare <before.json> <after.json>   (exit 1 on any difference)
// For each page at 1440x900, 390x844 and 320x568, with and without reduced motion, once document.fonts is ready and the page has settled:
// the box of the text in every element that holds text (headings, the dock's labels, the hero's lockup lines, the home boxes' words ...),
// and the boxes of the book-spine faces (each face, set in a span with its width axis, and measured on a canvas).
// Equal to 0.05 px (the noise of two runs of one build is 0.03 at most) means the same files, axes and subsets; anything else is a wrong family, axis, style or subset.
import { readFileSync, writeFileSync } from "node:fs";
import { launch, sleep } from "./chrome-lite.mjs";

const BASE = process.env.BASE ?? "http://localhost:5180";
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "320x568", width: 320, height: 568, mobile: true },
];
const PAGES = ["/", "/#reading", "/#watching", "/#about", "/work", "/work/long-form", "/work/short-form", "/experience"];

// The spine faces (app/components/home/reading/spine-series.ts), with the width axis of the three Archivo designs, and a label to set in each.
const SPINE_FACES = [
  ['italic 500 19px "Bodoni Moda"', null, "In the Blink of an Eye"],
  ['600 16px "Archivo"', "62%", "SCULPTING IN TIME"],
  ['900 19px "Archivo"', "125%", "MAKING MOVIES"],
  ['400 19px "Young Serif"', null, "On Film Editing"],
  ['800 46px "Bodoni Moda"', null, "STORY"],
  ['700 16px "Unbounded"', null, "Save the Cat"],
  ['400 24px "Space Grotesk"', null, "The Creative Act"],
  ['600 21px "Newsreader"', null, "Ways of Seeing"],
  ['800 19px "Archivo"', "90%", "Understanding Comics"],
  ['600 22px "Bodoni Moda"', null, "Thinking with Type"],
  ['500 14px "Archivo"', null, "Grid Systems in"],
  ['600 18px "Space Grotesk"', null, "Everyday Things"],
  ['600 20px "Newsreader"', null, "Author Name"],
  ['italic 400 20px "Newsreader"', null, "Author Name"],
  ['300 20px "Space Grotesk"', null, "Light"],
  ['300 20px "Unbounded"', null, "Light"],
  ['400 20px "Bodoni Moda"', null, "Regular"],
  ['italic 400 20px "Archivo"', null, "Italic"],
  // the interface faces, every weight and style the site asks for
  ...[400, 500, 600, 700, 800, 900].map((w) => [`${w} 20px "Doto"`, null, "Doto 2026 FragTaco"]),
  ...[400, 500, 600].map((w) => [`${w} 16px "IBM Plex Mono"`, null, "IBM Plex Mono 2026 Premiere"]),
  ...[500, 600, 700].map((w) => [`${w} 20px "Lora"`, null, "Lora and the Hamburgefonstiv"]),
  ...[400, 700].map((w) => [`${w} 16px "Space Mono"`, null, "Space Mono 2026 Hamburgefonstiv"]),
  ['italic 400 16px "Space Mono"', null, "Space Mono 2026 Hamburgefonstiv"],
  ...[500, 600, 700, 800].map((w) => [`${w} 20px "Tektur"`, null, "Tektur 2026 Hamburgefonstiv"]),
];

const PAGE_SCRIPT = `(async () => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const link = document.querySelector("link[data-spine-fonts]");
  for (let i = 0; i < 40 && link && link.media !== "all"; i++) await new Promise((r) => setTimeout(r, 100));
  await document.fonts.ready;
  const keyOf = (el) => {
    const parts = [];
    for (let e = el, n = 0; e && e !== document.body && n < 5; e = e.parentElement, n++) {
      const cls = typeof e.className === "string" ? e.className.trim().split(/\\s+/)[0] : "";
      parts.push(e.tagName.toLowerCase() + (cls ? "." + cls : "") + ":" + ([...(e.parentElement?.children ?? [])].indexOf(e)));
    }
    return parts.join("<");
  };
  const texts = {};
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "CANVAS", "SVG", "PATH"].includes(el.tagName.toUpperCase())) continue;
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!nodes.length) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || el.closest(".caption")) continue; // the hero's caption names a random painting, run to run
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) { x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    }
    if (x0 === Infinity) continue;
    let k = keyOf(el) + "|" + el.textContent.trim().slice(0, 24);
    while (k in texts) k += "+";
    texts[k] = [r2(x0), r2(y0), r2(x1 - x0), r2(y1 - y0), el.offsetWidth, el.offsetHeight, cs.fontFamily.split(",")[0].replace(/"/g, "")];
  }
  // the spine faces: a span per face (with its width axis) and the canvas's own measure
  const spine = {};
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap";
  document.body.appendChild(host);
  const cv = document.createElement("canvas").getContext("2d");
  for (const [face, stretch, label] of ${JSON.stringify(SPINE_FACES)}) {
    await document.fonts.load(face, label);
    const s = document.createElement("span");
    s.style.font = face;
    if (stretch) s.style.fontStretch = stretch;
    s.textContent = label;
    host.appendChild(s);
    const b = s.getBoundingClientRect();
    cv.font = face;
    spine[face + (stretch ? " @" + stretch : "") + " | " + label] = [r2(b.width), r2(b.height), r2(cv.measureText(label).width), document.fonts.check(face, label)];
  }
  host.remove();
  const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.weight + " " + f.style);
  return { texts, spine, loaded };
})()`;

async function record(out, pages) {
  const cases = [];
  for (const size of SIZES) {
    for (const reduce of [false, true]) {
      for (const page of pages) {
        const c = await launch({ ...size, dpr: 1 });
        try {
          await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] });
          await c.send("Page.navigate", { url: BASE + page });
          await sleep(page === "/" || page.startsWith("/#") ? 7000 : 4500);
          const v = await c.evaluate(PAGE_SCRIPT);
          cases.push({ page, size: size.name, reduce, ...v });
          console.log(`${size.name} ${reduce ? "reduced" : "normal "} ${page}: ${Object.keys(v.texts).length} text boxes, ${v.loaded.length} faces loaded`);
        } finally {
          await c.close();
        }
      }
    }
  }
  writeFileSync(out, JSON.stringify({ cases }, null, 0));
}

function compare(a, b) {
  const A = JSON.parse(readFileSync(a, "utf8")).cases;
  const B = JSON.parse(readFileSync(b, "utf8")).cases;
  let diffs = 0;
  let boxes = 0;
  for (const ca of A) {
    const cb = B.find((x) => x.page === ca.page && x.size === ca.size && x.reduce === ca.reduce);
    const tag = `${ca.size} ${ca.reduce ? "reduced" : "normal"} ${ca.page}`;
    if (!cb) {
      console.log(`MISSING ${tag}`);
      diffs++;
      continue;
    }
    for (const part of ["texts", "spine"]) {
      for (const k of new Set([...Object.keys(ca[part]), ...Object.keys(cb[part])])) {
        boxes++;
        const va = ca[part][k], vb = cb[part][k];
        // while things move (normal motion) only the sizes are compared; the places too once motion is reduced
        const same = va && vb && va.every((n, i) => (part === "texts" && !ca.reduce && i < 2) || (typeof n === "number" ? Math.abs(n - vb[i]) <= 0.05 : n === vb[i]));
        if (!same) {
          diffs++;
          if (diffs <= 60) console.log(`DIFF ${tag} ${part} ${k}: ${JSON.stringify(va)} -> ${JSON.stringify(vb)}`);
        }
      }
    }
  }
  console.log(`${boxes} boxes compared, ${diffs} differ`);
  process.exit(diffs ? 1 : 0);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "record") await record(a, b ? b.split(",") : PAGES);
else if (mode === "compare") compare(a, b);
else console.error("usage: text-boxes.mjs record <out.json> [pages] | compare <a.json> <b.json>");
