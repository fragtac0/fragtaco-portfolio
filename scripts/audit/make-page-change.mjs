// Writes scripts/audit/page-change.json: home to work and back at 1440x900, dpr 2, CPU 4x, with a
// rAF frame-gap recorder started in the page before each click and read by polling after (the
// headless page does not advance timers while idle, so the read is a setInterval inside an eval).
// The change is the one radial reveal, 2.5 s (follow-ups Task 22; 3.5 s before); it is the glass gate of round 6 (ruling R33) measured again at that length.
// A frame counts as animating once the transition's `ready` has fired; the first frame after it is the commit frame (R31: not counted).
// It also writes page-change-hook.json (five changes between home, work and experience through the debug hook, at 1440 by 900 as
// above) and page-change-phone.json (the same on a phone: 390 by 844, dpr 3, touch), the other two groups of the glass gate (Task 22).
// Each change reports `over34` (when, in ms from the click, and how long each frame over 34 ms was), `loaf` (the long-animation-frame
// entries with the scripts that ran in them) and `marks`: when the glass's pictures became ready (`vignette`, `sheets`, `bend`, `warm`; ms from
// the click, negative when they were ready before it), so a long frame can be told from the work that makes them (R54.1b).
// usage: node scripts/audit/make-page-change.mjs [cpu=4]   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/page-change.json <outdir>
import { writeFileSync } from "node:fs";

const init = `
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__ft={ready:0,fin:0};
{const o=document.startViewTransition&&document.startViewTransition.bind(document);if(o)document.startViewTransition=function(...a){const t=o(...a);window.__ft={ready:0,fin:0};t.ready.then(()=>{window.__ft.ready=performance.now()},()=>{});t.finished.then(()=>{window.__ft.fin=performance.now()},()=>{window.__ft.fin=performance.now()});return t}}
window.__loaf=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__loaf.push({s:+e.startTime.toFixed(0),d:+e.duration.toFixed(0),b:+(e.blockingDuration||0).toFixed(0),rs:+((e.renderStart||e.startTime)-e.startTime).toFixed(0),sl:+((e.styleAndLayoutStart||e.startTime)-e.startTime).toFixed(0),sc:(e.scripts||[]).map(x=>(x.invoker||'')+' '+(x.sourceFunctionName||'')+' '+(x.sourceURL||'').split('/').pop()+':'+(x.sourceCharPosition||0)+' '+x.duration.toFixed(0)+(x.forcedStyleAndLayoutDuration>5?' forced'+x.forcedStyleAndLayoutDuration.toFixed(0):'')).slice(0,8)})}).observe({type:'long-animation-frame',buffered:true})}catch(e){}
window.__rec=function(now){window.__gl={on:0,dropped:0};const r={g:[],on:true,t0:now?performance.now():0,tp:0,from:location.pathname};window.__r=r;let last=performance.now();
 const f=n=>{r.g.push([n,n-last]);last=n;if(r.on)requestAnimationFrame(f)};requestAnimationFrame(f);
 if(!now)document.addEventListener('click',()=>{r.t0=performance.now()},{capture:true,once:true});
 const ob=setInterval(()=>{if(!r.tp&&location.pathname!==r.from){r.tp=performance.now();clearInterval(ob)}},4);return 'rec'};
window.__marks=['glass-vignette-ready','glass-sheets-ready','glass-bend-ready','glass-warm'];
window.__gl={on:0,dropped:0};
{const arm=()=>new MutationObserver(()=>{const d=document.documentElement.dataset;if(d.glass==='bend')__gl.on=1;else if(__gl.on&&d.changeKind&&!__gl.dropped)__gl.dropped=1}).observe(document.documentElement,{attributes:true,attributeFilter:['data-glass','data-change-kind']});if(document.documentElement)arm();else document.addEventListener('DOMContentLoaded',arm)}
const marks=t0=>Object.fromEntries(window.__marks.map(n=>{const e=performance.getEntriesByName(n)[0];return [n.replace(/^glass-|-ready$/g,''),e?+(e.startTime-t0).toFixed(0):null]}));
window.__stop=function(){const r=window.__r;return new Promise(res=>{const w=setInterval(()=>{if(r.tp&&performance.now()-r.tp>1000&&window.__ft.fin){clearInterval(w);r.on=false;
 const gs=r.g.filter(x=>x[0]>=r.t0);const ft=window.__ft;
 const all=gs.filter(x=>ft.ready&&x[0]>ft.ready&&x[0]<=ft.fin+40);const first=all[0];const anim=all.slice(1);const pre=gs.filter(x=>x[0]<=ft.ready||!ft.ready);
 const mx=a=>a.length?+Math.max(...a.map(x=>x[1])).toFixed(1):0;
 const top=[...anim].sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>[+(x[0]-r.t0).toFixed(0),+x[1].toFixed(1)]);
 const loaf=window.__loaf.filter(e=>e.s+e.d>=r.t0).map(e=>({at:e.s-Math.round(r.t0),d:e.d,b:e.b,rs:e.rs,sl:e.sl,sc:e.sc}));
 res({from:r.from,to:location.pathname,pathAfterMs:+(r.tp-r.t0).toFixed(0),readyAfterMs:+(ft.ready-r.t0).toFixed(0),animMs:+(ft.fin-ft.ready).toFixed(0),commitFrame:first?+first[1].toFixed(1):0,animFrames:anim.length,animMax:mx(anim),animOver34:anim.filter(x=>x[1]>34).length,animOver20:anim.filter(x=>x[1]>20).length,animTop:top,over34:anim.filter(x=>x[1]>34).map(x=>[+(x[0]-r.t0).toFixed(0),+x[1].toFixed(1)]),marks:marks(r.t0),bend:{on:!!__gl.on,droppedByGuard:!!__gl.dropped,session:sessionStorage.getItem('ft-glass-bend')},preReadyMax:mx(pre),loaf})}},50);
 setTimeout(()=>{clearInterval(w);res({error:'timeout',path:location.pathname,ft:window.__ft})},15000)})};
`.trim();

