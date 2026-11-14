// The pieces the box-open audit's generators share (R55.2): the two boxes, the two sizes, how a page is loaded and how a box is brought on screen.
// make-box-open.mjs (the open and close films, the cases that turn and resize, the move's cost) and box-open-focus.mjs (a click before the scene is
// ready, the tab in the background, the open scene across it, the wall's pan at the end of the move, reduced motion) both push into `steps`.
import { HELPERS } from "./box-open-helpers.mjs";

export const wait = (ms) => `new Promise(r=>setTimeout(r,${ms}))`;
export const BOX = {
  shelf: { id: "blkRead", kind: "reading", hit: "reading" },
  wall: { id: "blkWatch", kind: "watching", hit: "watching" },
};
export const OPEN_ATS = [380, 420, 500, 560, 620, 680, 740, 800, 880, 960, 1100, 1500];
export const sizes = [
  { name: "1440x900", size: [1440, 900], dpr: 1, mobile: false, touch: false },
  { name: "390x844", size: [390, 844], dpr: 2, mobile: true, touch: true },
];
// the helpers above are installed on every new document (they guard themselves), and a stall hook an earlier case set is cleared by the next load
export const INIT = `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.removeItem('ft:debug-stall')}catch(e){}`;
export const load = (s, extra = {}) => ({
  size: s.size,
  dpr: s.dpr,
  mobile: s.mobile,
  touch: s.touch,
  reduce: false,
  cpu: 1,
  init: `${INIT};${HELPERS}`,
  go: "{{BASE}}/",
  wait: 4500,
  ...extra,
});
// scrolls to the block and waits (up to 20 s) for its scene to have drawn into the box; the answer is how long that took
export const toBlock = (b, label) => ({
  eval: `new Promise(r=>{document.getElementById('${b.id}').scrollIntoView({block:'center',behavior:'instant'});const t0=performance.now(),i=setInterval(()=>{const sc=document.querySelector('.box-scene[data-kind=${b.kind}]');if(sc.hasAttribute('data-drawn')||sc.hasAttribute('data-plain')||performance.now()-t0>20000){clearInterval(i);setTimeout(()=>r(JSON.stringify({drawnAfterMs:Math.round(performance.now()-t0),drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain')})),600)}},50)})`,
  label,
});

export const steps = [];
export const push = (...s) => steps.push(...s);
