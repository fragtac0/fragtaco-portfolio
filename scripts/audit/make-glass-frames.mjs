// Writes the audit files that save frames of the page change (round 7, Task 6: one radial reveal from the centre, 3.5 s):
//   transition.json   four pairs, nine frames each: home to work, work to long form, long form to short form, experience to home
//   glass-phone.json  home to work on a phone (390 by 844, dpr 2)
//   glass-coverage.json  experience to home (no thumbnails) at 0.6, 0.7, 0.8, 0.9, 0.95 and 1.0 of the time, with each page alone (R62:
//                     the screen is fully uncovered at about 0.95)
//   glass-finish.json a press or a key during a change finishes it: a finish by key at 1 s (focus left on the dock's tab, or on the
//                     page's main), a finish by a pointer press and by a touch tap that must not also activate what is under it,
//                     Back at 1 s (R59: no second reveal, the page before is live within a few hundred ms), and a bare modifier or a
//                     Ctrl/Cmd shortcut, which finish nothing
// A frame is the change frozen at a moment of its length (the audit browser does not paint a running transition at steady
// times): `__hold` starts a change with the debug hook (sessionStorage "ft:debug-change", see app/root.tsx), waits for the
// transition's animations to exist, pauses them all at that moment, and the screenshot is taken while it holds. `__release`
// lets the change finish, so the next frame starts clean. `__jump` goes to a page at once: it starts a change and finishes it
// with the same finish a press uses (`__ftFinish`).
// Shots of pages that show YouTube thumbnails (the work pages) are named `local-...`: save them under docs/redesign/compare/local/.
// usage: node scripts/audit/make-glass-frames.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/transition.json <outdir>
import { writeFileSync } from "node:fs";

const init = `
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)));addEventListener('unhandledrejection',e=>__errs.push('rej '+String(e.reason)));
window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.__hold=(to,t)=>new Promise(res=>{__ftChange(to);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>5000){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(document.getAnimations().length)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},9000)});
window.__jump=to=>new Promise(res=>{if(location.pathname===to){res(to);return}
 __ftChange(to);const iv=setInterval(()=>{__ftFinish();if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),1500)}},40);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},12000)});
`.trim();

/** moments of the change, as a share of its length (the ease is in and out, so they are spread) */
const MOMENTS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.92];
/** moments for the coverage sheet (R62: the screen is fully uncovered at about 0.95 of the time, not at 0.7) */
const COVER_MOMENTS = [0.6, 0.7, 0.8, 0.9, 0.95, 1];

function frames(prefix, from, to, moments = MOMENTS) {
  const out = [];
  moments.forEach((t, i) => {
    const name = `${prefix}-${String(i).padStart(2, "0")}`;
    out.push({ label: `${name} (t=${t}): to the start page`, eval: `__jump('${from}')` });
    out.push({ label: `${name} (t=${t})`, eval: `__hold('${to}',${t})` });
    out.push({ wait: 120, shot: `${name}-warm` }, { wait: 60, shot: name });
    out.push({ label: "release", eval: "__release()" });
  });
  return out;
}

const start = (size, dpr, mobile) => ({ size, dpr, mobile, touch: mobile, init, go: "{{BASE}}/", wait: 6000 });
const desktop = [1440, 900];

const transition = [
  start(desktop, 1),
  ...frames("local-home-to-work", "/", "/work"),
  ...frames("local-work-to-long-form", "/work", "/work/long-form"),
  ...frames("local-long-form-to-short-form", "/work/long-form", "/work/short-form"),
  ...frames("experience-to-home", "/experience", "/"),
];
writeFileSync(new URL("./transition.json", import.meta.url), JSON.stringify(transition, null, 1) + "\n");

// the coverage sheet (R62): experience to home (no thumbnails) at 0.6 to 1 of the time, with the two pages on their own for comparison
const coverage = [
  start(desktop, 1),
  { label: "the old page alone", eval: "__jump('/experience')" },
  { wait: 400, shot: "cover-old-warm" },
  { wait: 100, shot: "cover-old" },
  { label: "the new page alone", eval: "__jump('/')" },
  { wait: 400, shot: "cover-new-warm" },
  { wait: 100, shot: "cover-new" },
  ...frames("cover", "/experience", "/", COVER_MOMENTS),
];
writeFileSync(new URL("./glass-coverage.json", import.meta.url), JSON.stringify(coverage, null, 1) + "\n");

