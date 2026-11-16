// The dock over the video tiles (R56.4 and its fix round R56.4b, spec 4 of the round 7 second look; Review Focus 1 and 3). Needs the production build on :5180.
//
//   node scripts/audit/make-dock-over-tiles.mjs [--only 1440x900 --tint 0.46 --contrast-only | --foot-only --out file]   writes scripts/audit/dock-over-tiles.json (the steps; --tint sets the dock glass's --dock-tint in the page)
//   node scripts/audit/make-dock-over-tiles.mjs --sweep <cases.json> --tints 0.50,0.51,... [--only size --out file]   the steps of a tint sweep over the cases a report listed (see `report`)
//   node scripts/audit/make-dock-over-tiles.mjs --refine <worst-cases.json> --out <cases.json>   the cases round the worst ones a report listed, in finer steps (to run as a sweep at one tint)
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/dock-over-tiles.json <outdir> | tee <log>
//   node scripts/audit/make-dock-over-tiles.mjs report <log> <outdir> <label> [<json>]    reads the run: prints it and records it under <label> in docs/redesign/compare/round7/r56-dock-contrast.json (or <json>);
//                                                                                          also writes <outdir>/worst-cases.json, the cases that were worst, for a sweep
//
// At 1440 by 900, 390 by 844 and 320 by 568 (the Review Focus sizes):
//  - CONTRAST (dock-over-tiles-page.mjs). The thumbnails of the set are ranked by their brightest blur-sized window (a 160 by 112 px box mean at the size of the tile, about what the
//    glass's 40 px blur reaches); the top three are put under each label and icon with their brightest window under it, and with their blurred peak (the brightest point of the
//    picture blurred as the glass blurs it) under it, which is the worst place for that tile; for the labels with the least contrast (the tabs and
//    the icons at 0.68) the brightest thumbnail is also put at a grid of nine places round its window; a real ring tile (rings visible, so its neighbours count) is put under those labels at three places; and the same with
//    every neighbour the brightest thumbnail (a bound, not a case the page can show). The page is photographed with that one label's text hidden (the glass, its tint and blur, stay)
//    and the WCAG contrast of the label's own ink over every pixel of its box is read from the picture: the worst pixel. Also measured: no tile under it (the ground) and a pure white
//    tile (the bound no picture can pass).
//  - FOOT. A real ring tile (the ring's own animation, paused at the phase nearest) is put on the dock's centre and at each of its four edges where a ring reaches; a lossless picture of
//    the page with the dock and one without it (the dock hidden) are compared outside the dock's box: no pixel may be darker with the dock than without it (spec 4's check: no box,
//    shadow or fade round the dock), and every side a ring can reach is reached by some case. Negative control: the same with the old drop shadow put back must fail.
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { page } from "./dock-over-tiles-page.mjs";
import { footPage } from "./dock-foot-page.mjs";
import { TABS, TARGETS, SIZES, WHERE, SIDES, TOP, allCases, caseLabel } from "./dock-over-tiles-targets.mjs";
import { report } from "./dock-over-tiles-report.mjs";

const target = (name) => TARGETS.find((t) => t.name === name);
const MODE_ORDER = { none: 0, white: 0, stand: 0, peak: 0, ring: 1, ringAll: 2 };

function caseSteps(size, c, tint) {
  const t = target(c.target), label = caseLabel(size, c, tint);
  const sel = JSON.stringify(t.sel);
  const place = c.mode === "none" ? `window.__place(${sel}, -2, 0, 0)`
    : c.mode === "white" ? `window.__place(${sel}, -1, 0, 0)`
    : c.mode === "stand" ? `window.__place(${sel}, ${c.ci}, ${c.fu}, ${c.fv}, 'w')`
    : c.mode === "peak" ? `window.__place(${sel}, ${c.ci}, ${c.fu}, ${c.fv}, 'p')`
    : `window.__ring(${sel}, ${c.ci}, ${c.fu}, ${c.fv}, ${c.mode === "ringAll"})`;
  return [
    { eval: place, label: `p${label.slice(1)}`, wait: c.mode.startsWith("ring") ? 160 : 100 },
    { contrast: [{ name: t.name, selector: t.sel, ink: t.ink, glass: true, text: !!t.text, clip: "[data-dock-glass]", inset: 14 }], label },
  ];
}

/** Steps for a list of cases at the current page (modes in the order that needs the fewest changes: stand-ins with the rings hidden, then real ring tiles, then the bound). */
function casesSteps(size, cases, tint) {
  const out = [];
  let rings = null;
  for (const c of [...cases].sort((a, b) => MODE_ORDER[a.mode] - MODE_ORDER[b.mode])) {
    const want = MODE_ORDER[c.mode] > 0;
    if (rings !== want) out.push({ eval: `window.__rings(${want})`, label: `rings|${want}`, wait: 100 });
    rings = want;
    out.push(...caseSteps(size, c, tint));
  }
  out.push({ eval: "window.__rings(false); window.__place('', -2, 0, 0)", label: "tile away" });
  return out;
}

function head(s, n, init) {
  return { size: s.size, dpr: s.dpr, mobile: !!s.mobile, touch: !!s.touch, ...(n === 0 ? { init } : {}) };
}

const INIT = () => page(TABS, TARGETS.filter((t) => !t.key.startsWith("tab")).map((t) => ({ name: t.key, sel: t.sel }))) + footPage;

