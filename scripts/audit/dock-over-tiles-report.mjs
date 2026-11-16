// The report of a dock-over-tiles run (R56.4, R56.4b): reads the cdp.mjs log and the foot pictures, prints the numbers and records them in r56-dock-contrast.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TARGETS, SIZES, WHERE, SIDES, MIN_CONTRAST, MAX_DARKER, NEAR_PX, parseLabel } from "./dock-over-tiles-targets.mjs";

const lines = (log) => readFileSync(log, "utf8").split("\n").filter((l) => l.startsWith("{")).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const val = (row) => { try { return JSON.parse(row.value); } catch { return row.value; } };
const GATED = ["stand", "peak", "ring"]; // what a page can show; "ringAll" (every neighbour the brightest thumbnail) is a bound, "none" and "white" are the two ends

/** Every contrast case of one size (and tint) in the log: its worst pixel, and for a real ring tile how near the ring put it. */
function casesOf(rows, size, tint) {
  const places = new Map();
  for (const r of rows) if (typeof r.step === "string" && r.step.startsWith("p|")) places.set(`c${r.step.slice(1)}`, val(r));
  const out = [];
  for (const r of rows) {
    if (typeof r.step !== "string" || !r.step.startsWith(`c|${size}|`)) continue;
    const c = parseLabel(r.step);
    if ((c.tint ?? null) !== (tint ?? null)) continue;
    const v = val(r)?.[0], p = places.get(r.step);
    if (!v) continue;
    const miss = p?.miss ?? 0;
    out.push({ ...c, worst: v.worst, p1: v.p1, mean: v.mean, miss, reachable: !(miss > NEAR_PX) && !p?.error });
  }
  return out;
}

const worstOf = (cases) => cases.length ? cases.reduce((a, b) => (b.worst < a.worst ? b : a)) : null;
const slim = (c) => ({ mode: c.mode, target: c.target, candidate: c.ci, fu: c.fu, fv: c.fv, worst: c.worst, ...(c.mode.startsWith("ring") ? { missPx: c.miss } : {}) });

function summarise(cases) {
  const usable = cases.filter((c) => c.reachable);
  const mode = (m) => worstOf(usable.filter((c) => c.mode === m));
  const gated = worstOf(usable.filter((c) => GATED.includes(c.mode)));
  const byLabel = {};
  for (const t of TARGETS) { const w = worstOf(usable.filter((c) => GATED.includes(c.mode) && c.target === t.name)); byLabel[t.name] = w ? slim(w) : null; }
  return {
    cases: cases.length, notReachable: cases.length - usable.length,
    worstContrast: { none: mode("none")?.worst ?? null, white: mode("white")?.worst ?? null, stand: mode("stand")?.worst ?? null, peak: mode("peak")?.worst ?? null, ring: mode("ring")?.worst ?? null, ringAll: mode("ringAll")?.worst ?? null },
    worstCase: gated ? slim(gated) : null,
    passes: gated ? gated.worst >= MIN_CONTRAST : false,
    passesBound: mode("ringAll") ? mode("ringAll").worst >= MIN_CONTRAST : null,
    byLabel,
    worst12: usable.filter((c) => c.mode !== "none" && c.mode !== "white").sort((a, b) => a.worst - b.worst).slice(0, 12).map(slim),
  };
}

async function footCheck(outDir, size, where, bring, picture) {
  const sharp = (await import("sharp")).default;
  const read = async (f) => sharp(`${outDir}/${f}`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = await read(`foot-${size}-${where}-${picture}.png`), b = await read(`foot-${size}-${where}-nodock.png`);
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
    bottom: tb >= bo + 2 && tt <= bo + 10 ? cover(l, r, tl, tr) : 0,
  };
  const reaches = Object.entries(edges).filter(([, c]) => c >= 0.5).map(([e]) => e);
  return { where, ring: bring.ring, pixelsOutsideDock: n, maxDarkerWithDock: +max.toFixed(2), at, pixelsDarkerBy3OrMore: over, tileReachesEdges: reaches };
}

async function footOf(rows, outDir, size) {
  const by = (prefix) => rows.filter((r) => typeof r.step === "string" && r.step.startsWith(prefix))[0];
  const reach = by(`reach|${size}`) ? val(by(`reach|${size}`)) : null;
  const cases = [], control = [];
  for (const where of WHERE) {
    const b = by(`bring|${size}|${where}`);
    if (!b || !existsSync(`${outDir}/foot-${size}-${where}-dock.png`)) continue;
    const bring = val(b);
    cases.push({ ...(await footCheck(outDir, size, where, bring, "dock")), pass: false });
    if (existsSync(`${outDir}/foot-${size}-${where}-oldshadow.png`)) control.push(await footCheck(outDir, size, where, bring, "oldshadow"));
  }
  for (const c of cases) c.pass = c.maxDarkerWithDock <= MAX_DARKER;
  const reached = SIDES.filter((s) => cases.some((c) => c.tileReachesEdges.includes(s)));
  const sides = Object.fromEntries(SIDES.map((s) => [s, reach && reach[s] < 0.5 ? `not reachable here (no ring tile covers half of the edge at any phase: best ${reach[s]})` : reached.includes(s) ? "reached" : "NOT REACHED"]));
  // the control: with the old shadow put back, every side that was reached must show a darker pixel than the limit (the check can fail)
  const controlFails = SIDES.filter((s) => reached.includes(s)).every((s) => control.some((c) => c.where === s && c.maxDarkerWithDock > MAX_DARKER));
  return {
    reach, cases, sides,
    passes: cases.length === WHERE.length && cases.every((c) => c.pass) && SIDES.every((s) => sides[s] !== "NOT REACHED"),
    negativeControl: { oldShadow: control.map((c) => ({ where: c.where, maxDarkerWithDock: c.maxDarkerWithDock, pixelsDarkerBy3OrMore: c.pixelsDarkerBy3OrMore })), fails: control.length > 0 && controlFails },
  };
}

