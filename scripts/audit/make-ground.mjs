// Writes scripts/audit/ground.json: the checks of the Eclipse ground (round 7, Task 7, spec 5.1) on the production build.
//   usage: node scripts/audit/make-ground.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/ground.json <outdir>
// The stills in public/grounds/ are made by `node scripts/audit/make-eclipse-stills.mjs` (from the shader itself).
// What it reads, with the draws of the ground's own canvas counted by wrapping drawArrays (`__draws`, so the shelf's and the wall's
// three.js canvases are not counted):
//   1 mount, the lazy chunk, the canvas against the CSS size at dpr 1, 2 and 3, ground draws a second (about 30), and the stills' sizes
//   2 frame gaps with the rings turning at dpr 2 and CPU 4 times slower, with the ground running and with the loop stopped (a faked hidden tab)
//   3 the loop stops: hidden tab, a page change (a placement change draws once at the commit), an open layer on the home page, the section off screen
//   4 a picture of each placement with the page's own content hidden (tracked: no thumbnails), phone sizes too, and the stills alone
//   5 the pause shows no pop and no black (a grid sample before and after), a lost context leaves the still, a resize draws again
//   6 reduced motion, no WebGL (?nogl=1) and save-data (no chunk, no canvas, the still), and /experience (no ground)
// `init` (the helpers) is added once, in the first step: every later one would wrap `drawArrays` again and double the counts.
// Shots named `local-` show thumbnails or covers: keep them under docs/redesign/compare/local/.
import { writeFileSync } from "node:fs";

const init = `
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rej '+String(e.reason)));
window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
// draws of the ground's own canvas
window.__draws=0;{const d=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(){if(this.canvas&&this.canvas.classList&&this.canvas.classList.contains('eclipse-canvas'))window.__draws++;return d.apply(this,arguments)}}
window.__t0=performance.now();
window.__ground=()=>{const h=document.querySelector('.eclipse'),c=h&&h.querySelector('canvas');const on=h&&h.querySelector('.eclipse-still[data-on=true] img');
 return JSON.stringify({host:!!h,scope:h&&h.dataset.scope,live:h&&h.dataset.live,canvas:!!c,backing:c&&[c.width,c.height],css:c&&[c.clientWidth,c.clientHeight],screen:[innerWidth,innerHeight],dpr:devicePixelRatio,
  stills:h?h.querySelectorAll('.eclipse-still').length:0,stillSrc:on&&on.currentSrc.replace(/^https?:\\/\\/[^/]+/,''),stillLoaded:on&&on.complete&&on.naturalWidth>0})};
window.__waitGround=async(ms)=>{const t=performance.now();while(performance.now()-t<(ms||12000)&&!document.querySelector('.eclipse[data-live=true]'))await __sleep(25);await __sleep(150);return Math.round(performance.now()-window.__t0)};
window.__drawsOver=(ms)=>new Promise(res=>{const a=window.__draws;setTimeout(()=>res(JSON.stringify({ms,draws:window.__draws-a})),ms)});
window.__frames=(ms)=>new Promise(r=>{const g=[];let l=performance.now();const t0=l;function f(n){g.push(n-l);l=n;if(n-t0<ms)requestAnimationFrame(f);else{g.shift();g.sort((a,b)=>a-b);
 r(JSON.stringify({frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+g[Math.floor(g.length*.95)].toFixed(2),max:+g[g.length-1].toFixed(2),over20:g.filter(x=>x>20).length}))}}requestAnimationFrame(f)});
window.__fakeHidden=(h)=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'));return h};
window.__bare=(on)=>{for(const s of ['.work-stage','[data-row-open]','.wall-page','.below','header','.hero-lockup','.home-hero > *:not(.tex)']){document.querySelectorAll(s).forEach(e=>e.style.visibility=on?'hidden':'')}return on};
window.__fake=()=>{let i=0;for(const img of document.querySelectorAll('.work-cover img')){i++;const tall=img.closest('.work-item').dataset.ring==='short';
 const W=tall?360:640,H=tall?640:360,hue=(i*47)%360;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><rect width="'+W+'" height="'+H+'" fill="hsl('+hue+',40%,30%)"/></svg>';
 img.src='data:image/svg+xml;utf8,'+encodeURIComponent(svg)}return i};
window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
// a change to a page, counting the ground's draws while it runs (data-change-kind is on <html>) and for 1.5 s after
window.__changeDraws=(to)=>new Promise(res=>{const a=window.__draws;let during=0,started=false,over=false;const t0=performance.now();
 const before=window.__draws;__ftChange(to);
 const iv=setInterval(()=>{const k=document.documentElement.dataset.changeKind;if(k){started=true}
  if(started&&!k&&!over){over=true;during=window.__draws-before;const mark=window.__draws;setTimeout(()=>{clearInterval(iv);res(JSON.stringify({to,path:location.pathname,drawsDuringChange:during,drawsAfter1500ms:window.__draws-mark,changeMs:Math.round(performance.now()-t0)}))},1500)}
  if(performance.now()-t0>9000){clearInterval(iv);res('timeout '+location.pathname)}},20)});
window.__jump=to=>new Promise(res=>{if(location.pathname===to){res(to);return}
 __ftChange(to);const iv=setInterval(()=>{__ftFinish();if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),1500)}},40);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},12000)});
window.__hold=(to,t)=>new Promise(res=>{__ftChange(to);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>5000){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(window.__draws)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},9000)});
`.trim();

