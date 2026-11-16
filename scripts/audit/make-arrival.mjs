// The frozen-frame check of a page change (R56, round 7 change-arrival spec 5.4): the arriving page is finished before it is uncovered.
//
//   BASE=http://localhost:5180 node scripts/audit/make-arrival.mjs run <outdir> [--sizes 1512x982@2,390x844@3] [--only name,name] [--json file] [--generated] [--blocked-only]
//   node scripts/audit/make-arrival.mjs steps          (writes scripts/audit/arrival.json: the review-focus steps, run with cdp.mjs; see its header in this file's STEPS)
//
// For each of the six changes (home to portfolio, portfolio to long form, to short form, to my experience, to home, and long form to portfolio) at each
// size, in a fresh headless Chrome: the change is run once to warm the pictures and the code (its numbers are kept as `cold`), then again and
// frozen at 99% of its time (F: the change's animations are paused at 99% of GLASS.ms, 2228 ms of the 2250 since R56.4, `--at`), photographed; ended (every animation finished) and photographed at
// once (E, with how many ms after the end); and photographed again 700 ms later (L). Pixels differ when their luma differs by more than 25 levels
// (the share of all pixels). The pass conditions are spec 5.4's:
//   - F against E under 0.5%;
//   - E against L under 0.5% outside the elements in resting motion (the rings, the wall's canvas: masked), and their first frame moves no
//     element by more than 2 px (the ring items are sampled every frame from the end); a coarse comparison (cells of 32 device pixels, mean luma)
//     of the masked boxes stands in for what the mask hides (a tile or ring that appears would show there): the wall's and the painting's boxes are gated on their mean, on
//     their worst 32 px cell and on the share of cells over 12 levels (one of 21 tiles that swaps or dips is diluted in the mean); the ring pictures' `data-ready` and opacity are compared;
//   - no layout-shift entry in the 2 s after the end; no element appears, disappears, changes size or swaps its picture between E and L (the DOM
//     is read at both, outside the rings and canvases); the dock's box is the same in F (the dock's view-transition group, read from its computed
//     style), E and L;
//   - from the click to the reveal's first frame: the hold (the `arrival-hold` to `arrival-go` marks of app/lib/page-change.ts) is at most 500 ms
//     (a timer's slack of 30 ms is allowed), warm, and with every picture blocked (image requests held and never answered: the cap holds, the change
//     ends, and what is late fades in).
// The script is split: the page's expressions are in arrival-page.mjs, Chrome and the held pictures in arrival-browser.mjs, the pixel and DOM comparisons in
// arrival-pixels.mjs, arrival.json's steps in make-arrival-steps.mjs.
// Timing-sensitive only in the click-to-reveal numbers: run it under the gate lock (see lanes-common.md in the build ledger). Pictures go to
// <outdir> (the work pages show YouTube thumbnails and book covers: use docs/redesign/compare/local/; `--generated` answers the thumbnail and cover hosts
// with plain generated pictures, so what is saved shows none of them and no network is used, for the pictures that may be tracked).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { arm, goAndWarm, sleep, withBrowser } from "./arrival-browser.mjs";
import { DOCK_BOX, END, FREEZE, MASK_BOXES, PLAY, REST_RESULT, RING_ANIM, SNAP } from "./arrival-page.mjs";
import { compare, domChanges, luma, sameBox } from "./arrival-pixels.mjs";
import { glassMs } from "./glass-constants.mjs";
import { writeSteps } from "./make-arrival-steps.mjs";

const argv = process.argv.slice(2);
const mode = argv[0];
if (mode === "steps") {
  writeSteps();
  process.exit(0);
}
if (mode !== "run" || !argv[1]) throw new Error("usage: make-arrival.mjs run <outdir> [--sizes WxH@dpr,...] [--only name,...] [--json file] [--generated] [--blocked-only] | make-arrival.mjs steps");
const outDir = argv[1];
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const SIZES = opt("sizes", "1512x982@2,390x844@3").split(",").map((s) => s.split(/[x@]/).map(Number));
const ONLY = opt("only", "").split(",").filter(Boolean);
const JSON_OUT = opt("json", "");
const GENERATED = argv.includes("--generated");
const FREEZE_AT = Number(opt("at", String(Math.round(glassMs() * 0.99)))); // 99% of the change (GLASS.ms read from the source: 2228 ms of the 2250 since R56.4; it was 2475 of 2500)
const BLOCKED_ONLY = argv.includes("--blocked-only");
const BASE = process.env.BASE ?? "http://localhost:5180";
mkdirSync(outDir, { recursive: true });

