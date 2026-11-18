// Reads the output of `cdp.mjs home-scroll.json` (one or more text files of JSON lines) and applies the gate of make-home-scroll.mjs (R33, R67, R72, RB8).
// Run: node scripts/audit/sum-home-scroll.mjs <out.txt>... [--base <out.txt>...]
// Prints one line per pass (frames, max, over 20 and 34 ms, the frames over 34 ms with [ms into the pass, gap, scrollY], outside a painting change's window and inside
// it, the draw calls of the two scenes with their box on screen and off it, whether both scenes are live), then per profile:
//   - warm: frames over 34 ms outside a change's window in the slow and fast passes and the holds (gate: none);
//   - cold (R72): the runs whose cold pass has a frame over 34 ms outside a change's window (gate: at most one run of the profile: an outlier that repeats is a cost);
//   - the painting change (RB8): per hold, the frames inside the change windows: worst, how many over 34 ms. With `--base`, the same from the base build's files, side
//     by side: for R55 the change with a box on screen must be no worse than the base (the head's worst no more than the base's, the head's count of frames over 34 ms
//     no more than the base's; both are printed, the judgement is the reader's).
// Exit code 1 when a gate (warm, cold) fails; the change comparison is reported, not gated.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const headFiles = bi < 0 ? args : args.slice(0, bi);
const baseFiles = bi < 0 ? [] : args.slice(bi + 1);
if (headFiles.length === 0) {
  console.error("usage: node scripts/audit/sum-home-scroll.mjs <out.txt>... [--base <out.txt>...]");
  process.exit(2);
}

const PASS = /^(\S+) run (\d+) (cold|slow|fast|change, box on screen|change, no box)\b/;

/** Every pass and hold in the files: { profile, run, kind, part, v }. */
function read(files) {
  const rows = [];
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line.startsWith("{")) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      const v = o.value;
      const m = typeof o.step === "string" ? PASS.exec(o.step) : null;
      if (!m || !v || typeof v !== "object" || !("over34" in v)) continue;
      rows.push({ profile: m[1], run: Number(m[2]), kind: m[3], part: v.label, v });
    }
  }
  return rows;
}

const at = (a) => (a?.length ? JSON.stringify(a) : "");
const fmt = (r) => {
  const v = r.v;
  const d = v.draws ? `draws shelf ${v.draws.shelf.on}/${v.draws.shelf.off} wall ${v.draws.wall.on}/${v.draws.wall.off}` : "";
  const sc = (v.scenes ?? []).length ? (v.scenes.every((s) => s.drawn && s.canvas && !s.plain) ? "scenes live" : "SCENES NOT LIVE") : "no scenes";
  return `${r.profile} run ${r.run} ${r.kind.padEnd(21)} ${(r.part === r.kind ? "" : r.part).padEnd(14)} n ${String(v.n).padStart(4)} max ${String(v.max).padStart(5)} >20 ${String(v.over20).padStart(2)} >34 ${v.over34} outside ${v.over34OutsideSwap ?? "-"} ${at(v.over34OutsideSwapAt ?? v.over34At)} inside ${v.swapOver34 ?? "-"} (worst ${v.swapMax ?? "-"}) | ${d} | ${sc}`;
};

const head = read(headFiles);
const base = read(baseFiles);
for (const r of head) console.log(fmt(r));

let failed = false;
const profiles = [...new Set(head.map((r) => r.profile))];
for (const p of profiles) {
  const rows = head.filter((r) => r.profile === p);
  const warm = rows.filter((r) => r.kind === "slow" || r.kind === "fast" || r.kind.startsWith("change"));
  const warmBad = warm.filter((r) => (r.v.over34OutsideSwap ?? r.v.over34) > 0);
  const cold = rows.filter((r) => r.kind === "cold");
  const coldRuns = [...new Set(cold.map((r) => r.run))];
  const coldBad = coldRuns.filter((n) => cold.filter((r) => r.run === n).some((r) => (r.v.over34OutsideSwap ?? r.v.over34) > 0));
  const notLive = rows.filter((r) => (r.v.scenes ?? []).some((s) => !s.drawn || !s.canvas || s.plain) && r.v.scenes.length);
  const warmOk = warmBad.length === 0;
  const coldOk = coldBad.length <= 1;
  if (!warmOk || !coldOk) failed = true;
  console.log(`\n${p}: warm passes and holds, frames over 34 ms outside a change's window: ${warmOk ? "none (PASS)" : "FAIL " + warmBad.map((r) => `run ${r.run} ${r.kind} ${r.part} ${at(r.v.over34OutsideSwapAt)}`).join("; ")}`);
  console.log(
    `${p}: cold passes (R72), runs with a frame over 34 ms outside a change's window: ${coldBad.length} of ${coldRuns.length}${coldBad.length ? " (run " + coldBad.join(", ") + ")" : ""} -> ${coldOk ? "PASS (an outlier that does not repeat)" : "FAIL (it repeats: a cost, not an outlier)"}`,
  );
  for (const n of coldRuns) {
    const rs = cold.filter((r) => r.run === n);
    console.log(`  cold run ${n}: ${rs.map((r) => `${r.part}: max ${r.v.max}, >34 outside ${r.v.over34OutsideSwap ?? r.v.over34} ${at(r.v.over34OutsideSwapAt ?? r.v.over34At)}`).join(" | ")}`);
  }
  if (notLive.length) {
    failed = true;
    console.log(`${p}: SCENES NOT LIVE in ${notLive.length} passes`);
  }
}

// the hero's painting change (RB8)
function change(rows, profile, kind) {
  const hs = rows.filter((r) => r.profile === profile && r.kind === kind);
  return {
    runs: hs.length,
    worst: Math.max(0, ...hs.map((r) => r.v.swapMax ?? 0)),
    over34: hs.reduce((n, r) => n + (r.v.swapOver34 ?? 0), 0),
    over20: hs.reduce((n, r) => n + (r.v.swapOver20 ?? 0), 0),
    frames: hs.reduce((n, r) => n + (r.v.swapFrames ?? 0), 0),
    perRun: hs.map((r) => `${r.v.swapMax}/${r.v.swapOver34}`).join(" "),
  };
}
const holdProfiles = [...new Set(head.filter((r) => r.kind.startsWith("change")).map((r) => r.profile))];
if (holdProfiles.length) console.log("\nThe hero's painting change (frames within 0.5 s before to 3.3 s after a change's start; per run: worst ms/frames over 34 ms):");
for (const p of holdProfiles) {
  for (const kind of ["change, box on screen", "change, no box"]) {
    const h = change(head, p, kind);
    const line = `${p} ${kind.padEnd(21)} head: ${h.runs} runs, ${h.frames} frames, worst ${h.worst} ms, over 34 ms ${h.over34}, over 20 ms ${h.over20} (${h.perRun})`;
    if (!baseFiles.length) {
      console.log(line);
      continue;
    }
    const b = change(base, p, kind);
    const verdict = h.worst <= b.worst && h.over34 <= b.over34 ? "no worse than the base" : "WORSE than the base";
    console.log(`${line}\n${" ".repeat(p.length + 1)}${kind.padEnd(21)} base: ${b.runs} runs, ${b.frames} frames, worst ${b.worst} ms, over 34 ms ${b.over34}, over 20 ms ${b.over20} (${b.perRun}) -> ${verdict}`);
  }
}

process.exit(failed ? 1 : 0);