const base = (size, dpr = 1, extra = {}) => ({ size, dpr, mobile: !!extra.mobile, touch: !!extra.mobile, reduce: false, nocache: true, ...extra });
const ev = (label, eval_, w) => ({ label, eval: eval_, ...(w ? { wait: w } : {}) });
const waitGround = (label) => ev(label, "(async()=>{const t=await __waitGround(15000);return JSON.stringify({mountedAtMs:t,errors:__errs,chunks:performance.getEntriesByType('resource').filter(e=>e.name.includes('eclipse-engine')).map(e=>({file:e.name.replace(/^.*assets\\//,''),transferKB:Math.round(e.transferSize/102.4)/10}))})})()");
const STATE = (label) => ev(label, "__ground()");
const sample = (label) => ({ sample: { grid: [8, 5] }, label });

const steps = [];
// ---- 1 mount, chunk, sizes, draw rate
steps.push({ ...base([1440, 900]), init, go: "{{BASE}}/work", wait: 600 });
steps.push(waitGround("1-mount on /work at 1440x900 dpr 1 (the chunk, the time the fade began)"));
steps.push(STATE("1-state: one canvas pixel per CSS pixel, three stills in the layer"));
steps.push(ev("1-draws over 3 s while running (about 30 a second)", "__drawsOver(3000)"));
steps.push(ev("1-placement pictures present", "JSON.stringify([...document.querySelectorAll('.eclipse-still img')].map(i=>({src:i.currentSrc.replace(/^https?:\\/\\/[^/]+/,''),loaded:i.complete&&i.naturalWidth>0,on:i.parentElement.dataset.on})))"));
for (const dpr of [2, 3]) {
  steps.push({ ...base([1440, 900], dpr), go: "{{BASE}}/work", wait: 600 });
  steps.push(waitGround(`1-mount at dpr ${dpr}`));
  steps.push(STATE(`1-state at dpr ${dpr} (backing must equal CSS size, not CSS size times ${dpr})`));
}
// ---- 2 frame gaps under the rings (R33 gate kind of load)
steps.push({ ...base([1440, 900], 2), go: "{{BASE}}/work", wait: 600 });
steps.push(waitGround("2-mount at dpr 2"));
steps.push(ev("2-neutral pictures on the ring tiles", "__fake()", 700));
steps.push({ cpu: 4 });
steps.push(ev("2-frames over 5 s, CPU 4x, rings turning and the ground running", "__frames(5000)"));
steps.push(ev("2-draws over the same kind of 3 s", "__drawsOver(3000)"));
steps.push(ev("2-stop the loop (faked hidden tab)", "__fakeHidden(true)", 300));
steps.push(ev("2-frames over 5 s, CPU 4x, rings turning, loop stopped (the baseline)", "__frames(5000)"));
steps.push(ev("2-resume", "__fakeHidden(false)", 300));
steps.push({ cpu: 1 });
// ---- 3 the loop stops
steps.push({ ...base([1440, 900]), go: "{{BASE}}/work", wait: 600 });
steps.push(waitGround("3-mount"));
steps.push(ev("3-running: draws over 1 s", "__drawsOver(1000)"));
steps.push(ev("3-hide the tab", "__fakeHidden(true)", 200));
steps.push(ev("3-hidden: draws over 1.5 s (0)", "__drawsOver(1500)"));
steps.push(ev("3-show the tab", "__fakeHidden(false)", 200));
steps.push(ev("3-back: draws over 1 s", "__drawsOver(1000)"));
steps.push(ev("3-page change /work to /work/long-form: draws while it runs and after (a placement change draws once)", "__changeDraws('/work/long-form')"));
steps.push(ev("3-on the long form wall: the layer is still one, placement 1 on", "JSON.stringify({ground:JSON.parse(__ground()),on:[...document.querySelectorAll('.eclipse-still')].map(s=>s.dataset.on)})"));
steps.push(ev("3-back running after the change: draws over 1 s", "__drawsOver(1000)"));
steps.push(ev("3-page change /work/long-form to /work/short-form", "__changeDraws('/work/short-form')"));
steps.push(ev("3-page change /work/short-form to /experience (the ground goes)", "__changeDraws('/experience')"));
steps.push(ev("3-no ground on /experience", "JSON.stringify({host:!!document.querySelector('.eclipse'),path:location.pathname})"));
steps.push(ev("3-page change /experience to / (the home ground is built when its section nears)", "__changeDraws('/')"));
steps.push(ev("3-home at the top: the section is off screen, nothing runs", "JSON.stringify({ground:JSON.parse(__ground()),draws:window.__draws})"));
steps.push(ev("3-home at the top: draws over 1.5 s (0)", "__drawsOver(1500)"));
steps.push(ev("3-scroll the blocks section into view", "(()=>{const b=document.getElementById('below');window.scrollTo({top:b.offsetTop,behavior:'instant'});return scrollY})()", 500));
steps.push(waitGround("3-home section mounted"));
steps.push(STATE("3-home section state (scope section)"));
steps.push(ev("3-home section: draws over 2 s (about 30 a second)", "__drawsOver(2000)"));
steps.push(ev("3-open the reading layer (covers the page)", "document.querySelector('[data-xp=reading]').click()", 2500));
steps.push(ev("3-layer open: draws over 1.5 s (0)", "__drawsOver(1500)"));
steps.push(ev("3-close the layer", "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 1})()", 2500));
steps.push(ev("3-layer closed: draws over 1.5 s (running again)", "__drawsOver(1500)"));
steps.push(ev("3-scroll back to the hero", "(()=>{window.scrollTo({top:0,behavior:'instant'});return scrollY})()", 900));
steps.push(ev("3-hero: draws over 1.5 s (0, the section is off screen)", "__drawsOver(1500)"));
// ---- 4 pictures of each placement, content hidden (tracked), and the stills alone
const shotPlace = (name, path, scrollTo = false) => [
  ev(`4-go to ${path}`, `__jump('${path}')`, 1200),
  ...(scrollTo ? [ev("4-scroll to the section", "(()=>{const b=document.getElementById('below');window.scrollTo({top:b.offsetTop,behavior:'instant'});return scrollY})()", 600)] : []),
  waitGround(`4-ground live on ${path}`),
  ev("4-hide the page's own content", "__bare(true)", 700),
  { shot: `${name}-warm` },
  { shot: name },
  ev("4-show the page's content again", "__bare(false)"),
];
steps.push({ ...base([1440, 900]), go: "{{BASE}}/work", wait: 600 });
steps.push(...shotPlace("r50-ground-0-work", "/work"));
steps.push(...shotPlace("r50-ground-1-long-form", "/work/long-form"));
steps.push(...shotPlace("r50-ground-3-short-form", "/work/short-form"));
steps.push(...shotPlace("r50-ground-2-home-section", "/", true));
steps.push(sample("4-sample of the home section ground with the content hidden"));
// the page with its content (rings; thumbnails: local only)
steps.push(ev("4-go to /work", "__jump('/work')", 1500));
steps.push(ev("4-neutral pictures on the ring tiles", "__fake()", 900));
steps.push({ shot: "r50-ground-0-work-with-rings-warm" }, { shot: "r50-ground-0-work-with-rings" });
steps.push(ev("4-go to the home section", "__jump('/')", 1200));
steps.push(ev("4-scroll to the section", "(()=>{const b=document.getElementById('below');window.scrollTo({top:b.offsetTop,behavior:'instant'});return scrollY})()", 900));
steps.push({ shot: "local-r50-ground-2-home-section-with-blocks-warm" }, { shot: "local-r50-ground-2-home-section-with-blocks" });
// phone and tall screens
steps.push({ ...base([390, 844], 3, { mobile: true }), go: "{{BASE}}/work", wait: 600 });
steps.push(waitGround("4-phone /work"));
steps.push(STATE("4-phone state (backing 390 by 844 CSS pixels: one canvas pixel per CSS pixel; the tall still)"));
steps.push(ev("4-hide the page's own content", "__bare(true)", 700));
steps.push({ shot: "r50-ground-0-work-phone-warm" }, { shot: "r50-ground-0-work-phone" });
steps.push(ev("4-go home, scroll to the section", "(async()=>{await __jump('/');const b=document.getElementById('below');window.scrollTo({top:b.offsetTop,behavior:'instant'});await __sleep(900);__bare(true);return scrollY})()", 700));
steps.push({ shot: "r50-ground-2-home-section-phone-warm" }, { shot: "r50-ground-2-home-section-phone" });
// ---- 5 no pop and no black across a pause, a lost context, a resize
steps.push({ ...base([1440, 900]), go: "{{BASE}}/work", wait: 600 });
steps.push(waitGround("5-mount"));
steps.push(ev("5-hide the page's own content", "__bare(true)", 500));
steps.push(sample("5-grid sample, running"));
steps.push(ev("5-pause (faked hidden)", "__fakeHidden(true)", 400));
steps.push(sample("5-grid sample, paused (the canvas keeps its last frame: not black, same picture)"));
steps.push(ev("5-resume", "__fakeHidden(false)", 400));
steps.push(sample("5-grid sample, resumed"));
steps.push({ shot: "5-resumed-warm" }, { shot: "5-resumed" });
steps.push(ev("5-lose the context", "(()=>{const c=document.querySelector('.eclipse canvas');c.getContext('webgl').getExtension('WEBGL_lose_context').loseContext();return 1})()", 600));
steps.push(ev("5-after the loss: no canvas, the still stays", "__ground()"));
steps.push(sample("5-grid sample after the loss (the still, not black)"));
steps.push({ shot: "5-lost-warm" }, { shot: "5-lost" });
steps.push({ ...base([1440, 900]), go: "{{BASE}}/work", wait: 600 });
steps.push(waitGround("5-mount again"));
steps.push({ size: [1000, 700], dpr: 1 });
steps.push(ev("5-after a resize to 1000 by 700 (a resized canvas is cleared: it must be drawn again at once)", "(async()=>{await __sleep(500);return __ground()})()"));
steps.push(sample("5-grid sample after the resize (not black)"));
// ---- 6 reduced motion, no WebGL, save-data
steps.push({ requests: { match: "eclipse-engine" }, label: "6-flush the request list" });
steps.push({ ...base([1440, 900], 1, { reduce: true }), go: "{{BASE}}/work", wait: 2500 });
steps.push({ requests: { match: "eclipse-engine" }, label: "6-reduced motion: requests (no eclipse-engine chunk)" });
steps.push(STATE("6-reduced motion state (no canvas; the still)"));
steps.push(sample("6-reduced motion grid sample (the still is the ground)"));
steps.push({ requests: { match: "eclipse-engine" }, label: "6-flush the request list" });
steps.push({ ...base([1440, 900]), go: "{{BASE}}/work?nogl=1", wait: 2500 });
steps.push({ requests: { match: "eclipse-engine" }, label: "6-no WebGL (?nogl=1): requests" });
steps.push(STATE("6-no WebGL state (no canvas; the still)"));
steps.push({ shot: "6-nogl-warm" }, { shot: "6-nogl" });
steps.push({ requests: { match: "eclipse-engine" }, label: "6-flush the request list" });
steps.push({ ...base([1440, 900]), init: "try{Object.defineProperty(navigator,'connection',{configurable:true,get:()=>({saveData:true})})}catch(e){}", go: "{{BASE}}/work", wait: 2500 });
steps.push({ requests: { match: "eclipse-engine" }, label: "6-save-data: requests" });
steps.push(STATE("6-save-data state (no canvas; the still)"));
steps.push({ ...base([1440, 900]), go: "{{BASE}}/experience", wait: 1500 });
steps.push(ev("6-/experience has no ground", "JSON.stringify({host:!!document.querySelector('.eclipse')})"));

writeFileSync(new URL("./ground.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
