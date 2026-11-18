// Writes scripts/audit/wall-edges.json (R52.3): the home video wall's edges and the headings, on the production build.
// For each size: the heading's title and count and the Close pill with the text hidden over the real frame behind them (the WCAG
// contrast of their ink over every pixel; `contrast` in cdp.mjs), at rest (a picture in every screen corner) and after the view is pulled up and left, then right, down and left (each leaves part of the block off screen),
// then the open video's own round close; and a picture of each corner and of the heading (`local-` names: they show thumbnails,
// keep them under docs/redesign/compare/local/). Run: node scripts/audit/make-wall-edges.mjs
import { writeFileSync } from "node:fs";

const CREAM = [253, 252, 230];
const ink = a => [...CREAM, a];
const heading = [
  { name: "title (ink 92%)", selector: ".home-layer .xp-head .display", ink: ink(0.92) },
  { name: "count (ink 62%, the quietest)", selector: ".home-layer .xp-head .xp-meta", ink: ink(0.62) },
  { name: "Close word (ink 92%, over its glass)", selector: ".home-layer .xp-close", ink: ink(0.92), glass: true },
  { name: "Esc key chip (ink 72%, over its glass)", selector: ".home-layer .xp-close kbd", ink: ink(0.72), glass: true },
];
const steps = [];
const wait = ms => `new Promise(r=>setTimeout(r,${ms}))`;
const sizes = [
  { name: "1440x900", size: [1440, 900], dpr: 2 },
  { name: "1024x768", size: [1024, 768], dpr: 1 },
  { name: "390x844", size: [390, 844], dpr: 3, mobile: true, touch: true },
];
for (const s of sizes) {
  const touch = !!s.touch;
  steps.push({ go: "about:blank", wait: 300 });
  steps.push({ size: s.size, dpr: s.dpr, mobile: !!s.mobile, touch, reduce: false, cpu: 1, go: "{{BASE}}/#watching", wait: 5000, eval: `({canvas:!!document.querySelector('.wall-host canvas'),head:!!document.querySelector('.xp-head')})`, label: `${s.name}: the wall is up` });
  const corners = [
    ["rest", null],
    ["pulled-up-left", touch ? { drag: [60, 120, 340, 800, 12], n: 4 } : { wheel: [s.size[0] / 2, s.size[1] / 2, -2000, -2000, 28] }],
    ["then-pulled-right", touch ? { drag: [330, 120, 50, 800, 12], n: 4 } : { wheel: [s.size[0] / 2, s.size[1] / 2, 4000, 0, 14] }],
    ["then-pulled-down", touch ? { drag: [330, 780, 50, 80, 12], n: 4 } : { wheel: [s.size[0] / 2, s.size[1] / 2, 0, 4000, 14] }],
    ["then-pulled-left", touch ? { drag: [50, 780, 340, 120, 12], n: 4 } : { wheel: [s.size[0] / 2, s.size[1] / 2, -4000, 0, 14] }],
  ];
  for (const [name, move] of corners) {
    if (move) {
      const reps = move.n ?? 1;
      for (let i = 0; i < reps; i++) steps.push(move.drag ? { drag: move.drag, wait: 150 } : { wheel: move.wheel });
    }
    steps.push({ eval: wait(1800), label: "settle" });
    steps.push({ shot: `local-edges-${s.name}-${name}-warm` });
    steps.push({ contrast: touch ? heading.filter(h => !h.selector.endsWith("kbd")) : heading, label: `${s.name} ${name}: contrast of the heading and the Close pill over the picture behind them` });
    steps.push({ shot: `local-edges-${s.name}-${name}` });
  }
  // an open video's round close, in the same glass
  steps.push({ eval: `(()=>{window.scrollTo(0,0);return 1})()` });
  steps.push(touch ? { tap: [s.size[0] / 2, s.size[1] / 2], wait: 1300 } : { click: [s.size[0] / 2, s.size[1] / 2], wait: 1300 });
  steps.push({ eval: `({open:getComputedStyle(document.querySelector('.vov')).display, x:!!document.querySelector('.vov .x')})`, label: `${s.name}: a video open` });
  steps.push({ contrast: [{ name: "round close (x, ink 92%, over its glass)", selector: ".home-layer .vov .x", ink: ink(0.92), glass: true }], label: `${s.name}: the open video's round close` });
  steps.push({ shot: `local-edges-${s.name}-open` });
}
writeFileSync(new URL("./wall-edges.json", import.meta.url), JSON.stringify(steps.map(x => JSON.parse(JSON.stringify(x))), null, 1) + "\n");
console.log(steps.length, "steps");