function steps(only, tint, contrastOnly, footOnly) {
  const out = [];
  SIZES.filter((s) => !only || s.name === only).forEach((s, n) => {
    if (!footOnly) {
      out.push({ ...head(s, n, INIT()), go: "{{BASE}}/work", wait: 2800, label: `prep|${s.name}`, eval: `window.__prep(true, ${tint ?? "null"})` });
      out.push({ label: `rank|${s.name}`, eval: `window.__rank(${TOP})` });
      out.push({ label: `inks|${s.name}`, eval: "window.__inks()" });
      out.push(...casesSteps(s.name, allCases(), null));
    }
    if (contrastOnly) return;
    // the foot: the page as it is, rings visible, one real tile at a time on the dock
    // ?nogl=1: the ground is its still picture, so two photographs of an unchanged page are identical pixel for pixel
    out.push({ ...(footOnly ? head(s, n, INIT()) : {}), go: "{{BASE}}/work?nogl=1", wait: footOnly ? 6000 : 2800, label: `reload|${s.name}`, eval: `window.__prep(false, ${tint ?? "null"})` });
    out.push({ label: `reach|${s.name}`, eval: "window.__reach()" });
    for (const where of WHERE) {
      out.push({ label: `bring|${s.name}|${where}`, eval: `window.__bring("${where}")` });
      out.push({ png: `foot-${s.name}-${where}-dock` });
      if (SIDES.includes(where)) { // negative control: the old drop shadow put back must be seen
        out.push({ label: `old|${s.name}|${where}`, eval: "window.__oldShadow(true)" });
        out.push({ png: `foot-${s.name}-${where}-oldshadow` });
        out.push({ label: `new|${s.name}|${where}`, eval: "window.__oldShadow(false)" });
      }
      out.push({ label: `hide|${s.name}|${where}`, eval: "window.__dockShow(false)" });
      out.push({ png: `foot-${s.name}-${where}-nodock` });
      out.push({ label: `show|${s.name}|${where}`, eval: "window.__dockShow(true)" });
    }
    // the pictures: with generated art on the tiles (nothing from a third party: these may be committed, as docs/redesign/compare/round7/r56-4-dock-<size>-<where>-generated.jpg); the real ones are the lossless foot-*-dock.png above (they show thumbnails: keep them in compare/local/)
    out.push({ label: `fake|${s.name}`, eval: "window.__fake()", wait: 700 });
    for (const where of ["left", "centre"]) {
      out.push({ label: `bring-fake|${s.name}|${where}`, eval: `window.__bring("${where}")` });
      out.push({ shot: `dock-${s.name}-${where}-generated` });
    }
  });
  return out;
}

/** A sweep: the cases in <cases.json> ({ "<size>": [case, ...] }) at each tint. */
function sweepSteps(only, casesFile, tints) {
  const all = JSON.parse(readFileSync(casesFile, "utf8"));
  const out = [];
  SIZES.filter((s) => !only || s.name === only).forEach((s, n) => {
    out.push({ ...head(s, n, INIT()), go: "{{BASE}}/work", wait: 2800, label: `prep|${s.name}`, eval: "window.__prep(true, null)" });
    out.push({ label: `rank|${s.name}`, eval: `window.__rank(${TOP})` });
    for (const tint of tints) {
      out.push({ label: `tint|${s.name}|${tint}`, eval: `document.documentElement.style.setProperty('--dock-tint', '${tint}')` });
      out.push(...casesSteps(s.name, all[s.name] ?? [], tint));
    }
  });
  return out;
}

/** Finer places round the worst cases of each size: the same label and thumbnail, the tile moved by up to a tenth of its width and height in steps of half that. */
function refine(file) {
  const worst = JSON.parse(readFileSync(file, "utf8"));
  const out = {};
  for (const [size, list] of Object.entries(worst)) {
    const seen = new Set(), made = [];
    for (const c of list.filter((x) => x.mode !== "ringAll").slice(0, 4)) {
      for (const du of [-0.1, -0.05, 0, 0.05, 0.1]) for (const dv of [-0.1, 0, 0.1]) {
        const n = { ...c, fu: +(c.fu + du).toFixed(3), fv: +(c.fv + dv).toFixed(3) };
        const k = JSON.stringify(n);
        if (!seen.has(k)) { seen.add(k); made.push(n); }
      }
    }
    out[size] = made;
  }
  return out;
}

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv[2] === "report") await report(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
else {
  // `--only <size> --out <file>` writes the steps of one size to another file (a run of all three takes a while: it can be split)
  if (arg("--refine")) {
    writeFileSync(arg("--out"), JSON.stringify(refine(arg("--refine")), null, 1) + "\n");
    console.log(`wrote the finer cases to ${arg("--out")}`);
    process.exit(0);
  }
  const all = arg("--sweep")
    ? sweepSteps(arg("--only"), arg("--sweep"), (arg("--tints") ?? "").split(",").filter(Boolean))
    : steps(arg("--only"), arg("--tint"), process.argv.includes("--contrast-only"), process.argv.includes("--foot-only"));
  const file = arg("--out") ?? fileURLToPath(new URL("./dock-over-tiles.json", import.meta.url));
  writeFileSync(file, JSON.stringify(all, null, 1) + "\n");
  console.log(`wrote ${all.length} steps to ${file}`);
}
