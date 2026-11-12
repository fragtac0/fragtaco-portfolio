// Writes scripts/audit/rings.json: the checks of the work page's rings (Task 8, R43.2). Needs the production build on :5180.
// usage: node scripts/audit/make-rings.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/rings.json <outdir>
//
// Per size (the Review Focus ones, 320 by 568 to 2560 by 1440):
//  - waits for every ring to mount, finishes the arrival animation (read first: delays, length, start scale),
//  - freezes the rings at 40 sampled phases (each ring and its items' turn-back set to the same random share of
//    its period, paused) and reads the gap between every pair of item boxes (`.work-item-turn`, upright): the
//    smallest gap over all pairs and phases, and how many pairs touch or overlap (both must be 12 or more / 0),
//  - checks the intro (title and its lines of text) sits inside the stack ring's icons.
// Pictures (1440 by 900, 1920 by 1080, 820 by 1180, 390 by 844) at three ring phases each. The pictures come from picsum at run time;
// where it cannot be reached the audit paints neutral, generated gradients on the tiles (a number and a corner
// mark show they are upright) so the geometry can still be seen: nothing from a third party is drawn.
// The two order modes are photographed from two builds (RING_ORDER_MODE is a constant), see the task report.
import { writeFileSync } from "node:fs";

const init = `
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
// every ring and its items' turn-back to one random share of the ring's period, paused
window.__phase=(seed)=>{let s=seed>>>0;const rnd=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
 document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 for(const ul of document.querySelectorAll('.work-ring')){const f=rnd();
  for(const a of ul.getAnimations({subtree:true})){if(a.animationName!=='work-spin'&&a.animationName!=='work-unspin')continue;
   a.pause();a.currentTime=f*a.effect.getTiming().duration}}return seed};
// the smallest gap between two item boxes (negative: they overlap) at the current phase
window.__gap=()=>{const b=[...document.querySelectorAll('.work-item-turn')].map(e=>{const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,id:e.parentElement.dataset.id}});
 let min=Infinity,pair='',touching=0;
 for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){const a=b[i],c=b[j];
  const g=Math.max(a.l-c.r,c.l-a.r,a.t-c.b,c.t-a.b);if(g<min){min=g;pair=a.id+' / '+c.id}if(g<11.99)touching++}
 return{n:b.length,min,pair,touching}};
window.__sweep=(k)=>{let min=Infinity,pair='',touching=0,n=0;
 for(let i=1;i<=k;i++){window.__phase(i*7919);const g=window.__gap();n=g.n;touching+=g.touching;if(g.min<min){min=g.min;pair=g.pair}}
 return{items:n,phases:k,minGap:+min.toFixed(2),worst:pair,pairsUnder12:touching}};
// frame gaps over ms: how many frames, the average, the 95th percentile, the worst and how many were over 20 ms
window.__frames=(ms)=>new Promise(r=>{const g=[];let l=performance.now();const t0=l;function f(n){g.push(n-l);l=n;if(n-t0<ms)requestAnimationFrame(f);else{g.shift();g.sort((a,b)=>a-b);
 r(JSON.stringify({frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+g[Math.floor(g.length*.95)].toFixed(2),max:+g[g.length-1].toFixed(2),over20:g.filter(x=>x>20).length}))}}requestAnimationFrame(f)});
// every ring back to the start of its turn, still running, and where its first item then is
window.__start=(sel)=>{document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 for(const a of document.getAnimations())if(a.animationName==='work-spin'||a.animationName==='work-unspin')a.currentTime=0;
 const r=document.querySelector(sel).getBoundingClientRect();return JSON.stringify([Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)])};
// wait for every ring of the plan to be mounted (one per frame after the page change)
window.__ready=(want)=>new Promise(res=>{const t0=performance.now();const w=setInterval(()=>{
 const n=document.querySelectorAll('.work-ring').length;
 if((n>=want&&document.querySelectorAll('.work-item').length>0)||performance.now()-t0>6000){clearInterval(w);res(n)}},30)});
// the arrival of the rings as the page sets it: a recorder from the start of the page notes each ring group's
// animation the first frame it is seen (delay, length and where it starts) and when that was
window.__arr=[];(function(){const t0=performance.now();const f=()=>{
 for(const g of document.querySelectorAll('.work-ring-group')){if(g.__seen)continue;const a=g.getAnimations().find(x=>x.animationName==='work-ring-in');
  if(a){g.__seen=1;const t=a.effect.getTiming();window.__arr.push({ring:g.dataset.ring,delay:t.delay,duration:t.duration,from:a.effect.getKeyframes()[0].scale,seenAtMs:Math.round(performance.now()-t0)})}}
 if(performance.now()-t0<3500)requestAnimationFrame(f)};requestAnimationFrame(f)})();
window.__arrival=()=>JSON.stringify(window.__arr);
// the intro inside the stack ring: the least room between its text and the stack icons, in px
window.__intro=()=>{const cx=innerWidth/2,cy=innerHeight/2;const ul=document.querySelector('.work-ring[data-ring-id="stack"]');
 const R=parseFloat(ul.style.getPropertyValue('--r'));const icon=ul.querySelector('.work-item-turn').getBoundingClientRect().width;
 let far=0;const rects=[];for(const el of document.querySelectorAll('.work-title,.work-text-full,.work-text-short')){
  if(getComputedStyle(el).display==='none')continue;const r=document.createRange();r.selectNodeContents(el);rects.push(...r.getClientRects())}
 for(const r of rects)for(const x of [r.left,r.right])for(const y of [r.top,r.bottom])far=Math.max(far,Math.hypot(x-cx,y-cy));
 return{stackRadius:+R.toFixed(1),icon,textReach:+far.toFixed(1),roomToIcons:+(R-icon/2-far).toFixed(1)}};
// neutral generated pictures (no third party) when the real ones cannot be loaded
window.__fake=()=>{let i=0;for(const img of document.querySelectorAll('.work-cover img')){i++;const tall=img.closest('.work-item').dataset.ring==='short';
 const W=tall?360:640,H=tall?640:360,hue=(i*47)%360;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+hue+',45%,38%)"/><stop offset="1" stop-color="hsl('+((hue+60)%360)+',50%,22%)"/></linearGradient></defs><rect width="'+W+'" height="'+H+'" fill="url(#g)"/><path d="M0 0H90L0 90Z" fill="rgba(255,255,255,.35)"/><text x="'+W/2+'" y="'+(H/2+30)+'" font-family="monospace" font-size="'+Math.round(H*.22)+'" text-anchor="middle" fill="rgba(255,255,255,.85)">'+i+'</text></svg>';
 img.src='data:image/svg+xml;utf8,'+encodeURIComponent(svg)}return i};
`.trim();