const wait = (ms) => ({ wait: ms });
// R56: the bend runs only once its warm-up is done (`glass-warm`), so every group waits for that mark before its first change: a change before it runs without the bend and would pass the gate for nothing
const warmed = { label: "glass-warm", eval: "new Promise(r=>{const t=setInterval(()=>{if(performance.getEntriesByName('glass-warm').length){clearInterval(t);r(1)}},100);setTimeout(()=>{clearInterval(t);r(0)},20000)})" };
const steps = [
  { size: [1440, 900], dpr: 2, init, go: "{{BASE}}/", wait: 6000 },
  warmed,
  { cpu: Number(process.argv[2] ?? 4), wait: 4000 },
  { move: [676, 846], wait: 700 }, // hover first: the other page's code preloads on intent
  { label: "arm home to work", eval: "__rec()" },
  { click: [676, 846] }, // the work tab
  { label: "home to work", eval: "__stop()" },
  wait(4000),
  { move: [559, 846], wait: 700 },
  { label: "arm work to home", eval: "__rec()" },
  { click: [559, 846] }, // the home tab
  { label: "work to home", eval: "__stop()" },
  wait(4000),
  { move: [676, 846], wait: 700 },
  { label: "arm home to work again", eval: "__rec()" },
  { click: [676, 846] },
  { label: "home to work (2nd)", eval: "__stop()" },
  wait(4000),
  { label: "arm Back (work to home)", eval: "__rec(true)" },
  { eval: "history.back()" },
  { label: "Back, work to home", eval: "__stop()" },
  wait(4000),
  { label: "arm Forward (home to work)", eval: "__rec(true)" },
  { eval: "history.forward()" },
  { label: "Forward, home to work", eval: "__stop()" },
];
writeFileSync(new URL("./page-change.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");

// the other two groups: through the debug hook (no pointer), five changes in a row
const hook = (to) => [{ eval: "__rec(true)" }, { eval: `__ftChange('${to}')` }];
const run = (label, to) => [...hook(to), { label, eval: "__stop()" }, wait(4000)];
const group = (size, dpr, phone) => [
  { size, dpr, mobile: phone, touch: phone, init, go: "{{BASE}}/", wait: 6000 },
  warmed,
  { cpu: Number(process.argv[2] ?? 4), wait: 3000 },
  ...run("home to work", "/work"),
  ...run("work to home", "/"),
  ...run("home to experience", "/experience"),
  ...run("experience to home", "/"),
  ...run("home to work (2nd)", "/work"),
];
writeFileSync(new URL("./page-change-hook.json", import.meta.url), JSON.stringify(group([1440, 900], 2, false), null, 1) + "\n");
writeFileSync(new URL("./page-change-phone.json", import.meta.url), JSON.stringify(group([390, 844], 3, true), null, 1) + "\n");
