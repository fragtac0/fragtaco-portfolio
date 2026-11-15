// Writes scripts/audit/home-scroll.json (R55.3, Task 26): the cost of two live home boxes, on the production build.
// Run: node scripts/audit/make-home-scroll.mjs [--only <profile>] [--out <file>]
//   then BASE=http://localhost:5181 node scripts/audit/cdp.mjs scripts/audit/home-scroll.json <outdir outside the repo>.
// Run it inside the gate lock (the 34 ms gates are timing sensitive). With `--only` and `--out` it writes one profile to a file of its own so a run stays short.
//
// Three profiles, each loaded three times (a "run"); a run is one fresh load of the home page:
//   desktop-cpu1      1440 by 900, dpr 1, CPU as it is
//   desktop-cpu4      1440 by 900, dpr 2, CPU 4 times slower (the profile of the page-change gates)
//   phone-cpu4        390 by 844, dpr 2, touch, CPU 4 times slower
// A pass is a real scroll gesture (the compositor scrolls, as for a visitor; `gesture` in cdp.mjs) from the hero down to the end of the page, past both
// boxes, a hold at the bottom with both boxes on screen, and back to the top. Every animation frame gap is read in the page (`window.__hs`, from the document
// start). In a run:
//   - `cold`: the first pass after the load, slow, while the scenes are being made (the cold-start frames of R67 and R72 are recorded here, openly);
//   - `slow`, `slow`: two warm passes at 400 px a second (phone 700), both boxes live (docked, drawn);
//   - `fast`, `fast`: two warm passes at 2000 px a second (phone 2400);
//   - `change, box on screen`: the page held where the lower part of the hero's painting and the top 150 px of a box are both on screen, for 24 s (two
//     painting changes of the hero, 2.8 s each, ten seconds apart): the frame gaps in the first 3.3 s of each change and over the whole hold;
//   - `change, no box`: the same with the page near the top (no box near the screen), for the same time, as the hero's own cost.
// A painting change of the hero starts on its own clock (every ten seconds) and can land inside any pass: `swap*` read the frames within 0.5 s before to 3.3 s after
// a change's start (the caption changes as it starts), `*OutsideSwap` the frames outside every such window (the scroll's own cost). The hero's own change is measured at its own
// holds, with a box on screen and with none.
// The gate (R33, R67, R72): no frame over 34 ms in the warm passes and the holds beyond the cold-start frames; the cold pass is recorded, and counts when its outliers repeat in the warm ones.

import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const outFile = args.includes("--out") ? args[args.indexOf("--out") + 1] : new URL("./home-scroll.json", import.meta.url).pathname;

// The recorder, in every document from its start: each animation frame's time, gap and scroll position; the hero's caption (it changes when a painting change starts).
const RECORDER = `try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){};(()=>{
  if (window.__hs) return;
  let g = [], on = false, last = 0, k = 0, txt = null; const changes = [];
  const f = (n) => {
    if (on && last) g.push([n, n - last, scrollY]);
    last = n;
    if (++k % 6 === 0) { const t = document.querySelector('#hero .caption .t'); const s = t ? t.textContent : null; if (txt !== null && s !== txt) changes.push(n); txt = s; }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
  const r1 = (v) => Math.round(v * 10) / 10;
  window.__hs = {
    start() { g = []; changes.length = 0; on = true; last = 0; return 'started'; },
    stop(label) {
      on = false;
      const t0 = g.length ? g[0][0] : 0, gaps = g.map((x) => x[1]), s = [...gaps].sort((a, b) => a - b);
      const slow = (lim) => g.filter((x) => x[1] > lim).slice(0, 12).map((x) => [Math.round(x[0] - t0), r1(x[1]), Math.round(x[2])]);
      const ch = changes.map((c) => Math.round(c - t0));
      const inSwap = g.filter((x) => ch.some((c) => x[0] - t0 >= c - 500 && x[0] - t0 <= c + 3300));
      const sw = inSwap.map((x) => x[1]);
      const out = g.filter((x) => !inSwap.includes(x)).map((x) => x[1]);
      const scenes = [...document.querySelectorAll('.box-scene')].map((e) => ({ kind: e.dataset.kind, drawn: e.hasAttribute('data-drawn'), plain: e.hasAttribute('data-plain'), canvas: !!e.querySelector('canvas') }));
      return { label, n: g.length, ms: Math.round(g.length ? g[g.length - 1][0] - t0 : 0), avg: r1(gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)), p99: r1(s[Math.floor(s.length * 0.99)] || 0), max: r1(s[s.length - 1] || 0), over20: gaps.filter((x) => x > 20).length, over34: gaps.filter((x) => x > 34).length, over34At: slow(34), changesAtMs: ch, swapFrames: sw.length, swapMax: r1(Math.max(0, ...sw)), swapOver20: sw.filter((x) => x > 20).length, swapOver34: sw.filter((x) => x > 34).length, maxOutsideSwap: r1(Math.max(0, ...out)), over34OutsideSwap: out.filter((x) => x > 34).length, scenes };
    },
  };
})();`;