const SIZES = [
  { name: "1440x900", size: [1440, 900], dpr: 1, rings: 5, pictures: true },
  { name: "1920x1080", size: [1920, 1080], dpr: 1, rings: 5, pictures: true },
  { name: "820x1180", size: [820, 1180], dpr: 1, rings: 4, pictures: true, mobile: true, touch: true },
  { name: "390x844", size: [390, 844], dpr: 2, rings: 3, pictures: true, mobile: true, touch: true },
  { name: "375x667", size: [375, 667], dpr: 2, rings: 2, pictures: true, mobile: true, touch: true },
  { name: "568x320", size: [568, 320], dpr: 2, rings: 1, pictures: true, mobile: true, touch: true },
  { name: "320x568", size: [320, 568], dpr: 2, rings: 2, pictures: true, mobile: true, touch: true },
  { name: "1024x768", size: [1024, 768], dpr: 1, rings: 4 },
  { name: "2560x1440", size: [2560, 1440], dpr: 1, rings: 5 },
];

// where the first long-1 and stack items sit at the start of a turn at 1440 by 900 (read by the step before them)
const HOVER = { long1: [805, 103], stack: [720, 234] };
const steps = [];
let first = true;
for (const s of SIZES) {
  const head = { size: s.size, dpr: s.dpr, ...(s.mobile ? { mobile: true } : { mobile: false }), touch: !!s.touch };
  if (first) head.init = init;
  steps.push({ ...head, go: "{{BASE}}/work", wait: 1500, label: `${s.name} arrival (a ring per frame, delay 60 ms apart, 500 ms, from 96%)`, eval: "window.__arrival()" });
  first = false;
  steps.push({ label: `${s.name} rings mounted`, eval: `window.__ready(${s.rings})` });
  steps.push({ label: `${s.name} overlap at 40 phases`, eval: "window.__sweep(40)" });
  steps.push({ label: `${s.name} intro inside the stack ring`, eval: "window.__intro()" });
  if (s.pictures) {
    steps.push({ label: `${s.name} generated pictures on tiles`, eval: "window.__fake()", wait: 600 });
    [1, 2, 3].forEach((p) => {
      steps.push({ eval: `window.__phase(${p * 104729})`, wait: 300 });
      steps.push({ shot: `warm-${s.name}-p${p}` });
      steps.push({ shot: `rings-${s.name}-p${p}` });
    });
  }
}