const HEADER = "header[data-site-nav]";
const SCENARIOS = [
  { name: "home-to-portfolio", start: "/", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/work')` },
  { name: "portfolio-to-long-form", start: "/work", link: `document.querySelector('${HEADER} [data-work-tab="/work/long-form"]')` },
  { name: "portfolio-to-short-form", start: "/work", link: `document.querySelector('${HEADER} [data-work-tab="/work/short-form"]')` },
  { name: "portfolio-to-experience", start: "/work", link: `document.querySelector('${HEADER} [data-work-tab="/experience"]')` },
  { name: "portfolio-to-home", start: "/work", link: `[...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/')` },
  { name: "long-form-to-portfolio", start: "/work/long-form", link: `[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/work' && !a.closest('header')) ?? [...document.querySelectorAll('${HEADER} a')].find((a) => a.getAttribute('href') === '/work')` },
];
const COARSE_MEAN_MAX = 1.5; // luma levels: the boxes of the wall and the painting (their pictures are the same drawn two ways) may not differ by more than this on average
const COARSE_WORST_MAX = 20; // ... no 32 px cell of them by more than this (one tile of 21 that swaps or dips is diluted 21 times in the mean, not in its own cells)
const COARSE_OVER_MAX = 2; // ... and no more than this share (percent) of their cells by more than CELL_LEVELS (arrival-pixels.mjs)
const HOLD_CAP_MS = 500;
const HOLD_SLACK_MS = 30;

// ---- one change --------------------------------------------------------------------------------------------------------------------
async function runChange(b, s, { photos, tag, blocked }) {
  await goAndWarm(b, BASE, s.start);
  if (blocked) await arm(b, { blocked: true, generated: GENERATED });
  const f = await b.ev(FREEZE(s.link, FREEZE_AT));
  if (f?.err) return { err: f };
  const holdMs = f.holdAt !== null && f.goAt !== null ? Math.round(f.goAt - f.holdAt) : null;
  const row = {
    clickToHoldMs: f.holdAt !== null ? Math.round(f.holdAt - f.clickAt) : null,
    holdMs,
    clickToRevealMs: f.goAt !== null ? Math.round(f.goAt - f.clickAt) : null,
    lateAtReveal: f.late,
    frozenAtMs: f.at,
  };
  if (!photos) {
    // the change has to end for the next run: finish it and let it settle
    await b.ev(END);
    await sleep(600);
    return row;
  }
  await sleep(150);
  const fDock = await b.ev(DOCK_BOX);
  const fAnim = await b.ev(RING_ANIM);
  const fPng = await b.shot();
  const masks = (await b.ev(MASK_BOXES)).map((m) => ({ ...m }));
  const t0 = Date.now();
  const end = await b.ev(END);
  const ePng = await b.shot();
  const endToShotMs = Date.now() - t0;
  const eDock = await b.ev(DOCK_BOX);
  const eAnim = await b.ev(RING_ANIM);
  const eSnap = await b.ev(SNAP);
  await b.ev(PLAY);
  await sleep(700);
  const lPng = await b.shot();
  if (process.env.ARRIVAL_DEBUG) console.error('L shot done');
  const lDock = await b.ev(DOCK_BOX);
  const lSnap = await b.ev(SNAP);
  const rest = await b.ev(REST_RESULT);
  await sleep(1400);
  const shifts = await b.ev(`(() => window.__ls.filter((e) => !e.input && e.t >= window.__endAt - 50 && e.t <= window.__endAt + 2000))()`);
  const [fl, el, ll] = await Promise.all([luma(fPng), luma(ePng), luma(lPng)]);
  const dpr = fl.w / (await b.ev("innerWidth"));
  const maskDev = masks.map((m) => ({ x0: Math.floor(m.x * dpr), y0: Math.floor(m.y * dpr), x1: Math.ceil((m.x + m.w) * dpr), y1: Math.ceil((m.y + m.h) * dpr) }));
  const fe = compare(fl, el, []);
  const elc = compare(el, ll, maskDev);
  // the coarse comparison gates the wall's canvas (a tile that appears shows there); the rings' own DOM is compared (pictures, items) and their drift is reported
  const wallDev = maskDev.filter((_, i) => masks[i].sel !== ".work-rings");
  const wallCoarse = wallDev.length ? compare(el, ll, wallDev) : { maskedMeanDiff: 0, maskedWorstCell: 0, maskedOverShare: 0 };
  const dom = domChanges(eSnap, lSnap);
  for (const [k, png] of [["F", fPng], ["E", ePng], ["L", lPng]]) await sharp(png).jpeg({ quality: 85 }).toFile(`${outDir}/${tag}-${k}.jpg`);
  await sharp({ create: { width: Math.round(fl.w / 3) * 3 + 20, height: Math.round(fl.h / 3), channels: 3, background: "#222" } })
    .composite(await Promise.all([fPng, ePng, lPng].map(async (png, i) => ({ input: await sharp(png).resize(Math.round(fl.w / 3)).jpeg({ quality: 80 }).toBuffer(), left: i * (Math.round(fl.w / 3) + 10), top: 0 }))))
    .jpeg({ quality: 82 })
    .toFile(`${outDir}/${tag}-FEL.jpg`);
  const dockSame = sameBox(fDock.group ?? fDock.live, eDock.live) && sameBox(eDock.live, lDock.live);
  Object.assign(row, {
    F_vs_E_pct: fe.pct,
    E_vs_L_pct: elc.pct,
    E_vs_L_outside_resting_pct: elc.pctOutside,
    resting_boxes_coarse_mean_diff: elc.maskedMeanDiff,
    wall_canvas_coarse_mean_diff: wallCoarse.maskedMeanDiff,
    resting_boxes_coarse_worst_cell: elc.maskedWorstCell,
    wall_canvas_coarse_worst_cell: wallCoarse.maskedWorstCell,
    wall_canvas_coarse_over_share_pct: wallCoarse.maskedOverShare,
    restingBoxes: masks.map((m) => m.sel),
    ringItemFirstFramePx: rest.maxFirstFramePx,
    ringItemsSampled: rest.items,
    ringDriftOver700msPx: rest.driftOver700msPx,
    layoutShifts: shifts.length,
    layoutShiftEntries: shifts,
    dock: { F: fDock.group ?? fDock.live, Flive: fDock.live, E: eDock.live, L: lDock.live, same: dockSame },
    domChanges: dom,
    endToShotMs,
    overMs: end.overMs,
    ringAnimations: { F: fAnim, E: eAnim },
    ringItemsMovedFreezeToEndPx: end.ringItemsMovedFreezeToEndPx,
  });
  const noDom = dom.appeared.length + dom.disappeared.length + dom.resized.length + dom.swapped.length === 0 && !dom.ringsSwapped && dom.ringsFaded === 0 && !dom.wallSwapped;
  row.pass = {
    F_vs_E: fe.pct < 0.5,
    E_vs_L_outside: elc.pctOutside < 0.5,
    resting_first_frame: rest.maxFirstFramePx === null || rest.maxFirstFramePx <= 2,
    layout_shift: shifts.length === 0,
    resting_coarse: wallCoarse.maskedMeanDiff < COARSE_MEAN_MAX,
    resting_coarse_cells: wallCoarse.maskedWorstCell < COARSE_WORST_MAX && wallCoarse.maskedOverShare < COARSE_OVER_MAX,
    dom_unchanged: noDom,
    dock_same: dockSame,
    hold_cap: holdMs !== null && holdMs <= HOLD_CAP_MS + HOLD_SLACK_MS,
  };
  row.ok = Object.values(row.pass).every(Boolean);
  return row;
}

// ---- the run -----------------------------------------------------------------------------------------------------------------------
const results = [];
for (const size of SIZES) {
  const label = `${size[0]}x${size[1]}@${size[2]}`;
  for (const s of SCENARIOS) {
    if (ONLY.length && !ONLY.includes(s.name)) continue;
    const tag = `r56-${label}-${s.name}`;
    const rec = { name: s.name, size: label };
    try {
      if (!BLOCKED_ONLY) {
        rec.warm = await withBrowser(size, tag, outDir, async (b) => {
          await arm(b, { blocked: false, generated: GENERATED });
          rec.first = await runChange(b, s, { photos: false, tag, blocked: false }); // the first run warms the pictures and the code
          return runChange(b, s, { photos: true, tag, blocked: false });
        });
      }
      // every picture blocked: image requests are held and never answered, nothing is cached
      rec.blocked = await withBrowser(size, `${tag}-blocked`, outDir, async (b) => {
        const row = await runChange(b, s, { photos: true, tag: `${tag}-blocked`, blocked: true });
        row.capHolds = row.holdMs !== null && row.holdMs <= HOLD_CAP_MS + HOLD_SLACK_MS;
        row.changeEnded = !row.err;
        return row;
      });
    } catch (error) {
      rec.error = String(error).slice(0, 400);
    }
    results.push(rec);
    const w = rec.warm;
    console.log(JSON.stringify({ name: s.name, size: label, ok: w?.ok, F_E: w?.F_vs_E_pct, E_L_outside: w?.E_vs_L_outside_resting_pct, shifts: w?.layoutShifts, dockSame: w?.dock?.same, holdMs: w?.holdMs, firstHoldMs: rec.first?.holdMs, blockedHoldMs: rec.blocked?.holdMs, blockedLate: rec.blocked?.lateAtReveal, fail: w ? Object.entries(w.pass ?? {}).filter(([, v]) => !v).map(([k]) => k) : undefined, error: rec.error }));
  }
}
const verdict = results.every((r) => !r.error && (BLOCKED_ONLY || r.warm?.ok) && r.blocked?.capHolds !== false && r.blocked && !r.blocked.err);
console.log(JSON.stringify({ verdict: verdict ? "PASS" : "FAIL", runs: results.length }));
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ what: "R56.2 frozen-frame check (round 7 change-arrival spec 5.4), from scripts/audit/make-arrival.mjs", date: new Date().toISOString().slice(0, 10), verdict, results }, null, 1));
