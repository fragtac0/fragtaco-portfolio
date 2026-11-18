// R58 step 6, the edge's look in pictures (plan 2026-11-17-round7-edge-look, Task 32): the page change frozen at 30, 50 and 70% of its length,
// home to the portfolio and the portfolio to My experience, at 1440 by 900, 390 by 844 and 320 by 568, and then (1440 by 900) after the
// window is resized to 1100 by 700 and the vignette and the warm-up are made again for it. A frame is the change frozen at a moment of its
// length with the debug hook, as in make-glass-frames.mjs (`__hold`, `__release`, `__jump`).
//
//   node scripts/audit/make-edge-look.mjs generated   writes edge-look-generated.json (the thumbnail and cover hosts are answered with generated pictures)
//   node scripts/audit/make-edge-look.mjs real        writes edge-look-real.json (real thumbnails; the pictures are named local-r58-... and belong in docs/redesign/compare/local/)
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/edge-look-generated.json <outdir>      (under the gate lock; a few minutes)
//
// The tracked sheet (docs/redesign/compare/round7/r58-edge-look-sheet.jpg) is made from the generated set only.
import { writeFileSync } from "node:fs";
import { GENERATED } from "./generated-png.mjs";

const mode = process.argv[2];
if (mode !== "generated" && mode !== "real") throw new Error("usage: make-edge-look.mjs generated | real");

const init = `
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rej '+String(e.reason)));
window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.__wait=(f,ms)=>new Promise(res=>{const t0=performance.now();const iv=setInterval(()=>{let v=false;try{v=f()}catch(e){}if(v||performance.now()-t0>ms){clearInterval(iv);res(!!v)}},50)});
window.__hold=(to,t)=>new Promise(res=>{__ftChange(to);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>5000){clearInterval(iv);
  // the bend is on once data-glass is written (the arrival hold on a change into My experience delays it): wait for it, at most 2 s, then read it
  const w0=performance.now(),iw=setInterval(()=>{if(document.documentElement.dataset.glass||performance.now()-w0>2000){clearInterval(iw);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(JSON.stringify({anims:document.getAnimations().length,glass:document.documentElement.dataset.glass||null}))},40)}},16)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},9000)});
window.__jump=to=>new Promise(res=>{if(location.pathname===to){res(to);return}
 __ftChange(to);const iv=setInterval(()=>{__ftFinish();if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),1500)}},40);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},12000)});
`.trim();

const prefix = mode === "real" ? "local-r58" : "r58";

const MOMENTS = [0.3, 0.5, 0.7];
const CHANGES = [
  { name: "home-to-portfolio", from: "/", to: "/work" },
  { name: "portfolio-to-experience", from: "/work", to: "/experience" },
];
const warm = (n) => ({ label: `wait for the ${n}th glass-warm mark`, eval: `__wait(()=>performance.getEntriesByName('glass-warm').length>=${n},30000)` });
const shots = (tag) =>
  CHANGES.flatMap((c) =>
    MOMENTS.flatMap((t) => {
      const name = `${prefix}-${tag}-${c.name}-${Math.round(t * 100)}`;
      return [
        { label: `${name}: to the start page`, eval: `__jump('${c.from}')` },
        { label: `${name} (t=${t})`, eval: `__hold('${c.to}',${t})` },
        { wait: 120, shot: `${name}-warm` },
        { wait: 60, shot: name },
        { label: "release", eval: "__release()" },
      ];
    }),
  );
const start = (size, dpr, mobile, first) => ({ size, dpr, mobile, touch: mobile, init, ...(first && mode === "generated" ? { intercept: GENERATED } : {}), go: "{{BASE}}/", wait: 6000 });

const steps = [
  start([1440, 900], 1, false, true),
  warm(1),
  ...shots("1440x900"),
  { label: "resize the window to 1100 by 700 (the vignette and the warm-up are made again for it)", size: [1100, 700], dpr: 1 },
  warm(2),
  ...shots("1100x700-after-resize"),
  { ...start([390, 844], 2, true, false), label: "phone 390 by 844" },
  warm(1),
  ...shots("390x844"),
  { ...start([320, 568], 2, true, false), label: "phone 320 by 568" },
  warm(1),
  ...shots("320x568"),
  { label: "errors", eval: "JSON.stringify(__errs)" },
];
writeFileSync(new URL(`./edge-look-${mode}.json`, import.meta.url), JSON.stringify(steps, null, 1) + "\n");
console.log(`edge-look-${mode}.json: ${steps.length} steps`);