// behaviour: hover pauses one ring, a stack icon is no tab stop and does nothing, reduced motion is still
steps.push({ size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/work", wait: 1500, eval: "window.__ready(5)", label: "ready for behaviour" });
steps.push({
  label: "stack icons: names, no tab stop, no link",
  eval: `JSON.stringify({n:document.querySelectorAll('.work-item[data-kind=stack]').length,
    names:[...document.querySelectorAll('.work-item[data-kind=stack] img')].map(i=>i.alt),
    imgs:document.querySelectorAll('.work-item[data-kind=stack] img').length,
    focusable:document.querySelectorAll('.work-item[data-kind=stack] a,.work-item[data-kind=stack] button,.work-item[data-kind=stack] [tabindex]').length,
    bare:[...document.querySelectorAll('.work-item[data-kind=stack] img[data-bare]')].map(i=>i.alt),
    tileRadius:getComputedStyle(document.querySelector('.work-item[data-kind=stack] .work-mark')).borderRadius})`,
});
// every ring back to the start of its turn and running, so the slots are where the layout puts them (slot 0 at the top)
steps.push({
  label: "back to the start of the turn (running): where the first long-1 and stack items are",
  eval: `(()=>{document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
    for(const a of document.getAnimations())if(a.animationName==='work-spin'||a.animationName==='work-unspin')a.currentTime=0
    const c=s=>{const r=document.querySelector(s).getBoundingClientRect();return[Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]};
    return JSON.stringify({long1:c('.work-ring[data-ring-id="long-1"] .work-item-turn'),stack:c('.work-ring[data-ring-id="stack"] .work-item-turn')})})()`,
});
const state = `JSON.stringify(Object.fromEntries([...document.querySelectorAll('.work-ring')].map(u=>[u.dataset.ringId,u.getAnimations().find(a=>a.animationName==='work-spin').playState])))`;
steps.push({ label: "no hover: every ring running", eval: state });
steps.push({ move: HOVER.long1, wait: 150 });
steps.push({ label: "pointer on a long-1 video: only long-1 paused", eval: state });
steps.push({ move: [5, 5], wait: 150 });
steps.push({ label: "pointer away: all running again", eval: state });
steps.push({ move: HOVER.stack, wait: 150 });
steps.push({
  label: "pointer on a stack icon: the stack ring paused, the icon does not grow",
  eval: `JSON.stringify({rings:${state.replace(/`/g, "'")},scale:getComputedStyle(document.querySelector('.work-item:hover .work-item-face')).scale,hovered:document.querySelector('.work-item:hover').dataset.kind})`,
});
steps.push({ move: [5, 5] });
// Frame timing, CPU 4 times slower, after the arrival: at rest, then with the pointer on a ring item (that ring paused).
// The hover points are the first long-1 item at the start of a turn (read by the step before each).
const FRAME_RUNS = [
  { name: "1440x900 dpr 2", size: [1440, 900], dpr: 2, mobile: false, touch: false, hover: [806, 103] },
  { name: "390x844 dpr 3", size: [390, 844], dpr: 3, mobile: true, touch: true, hover: [266, 135] },
];
for (const f of FRAME_RUNS) {
  steps.push({ size: f.size, dpr: f.dpr, mobile: f.mobile, touch: f.touch, cpu: 4, go: "{{BASE}}/work", wait: 3000, eval: "window.__ready(" + (f.mobile ? 3 : 5) + ")", label: `frames ${f.name}: ready` });
  steps.push({ wait: 1200, label: `frames ${f.name} at rest, 4 s`, eval: "window.__frames(4000)" });
  steps.push({ label: `frames ${f.name}: first long-1 item at the start of the turn`, eval: `window.__start('.work-ring[data-ring-id="long-1"] .work-item-turn')` });
  steps.push({ move: f.hover, wait: 200 });
  steps.push({ label: `frames ${f.name} with the pointer on a ring item, 4 s`, eval: `window.__frames(4000)` });
  steps.push({ label: `frames ${f.name}: a ring is paused (hover took)`, eval: `JSON.stringify(document.querySelectorAll('.work-item:hover').length)` });
  steps.push({ move: [5, 5], cpu: 1 });
}

steps.push({ reduce: true, size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/work", wait: 1500, eval: "window.__ready(5)", label: "reduced motion: ready" });
steps.push({
  label: "reduced motion: no ring or item is turning",
  eval: `JSON.stringify({turning:document.getAnimations().filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin').length,
    groupAnim:[...new Set([...document.querySelectorAll('.work-ring-group')].map(g=>getComputedStyle(g).animationName))]})`,
});
steps.push({ reduce: false });

writeFileSync(new URL("./rings.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");

// One picture at 1440 by 900 of whichever order mode the running build ships (RING_ORDER_MODE): build with the mode set,
// run this, and copy rings-mode.jpg to docs/redesign/screenshots/r43-rings-<mode>.jpg
const mode = [
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, init, go: "{{BASE}}/work", wait: 1500, eval: "window.__ready(5)", label: "ready" },
  { eval: "window.__fake()", wait: 600, label: "generated pictures on tiles" },
  { eval: "window.__sweep(40)", label: "overlap at 40 phases" },
  { eval: "window.__phase(104729)", wait: 300 },
  { shot: "warm-rings-mode" },
  { shot: "rings-mode" },
];
writeFileSync(new URL("./rings-mode.json", import.meta.url), JSON.stringify(mode, null, 1) + "\n");
console.log(`wrote ${steps.length} steps and ${mode.length}`);
