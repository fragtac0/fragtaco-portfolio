// The dock over the video tiles (R56.4, spec 4 of the round 7 second look; Review Focus 1 and 3). Needs the production build on :5180.
//
//   node scripts/audit/make-dock-over-tiles.mjs [--only 1440x900 --tint 0.46 --contrast-only --out file]   writes scripts/audit/dock-over-tiles.json (the steps; --tint sets the dock glass's --dock-tint in the page, for the "before" run)
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/dock-over-tiles.json <outdir> | tee <log>
//   node scripts/audit/make-dock-over-tiles.mjs report <log> <outdir> <label> [<json>]    reads the run: prints it and records it under <label> ("before", "after")
//                                                                                          in docs/redesign/compare/round7/r56-dock-contrast.json (or <json>)
//
// At 1440 by 900, 390 by 844 and 320 by 568 (the Review Focus sizes):
//  - CONTRAST. The brightest thumbnail of the set (ranked in the page by mean relative luminance, from the pictures themselves) is put under each label and icon of the
//    dock in turn, as a tile of the size the rings draw, between the rings and the dock where a turning tile passes. The page is photographed with that one label's
//    text hidden (the glass, its tint and blur, stay) and the WCAG contrast of the label's own ink over every pixel of its box is read from the picture: the worst
//    pixel and the 1st percentile. At least 4.5 to 1 (worst) for the brightest thumbnail. Also measured: no tile under it (the ground) and a pure white tile (the bound no picture can pass).
//  - FOOT. A real ring tile (the ring's own animation, paused at the phase nearest) is put on the dock's centre, left edge, right edge and top edge; a lossless picture of the page
//    with the dock and one without it (the dock hidden) are compared outside the dock's box: no pixel may be darker with the dock than without it (spec 4's check: no box,
//    shadow or fade round the dock), and the tile must reach the dock's edge on the sides the test is about.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { page } from "./dock-over-tiles-page.mjs";

const TABS = ["/work/long-form", "/work/short-form", "/experience"];
const FOG = [245, 239, 230];
const NAV = "[data-dock-glass] nav[aria-label=\"Primary\"]";
// every label and icon of the dock, with the ink it is drawn in (checked against the page by `__inks`): tabs and the idle nav link at 0.85, the open one at 1, social icons white at 0.68
const TARGETS = [
  ...TABS.map((to, i) => ({ name: ["Long form", "Short form", "My experience"][i], sel: `[data-dock-glass] a[data-work-tab="${to}"]`, ink: [...FOG, 0.85], key: `tab ${to}`, text: true })),
  { name: "home label", sel: `${NAV} a[href="/"] span`, ink: [...FOG, 0.85], key: "home label", text: true },
  { name: "home icon", sel: `${NAV} a[href="/"] svg`, ink: [...FOG, 0.85], key: "home icon" },
  { name: "work label", sel: `${NAV} a[href^="/work"] span`, ink: [...FOG, 1], key: "work label", text: true },
  { name: "work icon", sel: `${NAV} a[href^="/work"] svg`, ink: [...FOG, 1], key: "work icon" },
  ...["YouTube", "Instagram", "X", "Mail"].map((n) => ({ name: `${n} icon`, sel: `${NAV} a[aria-label="${n}"] svg`, ink: [255, 255, 255, 0.68], key: `${n} icon` })),
];
const SIZES = [
  { name: "1440x900", size: [1440, 900], dpr: 1 },
  { name: "390x844", size: [390, 844], dpr: 2, mobile: true, touch: true },
  { name: "320x568", size: [320, 568], dpr: 2, mobile: true, touch: true },
];
const WHICH = ["none", "bright", "white"];
const WHERE = ["centre", "left", "right", "top"];
const MIN_CONTRAST = 4.5;
const MAX_DARKER = 2; // levels of 255: a lossless picture of an unchanged page is identical, so this is rounding only