const PROFILES = [
  { name: "desktop-cpu1", size: [1440, 900], dpr: 1, mobile: false, touch: false, cpu: 1, source: "mouse", slow: 400, fast: 2000 },
  { name: "desktop-cpu4", size: [1440, 900], dpr: 2, mobile: false, touch: false, cpu: 4, source: "mouse", slow: 400, fast: 2000 },
  { name: "phone-cpu4", size: [390, 844], dpr: 2, mobile: true, touch: true, cpu: 4, source: "touch", slow: 700, fast: 2400 },
];
const RUNS = Number(process.env.RUNS ?? 3);
const FROM = Number(process.env.RUN_FROM ?? 1); // the run numbers start here (a long file is cut into several runs of cdp.mjs inside the gate lock)
const HOLD_MS = 24000;
const SHOW_PX = 150;

// the way down (to the end of the page) and the way back (to the top): one gesture with a mouse, short swipes with a finger (a swipe cannot be longer than the screen)
const toEnd = (p, speed) => {
  if (p.source === "mouse")
    return [{ gesture: `(()=>[innerWidth/2,innerHeight/2,document.documentElement.scrollHeight-innerHeight-scrollY,${speed},'mouse'])()` }];
  return Array.from({ length: 8 }, () => ({
    gesture: `(()=>[innerWidth/2,innerHeight*0.8,Math.max(1,Math.min(innerHeight*0.6,document.documentElement.scrollHeight-innerHeight-scrollY)),${speed},'touch'])()`,
  }));
};
const toTop = (p, speed) => {
  if (p.source === "mouse") return [{ gesture: `(()=>[innerWidth/2,innerHeight/2,-scrollY,${speed},'mouse'])()` }];
  return Array.from({ length: 8 }, () => ({
    gesture: `(()=>[innerWidth/2,innerHeight*0.2,-Math.max(1,Math.min(innerHeight*0.6,scrollY)),${speed},'touch'])()`,
  }));
};

const pass = (p, run, kind, speed) => [
  { eval: "__hs.start()", label: `${p.name} run ${run} ${kind}: start` },
  ...toEnd(p, speed),
  { wait: 1500 },
  { eval: "__hs.stop('down and hold')", label: `${p.name} run ${run} ${kind}: down, with both boxes on screen at the end` },
  { eval: "__hs.start()", label: `${p.name} run ${run} ${kind}: start back` },
  ...toTop(p, speed),
  { wait: 1000 },
  { eval: "__hs.stop('back up')", label: `${p.name} run ${run} ${kind}: back to the hero` },
];

const hold = (p, run, kind, y) => [
  { eval: y, label: `${p.name} run ${run} ${kind}: where the page is held` },
  { wait: 1200 },
  { eval: "__hs.start()", label: `${p.name} run ${run} ${kind}: start` },
  { wait: HOLD_MS },
  { eval: `Object.assign(__hs.stop('${kind}'), {heroBottom: Math.round(document.querySelector('#hero').getBoundingClientRect().bottom), boxTop: Math.round(document.querySelector('.blk-box').getBoundingClientRect().top)})`, label: `${p.name} run ${run} ${kind}` },
];

const steps = [];
for (const p of PROFILES) {
  if (only && p.name !== only) continue;
  for (let run = FROM; run < FROM + RUNS; run++) {
    const first = run === FROM;
    steps.push({
      ...(first ? { size: p.size, dpr: p.dpr, mobile: p.mobile, touch: p.touch, reduce: false, nocache: true, cpu: p.cpu, init: RECORDER } : {}),
      go: first ? "{{BASE}}/" : "about:blank",
      wait: first ? 9000 : 500,
    });
    if (!first) steps.push({ go: "{{BASE}}/", wait: 9000 });
    steps.push({ eval: "({run:" + run + ",profile:'" + p.name + "',scrollHeight:document.documentElement.scrollHeight,boxes:[...document.querySelectorAll('.blk-box')].map(e=>{const r=e.getBoundingClientRect();return [r.left|0,(r.top+scrollY)|0,r.width|0,r.height|0]}),hero:document.querySelector('#hero').offsetHeight})", label: `${p.name} run ${run}: the page` });
    steps.push(...pass(p, run, "cold", p.slow));
    steps.push({ wait: 1500 });
    steps.push(...pass(p, run, "slow", p.slow));
    steps.push(...pass(p, run, "slow", p.slow));
    steps.push(...pass(p, run, "fast", p.fast));
    steps.push(...pass(p, run, "fast", p.fast));
    steps.push(
      ...hold(p, run, "change, box on screen", `(()=>{const b=document.querySelector('.blk-box').getBoundingClientRect();const y=Math.round(scrollY+b.top-(innerHeight-${SHOW_PX}));scrollTo({top:y,behavior:'instant'});return {y}})()`),
    );
    steps.push(...hold(p, run, "change, no box", `(()=>{scrollTo({top:60,behavior:'instant'});return {y:scrollY}})()`));
  }
}
writeFileSync(outFile, JSON.stringify(steps, null, 1) + "\n");
console.log(`${outFile}: ${steps.length} steps`);