const phone = [start([390, 844], 2, true), ...frames("local-phone-home-to-work", "/", "/work")];
writeFileSync(new URL("./glass-phone.json", import.meta.url), JSON.stringify(phone, null, 1) + "\n");

// ---- a way out: the state read after each press (settled, no marks left, the address, where focus is). `ok` is a verdict for
// the case: the address is `want`, no marks or glass left, the page settled, no errors (and `inDock` or `main` for where focus is)
const snap = `(tag,want,focusIn)=>{const h=document.documentElement,a=document.activeElement;const o={tag,path:location.pathname,kind:h.dataset.changeKind||null,glass:h.dataset.glass||null,settled:__ftSettled(),
 marks:['--change-x','--change-y','--change-r','--change-ms'].filter(n=>h.style.getPropertyValue(n)).length,docAnims:document.getAnimations().length,
 focus:a?(a.tagName+(a.getAttribute('data-work-tab')?'['+a.getAttribute('data-work-tab')+']':'')+(a.getAttribute('aria-current')?'[current]':'')):null,inDock:!!(a&&a.closest&&a.closest('header[data-site-nav]')),errs:__errs.length,clicks:window.__clicks??null};
 o.ok=o.path===want&&o.kind===null&&o.glass===null&&o.settled&&o.marks===0&&o.errs===0&&(window.__clicks??0)===0&&(focusIn==='dock'?o.inDock&&/current/.test(o.focus||''):focusIn==='main'?o.focus==='MAIN':true);return JSON.stringify(o)}`;
/** starts a change with the hook, then waits in the page until it has run for `ms` (headless Chrome does not advance timers while idle between steps) */
const startAndWait = (to, ms) => `(async()=>{__ftChange('${to}');const t0=performance.now();while(performance.now()-t0<${ms})await __sleep(20);const a=document.getAnimations().find(a=>a.animationName==='glass-p');return JSON.stringify({showing:!!document.documentElement.dataset.changeKind,glassMs:a?Math.round(a.currentTime):null})})()`;
/** counts clicks that reach the document (a capture listener on document runs after the window's, where the press is swallowed) */
const countClicks = "(()=>{window.__clicks=0;document.addEventListener('click',()=>{window.__clicks++},true);return 'counting clicks'})()";
/** R59: after Back during a change: no second radial change, no glass animation, the address and main agree, settled within a few hundred ms */
const backNoReveal = (want, mainWant) => `(async()=>{const h=document.documentElement;window.__kinds=[];let glass=0,seen=0;
 new MutationObserver(()=>{const k=h.dataset.changeKind;if(k)__kinds.push(k)}).observe(h,{attributes:true,attributeFilter:['data-change-kind']});
 const t0=performance.now();let settledMs=null;history.back();
 while(performance.now()-t0<2500){await __sleep(16);if(document.getAnimations().some(a=>a.animationName==='glass-p'))glass++;
  if(settledMs===null&&location.pathname==='${want}'&&__ftSettled()&&!h.dataset.changeKind&&(document.querySelector('main')||{}).className.split(' ')[0]==='${mainWant}')settledMs=Math.round(performance.now()-t0)}
 const m=((document.querySelector('main')||{}).className||'').split(' ')[0];
 return JSON.stringify({path:location.pathname,main:m,settledMs,kindsSeen:__kinds,glassAnimFrames:glass,kind:h.dataset.changeKind||null,settled:__ftSettled(),errs:__errs.length,
  ok:location.pathname==='${want}'&&m==='${mainWant}'&&settledMs!==null&&settledMs<=600&&__kinds.length===0&&glass===0&&!h.dataset.changeKind&&__ftSettled()&&__errs.length===0})})()`;
