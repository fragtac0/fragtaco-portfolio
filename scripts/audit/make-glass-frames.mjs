// Writes the audit files that save frames of the page change (round 7, Task 6: one radial reveal from the centre, 3.5 s):
//   transition.json   four pairs, nine frames each: home to work, work to long form, long form to short form, experience to home
//   glass-phone.json  home to work on a phone (390 by 844, dpr 2)
//   glass-finish.json a press or a key during a change finishes it: a finish by key at 1 s (focus left on the dock's tab, or on the
//                     page's main), a finish by a pointer press that must not also activate what is under it, Back at 1 s, and a
//                     key that is a browser shortcut or a bare modifier, which finishes nothing
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

function frames(prefix, from, to) {
  const out = [];
  MOMENTS.forEach((t, i) => {
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

const phone = [start([390, 844], 2, true), ...frames("local-phone-home-to-work", "/", "/work")];
writeFileSync(new URL("./glass-phone.json", import.meta.url), JSON.stringify(phone, null, 1) + "\n");

// ---- a way out: the state read after each press (settled, no marks left, the address, where focus is)
const snap = `(tag)=>{const h=document.documentElement,a=document.activeElement;return JSON.stringify({tag,path:location.pathname,kind:h.dataset.changeKind||null,glass:h.dataset.glass||null,settled:__ftSettled(),
 marks:['--change-x','--change-y','--change-r','--change-ms'].filter(n=>h.style.getPropertyValue(n)).length,docAnims:document.getAnimations().length,
 focus:a?(a.tagName+(a.getAttribute('data-work-tab')?'['+a.getAttribute('data-work-tab')+']':'')+(a.getAttribute('aria-current')?'[current]':'')):null,inDock:!!(a&&a.closest&&a.closest('header[data-site-nav]')),errs:__errs.length})}`;
/** starts a change with the hook, then waits in the page until it has run for `ms` (headless Chrome does not advance timers while idle between steps) */
const startAndWait = (to, ms) => `(async()=>{__ftChange('${to}');const t0=performance.now();while(performance.now()-t0<${ms})await __sleep(20);const a=document.getAnimations().find(a=>a.animationName==='glass-p');return JSON.stringify({showing:!!document.documentElement.dataset.changeKind,glassMs:a?Math.round(a.currentTime):null})})()`;
const finish = [
  { ...start(desktop, 1), cpu: 4 },
  { label: "setup: a probe button counts the clicks it gets and holds focus", eval: "(()=>{window.__clicks=0;const b=document.createElement('button');b.id='probe';b.textContent='probe';b.style.cssText='position:fixed;left:8px;top:8px;z-index:99999';b.addEventListener('click',()=>{window.__clicks++});document.body.appendChild(b);b.focus();return document.activeElement.id})()" },
  { label: "A: a change home to work, 1 s in", eval: startAndWait("/work", 1000) },
  { label: "A: before the press", shot: "local-finish-key-before-warm" },
  { shot: "local-finish-key-before" },
  { key: "Enter" },
  { wait: 400, label: "A: after Enter at 1 s: the change is over on /work, the probe's Enter click did not happen (it is outside the pictures)", eval: `(${snap})('A')` },
  { shot: "local-finish-key-after-warm" },
  { shot: "local-finish-key-after" },
  { label: "A: no second finish: a later key press does nothing to the page", eval: "(async()=>{await __sleep(300);return JSON.stringify({clicks:__clicks,path:location.pathname})})()" },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "B: focus a dock tab (Work), start the change from the keyboard, press a key at 1 s: it ends on /work and focus is back on the dock", eval: "(()=>{const l=[...document.querySelectorAll('header[data-site-nav] a')].find(a=>a.getAttribute('href')==='/work');l.focus();return document.activeElement.getAttribute('href')})()" },
  { key: "Enter" },
  { label: "B: 1 s into the change", eval: "(async()=>{const t0=performance.now();while(performance.now()-t0<1000)await __sleep(20);const a=document.getAnimations().find(a=>a.animationName==='glass-p');return JSON.stringify({showing:!!document.documentElement.dataset.changeKind,glassMs:a?Math.round(a.currentTime):null,path:location.pathname})})()" },
  { key: "ArrowDown" },
  { wait: 600, label: "B: after the key", eval: `(${snap})('B')` },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "C: a pointer press at 1 s finishes the change and does not activate what is under it (the dock's Home link sits where the press lands)", eval: startAndWait("/work", 1000) },
  { click: [559, 846] },
  { wait: 800, label: "C: after the press (still on /work: no second change started)", eval: `(${snap})('C')` },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "D: 1 s into a change to /work, press Back: the change is finished and Back lands on the page before", eval: startAndWait("/work", 1000) },
  { eval: "history.back()" },
  { wait: 200, label: "D: after Back (its own change runs, then it is over)", eval: "(async()=>{for(let i=0;i<400;i++){await __sleep(30);if(!document.documentElement.dataset.changeKind&&i>5)break}await __sleep(300);return JSON.stringify({path:location.pathname,settled:__ftSettled(),kind:document.documentElement.dataset.changeKind||null,errs:__errs.length})})()" },
  { go: "{{BASE}}/", wait: 6000 },
  { label: "E: a browser shortcut and a bare modifier finish nothing", eval: startAndWait("/work", 600) },
  { key: "Shift" },
  { label: "E: after Shift: still running", eval: "JSON.stringify({kind:document.documentElement.dataset.changeKind||null,path:location.pathname})" },
  { eval: "__ftFinish()" },
  { wait: 400, label: "E: after the hook's finish", eval: `(${snap})('E')` },
  { label: "reduced motion: a press is not needed (120 ms fade), nothing odd", reduce: true, go: "{{BASE}}/", wait: 6000 },
  { label: "F: reduced motion change ends by itself", eval: "(async()=>{await __ftChange('/work');await __sleep(300);return JSON.stringify({path:location.pathname,kind:document.documentElement.dataset.changeKind||null,settled:__ftSettled()})})()" },
];
writeFileSync(new URL("./glass-finish.json", import.meta.url), JSON.stringify(finish, null, 1) + "\n");