function steps(only, tint, contrastOnly) {
  const out = [];
  SIZES.filter((s) => !only || s.name === only).forEach((s, n) => {
    const head = { size: s.size, dpr: s.dpr, mobile: !!s.mobile, touch: !!s.touch, ...(n === 0 ? { init: page(TABS, TARGETS.filter((t) => !t.key.startsWith("tab")).map((t) => ({ name: t.key, sel: t.sel }))) } : {}) };
    out.push({ ...head, go: "{{BASE}}/work", wait: 2800, label: `prep|${s.name}`, eval: `window.__prep(true, ${tint ?? "null"})` });
    out.push({ label: `rank|${s.name}`, eval: "window.__rank()" });
    out.push({ label: `inks|${s.name}`, eval: "window.__inks()" });
    for (const which of WHICH) {
      for (const t of TARGETS) {
        out.push({ eval: `window.__under(${JSON.stringify(t.sel)}, "${which}")`, label: `under|${s.name}|${which}|${t.name}`, wait: 120 });
        out.push({ contrast: [{ name: t.name, selector: t.sel, ink: t.ink, glass: true, text: !!t.text, clip: "[data-dock-glass]", inset: 14 }], label: `c|${s.name}|${which}|${t.name}` });
      }
    }
    out.push({ eval: "window.__under('', 'none')", label: "tile away" });
    if (contrastOnly) return;
    // the foot: the page as it is, rings visible, one real tile at a time on the dock
    // ?nogl=1: the ground is its still picture, so two photographs of an unchanged page are identical pixel for pixel
    out.push({ go: "{{BASE}}/work?nogl=1", wait: 2800, label: `reload|${s.name}`, eval: `window.__prep(false, ${tint ?? "null"})` });
    for (const where of WHERE) {
      out.push({ label: `bring|${s.name}|${where}`, eval: `window.__bring("${where}")` });
      out.push({ png: `foot-${s.name}-${where}-dock` });
      out.push({ label: `hide|${s.name}|${where}`, eval: "window.__dockShow(false)" });
      out.push({ png: `foot-${s.name}-${where}-nodock` });
      out.push({ label: `show|${s.name}|${where}`, eval: "window.__dockShow(true)" });
    }
    // the pictures: with generated art on the tiles (nothing from a third party: these may be committed, as docs/redesign/compare/round7/r56-4-dock-<size>-<where>.jpg); the real ones are the lossless foot-*-dock.png above (they show thumbnails: keep them in compare/local/)
    out.push({ label: `fake|${s.name}`, eval: "window.__fake()", wait: 700 });
    for (const where of ["left", "centre"]) {
      out.push({ label: `bring-fake|${s.name}|${where}`, eval: `window.__bring("${where}")` });
      out.push({ shot: `dock-${s.name}-${where}-generated` });
    }
  });
  return out;
}

// ---------- the report ----------
const lines = (log) => readFileSync(log, "utf8").split("\n").filter((l) => l.startsWith("{")).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const val = (row) => { try { return JSON.parse(row.value); } catch { return row.value; } };