const finish = [
  { ...start(desktop, 1), cpu: 4 },
  { label: "setup: a probe button counts the clicks it gets and holds focus", eval: "(()=>{window.__clicks=0;const b=document.createElement('button');b.id='probe';b.textContent='probe';b.style.cssText='position:fixed;left:8px;top:8px;z-index:99999';b.addEventListener('click',()=>{window.__clicks++});document.body.appendChild(b);b.focus();return document.activeElement.id})()" },
  { label: "A: a change home to work, 1 s in", eval: startAndWait("/work", 1000) },
  { label: "A: before the press", shot: "local-finish-key-before-warm" },
  { shot: "local-finish-key-before" },
  { key: "Enter" },
  { wait: 400, label: "A: after Enter at 1 s: the change is over on /work, the probe's Enter click did not happen (clicks 0, in ok)", eval: `(${snap})('A','/work')` },
  { shot: "local-finish-key-after-warm" },
  { shot: "local-finish-key-after" },
  { label: "A: no second finish: a later key press does nothing to the page", eval: "(async()=>{await __sleep(300);return JSON.stringify({clicks:__clicks,path:location.pathname,ok:__clicks===0&&location.pathname==='/work'})})()" },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "B: focus a dock tab (Work), start the change from the keyboard, press a key at 1 s: it ends on /work and focus is back on the dock", eval: "(()=>{const l=[...document.querySelectorAll('header[data-site-nav] a')].find(a=>a.getAttribute('href')==='/work');l.focus();return document.activeElement.getAttribute('href')})()" },
  { key: "Enter" },
  { label: "B: 1 s into the change", eval: "(async()=>{const t0=performance.now();while(performance.now()-t0<1000)await __sleep(20);const a=document.getAnimations().find(a=>a.animationName==='glass-p');return JSON.stringify({showing:!!document.documentElement.dataset.changeKind,glassMs:a?Math.round(a.currentTime):null,path:location.pathname})})()" },
  { key: "ArrowDown" },
  { wait: 600, label: "B: after the key", eval: `(${snap})('B','/work','dock')` },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "C setup: count the clicks that reach the page", eval: countClicks },
  { label: "C: a pointer press at 1 s finishes the change and does not activate what is under it (the dock's Home link sits where the press lands)", eval: startAndWait("/work", 1000) },
  { click: [559, 846] },
  { wait: 800, label: "C: after the press (still on /work: no second change started, no click reached the page, focus on main)", eval: `(${snap})('C','/work','main')` },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "D setup: main's class on the home page", eval: "((document.querySelector('main')||{}).className||'').split(' ')[0]" },
  { label: "D: 1 s into a change to /work, press Back", eval: startAndWait("/work", 1000) },
  { label: "D: after Back (R59: no second reveal; the page before is live and settled within a few hundred ms; no radial change, no glass animation)", eval: backNoReveal("/", "home-page") },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "E: a bare modifier and a Ctrl/Cmd shortcut finish nothing", eval: startAndWait("/work", 600) },
  { key: "Shift" },
  { label: "E: after Shift: still running", eval: "JSON.stringify({kind:document.documentElement.dataset.changeKind||null,path:location.pathname,ok:document.documentElement.dataset.changeKind==='radial'})" },
  { key: "r", mod: 4 },
  { key: "l", mod: 2 },
  { label: "E: after Cmd+R and Ctrl+L (real key events with the modifier): still running, nothing prevented", eval: "JSON.stringify({kind:document.documentElement.dataset.changeKind||null,path:location.pathname,ok:document.documentElement.dataset.changeKind==='radial'&&location.pathname==='/work'})" },
  { eval: "__ftFinish()" },
  { wait: 400, label: "E: after the hook's finish", eval: `(${snap})('E','/work')` },
  { label: "reduced motion: a press is not needed (120 ms fade), nothing odd", reduce: true, go: "{{BASE}}/", wait: 6000 },
  { label: "F: reduced motion change ends by itself", eval: "(async()=>{await __ftChange('/work');await __sleep(300);return JSON.stringify({path:location.pathname,kind:document.documentElement.dataset.changeKind||null,settled:__ftSettled(),ok:location.pathname==='/work'&&!document.documentElement.dataset.changeKind&&__ftSettled()})})()" },
  { ...start([390, 844], 2, true), reduce: false, cpu: 4, label: "H setup: the touch profile (390 by 844, dpr 2, touch)" },
  { label: "H: count the clicks that reach the page", eval: countClicks },
  { label: "H: a change to /work, 1 s in", eval: startAndWait("/work", 1000) },
  { tap: "(()=>{const r=[...document.querySelectorAll('header[data-site-nav] a')].find(a=>a.getAttribute('href')==='/').getBoundingClientRect();return [Math.round(r.x+r.width/2),Math.round(r.y+r.height/2)]})()" },
  { wait: 800, label: "H: after the tap on the dock's Home link: the change is finished, the page stays /work (the tap's click did not activate Home), no click reached the page, settled", eval: `(${snap})('H','/work')` },
];
writeFileSync(new URL("./glass-finish.json", import.meta.url), JSON.stringify(finish, null, 1) + "\n");