export async function report(logFile, outDir, label, jsonFile) {
  const rows = lines(logFile);
  const by = (prefix) => rows.filter((r) => typeof r.step === "string" && r.step.startsWith(prefix));
  const sweep = rows.some((r) => typeof r.step === "string" && r.step.startsWith("c|") && parseLabel(r.step).tint != null);
  const result = { label, sweep, sizes: {} };
  const worstCases = {};
  for (const s of SIZES) {
    if (!by(`prep|${s.name}`).length && !by(`reload|${s.name}`).length) continue;
    const rank = by(`rank|${s.name}`)[0], inks = by(`inks|${s.name}`)[0];
    if (sweep) {
      const tints = [...new Set(rows.filter((r) => typeof r.step === "string" && r.step.startsWith(`c|${s.name}|`)).map((r) => parseLabel(r.step).tint))].sort((a, b) => a - b);
      worstCases[s.name] = summarise(casesOf(rows, s.name, tints[0])).worst12.map((c) => ({ mode: c.mode, target: c.target, ci: c.candidate, fu: c.fu, fv: c.fv }));
      result.sizes[s.name] = { brightestThumbnails: rank ? val(rank) : null, tints: Object.fromEntries(tints.map((t) => { const sm = summarise(casesOf(rows, s.name, t)); return [t, { worst: sm.worstCase?.worst ?? null, worstCase: sm.worstCase, worstContrast: sm.worstContrast, byLabel: Object.fromEntries(Object.entries(sm.byLabel).map(([k, v]) => [k, v?.worst ?? null])) }]; })) };
      continue;
    }
    const inkValue = inks ? val(inks) : {};
    const inkMismatch = TARGETS.filter((t) => { const got = inkValue[t.key]; return !got || got.some((x, i) => Math.abs(x - t.ink[i]) > (i < 3 ? 2 : 0.02)); }).map((t) => [t.key, t.ink, inkValue[t.key]]);
    const cases = casesOf(rows, s.name, null);
    const sm = summarise(cases);
    worstCases[s.name] = sm.worst12.map((c) => ({ mode: c.mode, target: c.target, ci: c.candidate, fu: c.fu, fv: c.fv }));
    result.sizes[s.name] = {
      brightestThumbnails: rank ? val(rank) : null,
      inksChecked: inkMismatch.length === 0 ? "every ink matches the page" : inkMismatch,
      contrast: sm,
      foot: by(`bring|${s.name}|`).length ? await footOf(rows, outDir, s.name) : null,
    };
  }
  const file = jsonFile ?? fileURLToPath(new URL("../../docs/redesign/compare/round7/r56-dock-contrast.json", import.meta.url));
  if (sweep) {
    const all = Object.values(result.sizes).map((z) => z.tints);
    const tints = Object.keys(all[0] ?? {}).map(Number).sort((a, b) => a - b);
    result.lowestPassingTint = tints.find((t) => all.every((z) => z[t] && z[t].worst >= MIN_CONTRAST)) ?? null;
  }
  writeFileSync(`${outDir}/worst-cases.json`, JSON.stringify(worstCases, null, 1) + "\n");
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  doc.method = "scripts/audit/make-dock-over-tiles.mjs (R56.4b): the thumbnails ranked by their brightest 160 by 112 px window at tile scale; the top three under each dock label and icon with that window under it, a grid of nine places round it for the labels with the least contrast, real ring tiles with their neighbours, a white tile and the bound of every neighbour the brightest; WCAG contrast of the label's own ink read from a photograph with its text hidden (worst pixel); the foot picture with and without the dock on every side a ring reaches, and the control with the old shadow";
  doc.minContrast = MIN_CONTRAST;
  doc.maxDarkerLevels = MAX_DARKER;
  doc.runs = { ...(doc.runs ?? {}), [label]: result };
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  for (const [name, r] of Object.entries(result.sizes)) {
    if (sweep) { console.log(name, Object.entries(r.tints).map(([t, v]) => `${t}:${v.worst}`).join(" ")); continue; }
    const c = r.contrast;
    console.log(name, "top", JSON.stringify(r.brightestThumbnails?.top?.map((t) => [t.id, t.windowMean])), "worst none/white/stand/peak/ring/ringAll", JSON.stringify(c.worstContrast), "gated worst", JSON.stringify(c.worstCase), "passes", c.passes, "bound", c.passesBound, "notReachable", c.notReachable, "ink", r.inksChecked === "every ink matches the page" ? "ok" : JSON.stringify(r.inksChecked));
    if (r.foot) { console.log("   foot passes", r.foot.passes, JSON.stringify(r.foot.sides), "control fails", r.foot.negativeControl.fails); for (const f of r.foot.cases) console.log("   foot", f.where, f.ring, "max darker", f.maxDarkerWithDock, "at", JSON.stringify(f.at), "over", f.pixelsDarkerBy3OrMore, "reaches", f.tileReachesEdges.join(",") || "-"); for (const f of r.foot.negativeControl.oldShadow) console.log("   old shadow", f.where, "max darker", f.maxDarkerWithDock); }
  }
  if (sweep) console.log("lowest passing tint", result.lowestPassingTint);
  console.log("recorded under", label, "in", file);
}