async function footCheck(outDir, size, where, bring) {
  const sharp = (await import("sharp")).default;
  const read = async (f) => { const r = await sharp(`${outDir}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return r; };
  const a = await read(`foot-${size}-${where}-dock.png`), b = await read(`foot-${size}-${where}-nodock.png`);
  const k = bring.dpr, [dl, dt, dr, db] = bring.dock.map((v, i) => (i < 2 ? Math.floor(v * k) - 1 : Math.ceil(v * k) + 1));
  const { width: w, height: h } = a.info;
  let max = 0, over = 0, at = null, n = 0;
  const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= dl && x < dr && y >= dt && y < db) continue;
    const i = (y * w + x) * 3, d = luma(b.data, i) - luma(a.data, i);
    n++;
    if (d > MAX_DARKER) over++;
    if (d > max) { max = d; at = [Math.round(x / k), Math.round(y / k)]; }
  }
  // the tile reaches the dock's edge on a side when it is on the strip 2 to 10 px outside it (css px) along that side, over at least half of the shorter of the tile's own extent and the side's
  const [l, t, r, bo] = bring.dock, [tl, tt, tr, tb] = bring.tile, cover = (lo, hi, a0, a1) => Math.max(0, Math.min(hi, a1) - Math.max(lo, a0)) / Math.min(hi - lo, a1 - a0);
  const edges = {
    left: tl <= l - 2 && tr >= l - 10 ? cover(t, bo, tt, tb) : 0,
    right: tr >= r + 2 && tl <= r + 10 ? cover(t, bo, tt, tb) : 0,
    top: tt <= t - 2 && tb >= t - 10 ? cover(l, r, tl, tr) : 0,
  };
  const reaches = Object.entries(edges).filter(([, c]) => c >= 0.5).map(([e]) => e);
  return { where, ring: bring.ring, pixelsOutsideDock: n, maxDarkerWithDock: +max.toFixed(2), at, pixelsDarkerBy3OrMore: over, tileReachesEdges: reaches, pass: max <= MAX_DARKER };
}

async function report(logFile, outDir, label, jsonFile) {
  const rows = lines(logFile);
  const by = (prefix) => rows.filter((r) => typeof r.step === "string" && r.step.startsWith(prefix));
  const result = { label, sizes: {} };
  for (const s of SIZES) {
    const rank = by(`rank|${s.name}`)[0], inks = by(`inks|${s.name}`)[0];
    const contrast = {};
    for (const which of WHICH) {
      contrast[which] = {};
      for (const t of TARGETS) {
        const row = by(`c|${s.name}|${which}|${t.name}`)[0];
        const v = row ? val(row)?.[0] : null;
        contrast[which][t.name] = v ? { worst: v.worst, p1: v.p1, mean: v.mean, brightestBgLuminance: v.brightestBg } : null;
      }
    }
    const worstOf = (which) => Math.min(...Object.values(contrast[which]).map((v) => v?.worst ?? 0));
    const foot = [];
    for (const where of WHERE) {
      const b = by(`bring|${s.name}|${where}`)[0];
      if (b && existsSync(`${outDir}/foot-${s.name}-${where}-dock.png`)) foot.push(await footCheck(outDir, s.name, where, val(b)));
    }
    const inkValue = inks ? val(inks) : {};
    const inkMismatch = TARGETS.filter((t) => { const got = inkValue[t.key]; return !got || got.some((x, i) => Math.abs(x - t.ink[i]) > (i < 3 ? 2 : 0.02)); }).map((t) => [t.key, t.ink, inkValue[t.key]]);
    result.sizes[s.name] = {
      brightestThumbnail: rank ? val(rank) : null,
      inksChecked: inkMismatch.length === 0 ? "every ink matches the page" : inkMismatch,
      contrast,
      worstContrast: { none: worstOf("none"), bright: worstOf("bright"), white: worstOf("white") },
      passesBrightest: worstOf("bright") >= MIN_CONTRAST,
      foot,
      footPasses: foot.length === WHERE.length && foot.every((f) => f.pass),
    };
  }
  const file = jsonFile ?? fileURLToPath(new URL("../../docs/redesign/compare/round7/r56-dock-contrast.json", import.meta.url));
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  doc.method = "scripts/audit/make-dock-over-tiles.mjs: the brightest thumbnail of the set under each dock label and icon, WCAG contrast of the label's own ink read from a photograph with its text hidden; the foot picture with and without the dock";
  doc.minContrast = MIN_CONTRAST;
  doc.maxDarkerLevels = MAX_DARKER;
  doc.runs = { ...(doc.runs ?? {}), [label]: result };
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  for (const [name, r] of Object.entries(result.sizes)) {
    console.log(name, "brightest", JSON.stringify(r.brightestThumbnail?.brightest), "worst contrast none/bright/white", JSON.stringify(r.worstContrast), "passes", r.passesBrightest, "foot", r.footPasses, "ink", r.inksChecked === "every ink matches the page" ? "ok" : JSON.stringify(r.inksChecked));
    for (const f of r.foot) console.log("   foot", f.where, f.ring, "max darker", f.maxDarkerWithDock, "at", JSON.stringify(f.at), "over", f.pixelsDarkerBy3OrMore, "tile reaches", f.tileReachesEdges.join(",") || "-");
  }
  console.log("recorded under", label, "in", file);
}

if (process.argv[2] === "report") await report(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
else {
  // `--only <size> --out <file>` writes the steps of one size to another file (a run of all three takes about 9 minutes: it can be split)
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const all = steps(arg("--only"), arg("--tint"), process.argv.includes("--contrast-only"));
  const file = arg("--out") ?? fileURLToPath(new URL("./dock-over-tiles.json", import.meta.url));
  writeFileSync(file, JSON.stringify(all, null, 1) + "\n");
  console.log(`wrote ${all.length} steps to ${file}`);
}
