// R58 step 7: the numbers of tile-swaps.json (make-tile-swaps.mjs), from the cdp.mjs output of the bend runs and of the control runs.
//   node scripts/audit/sum-tile-swaps.mjs <bend-output.txt> [<control-output.txt>] [--out record.json]
// A film frame's change is the mean absolute difference (grey levels) to the frame before it, taken per 16.7 ms of film time (the screencast
// can be a frame late). At each swap (a write of the map picture's source, not the first, which is where the bend starts) the frame is the first
// one at or after the swap's time since the click; `ratio` is that frame's change over the mean of the two frames' beside it (floored at 0.2),
// `window` the largest of that ratio over the frame and the one each side (the film's clock and the page's can be a frame apart), and `excess`
// the frame's change less its neighbours' mean, in grey levels (how big the step is, not how big it is against the change round it).
// The control is the same change with no bend (no swaps of the bend: the edge's mask, glow and shade tiles still change): its ratio and excess at the
// same times since the click say how much of a swap's ratio belongs to the change itself.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args[outAt + 1] : null;
const files = args.filter((a, i) => !a.startsWith("--") && (outAt < 0 || i !== outAt + 1));
const runsOf = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.startsWith('{"step":"swaps'))
    .map((l) => JSON.parse(JSON.parse(l).value));

const FLOOR = 0.2;
const dn = (frames, i) => (frames[i][1] == null ? null : (frames[i][1] * 16.67) / Math.max(8, frames[i][0] - frames[i - 1][0]));
const at = (frames, i) => {
  if (i < 2 || i > frames.length - 2) return null;
  const [a, b, c] = [dn(frames, i - 1), dn(frames, i), dn(frames, i + 1)];
  if (a == null || b == null || c == null) return null;
  const n = (a + c) / 2;
  return { ratio: b / Math.max(FLOOR, n), excess: b - n, change: b };
};
const frameAfter = (frames, ms) => {
  const i = frames.findIndex((f) => f[0] >= ms);
  return i < 0 ? frames.length - 1 : i;
};
function swapRows(run, ctl) {
  return run.swaps.slice(1).map((s) => {
    const i = frameAfter(run.frames, s.sinceClickMs);
    const win = [i - 1, i, i + 1].map((j) => at(run.frames, j)).filter(Boolean);
    const here = at(run.frames, i);
    const row = {
      tile: s.tile,
      front: s.front,
      sinceClickMs: s.sinceClickMs,
      bend: s.bend,
      change: +(here?.change ?? 0).toFixed(2),
      ratio: +(here?.ratio ?? 0).toFixed(2),
      window: +Math.max(...win.map((w) => w.ratio)).toFixed(2),
      excess: +(here?.excess ?? 0).toFixed(2),
    };
    if (ctl) {
      const j = frameAfter(ctl.frames, s.sinceClickMs);
      const c = at(ctl.frames, j);
      row.control = { change: +(c?.change ?? 0).toFixed(2), ratio: +(c?.ratio ?? 0).toFixed(2), excess: +(c?.excess ?? 0).toFixed(2) };
    }
    return row;
  });
}
const bend = runsOf(files[0]);
const control = files[1] ? runsOf(files[1]) : [];
const runs = bend.map((run, k) => {
  const rows = swapRows(run, control[k]);
  const seen = rows.filter((r) => r.bend > 0.05);
  return {
    run: k + 1,
    frames: run.frames.length,
    longestFrameGapMs: Math.max(...run.frames.slice(1).map((f, i) => f[0] - run.frames[i][0])),
    swaps: rows,
    worstRatio: Math.max(...seen.map((r) => r.ratio)),
    worstWindow: Math.max(...seen.map((r) => r.window)),
    worstExcess: Math.max(...seen.map((r) => r.excess)),
    over1_5: seen.filter((r) => r.ratio > 1.5).map((r) => ({ tile: r.tile, front: r.front, ratio: r.ratio, excess: r.excess, change: r.change, controlRatio: r.control?.ratio })),
  };
});
const record = { what: "R58 step 7: mean absolute difference of a film frame to the frame before it at each tile swap of the bend, against its neighbours (see sum-tile-swaps.mjs)", target: "ratio at most 1.5 at every swap", runs };
console.log(JSON.stringify({ worstRatioByRun: runs.map((r) => r.worstRatio), worstExcessByRun: runs.map((r) => r.worstExcess), over1_5ByRun: runs.map((r) => r.over1_5.length) }));
for (const r of runs) console.log(`run ${r.run}: ` + r.swaps.map((s) => `${s.tile}@${s.front}:${s.ratio}/${s.excess}${s.control ? `(c ${s.control.ratio}/${s.control.excess})` : ""}`).join(" "));
if (out) writeFileSync(out, JSON.stringify(record, null, 1) + "\n");
