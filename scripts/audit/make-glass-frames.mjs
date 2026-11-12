// Writes the audit files that save frames of the liquid-glass page change (round 6, Task 6):
//   transition.json  home to work and back, radial from the dock tab (the default change), ten frames each
//   glass-kinds.json the other kinds on the same two pages: linear-right, linear-left, and a radial from the
//                    centre (as Back and Forward use); pass "phone" for a phone-sized radial set
// A frame is the change frozen at a moment of its length (the audit browser does not paint a running
// transition at steady times): `__hold` starts a change with the debug hook (sessionStorage "ft:debug-change",
// see app/root.tsx), waits for the transition's animations to exist, pauses them all at that moment, and
// the screenshot is taken while it holds. `__release` lets the change finish, so the next frame starts clean.
// usage: node scripts/audit/make-glass-frames.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/transition.json <outdir>
import { writeFileSync } from "node:fs";

const init = `
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__hold=(to,kind,t,ox,oy)=>new Promise(res=>{__ftChange(to,kind,ox!=null?{x:ox,y:oy}:undefined);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.length>=3||performance.now()-t0>4000){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(document.getAnimations().length)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},6000)});
`.trim();

/** moments of the change, as a share of its length: the front is fast at first (the easing), so they bunch early */
const MOMENTS = [0.03, 0.06, 0.1, 0.14, 0.19, 0.25, 0.33, 0.45, 0.65, 0.9];
const DOCK = { work: [676, 846], home: [559, 846] };

function frames(prefix, to, kind, origin) {
  const out = [];
  MOMENTS.forEach((t, i) => {
    const name = `${prefix}-${String(i).padStart(2, "0")}`;
    out.push({ label: `${name} (t=${t})`, eval: `__hold('${to}','${kind}',${t},${origin ? origin[0] : "null"},${origin ? origin[1] : "null"})` });
    out.push({ wait: 120, shot: `${name}-warm` }, { wait: 60, shot: name });
    out.push({ label: "release", eval: "__release()" });
    // back to the start page, instantly (reduced motion would fade; this is a plain jump through the same hook)
    out.push({ label: "return", eval: `(async()=>{await __ftChange('${to === "/work" ? "/" : "/work"}','fade');return __release()})()` });
  });
  return out;
}

const start = (size, dpr, mobile) => ({ size, dpr, mobile, touch: mobile, init, go: "{{BASE}}/", wait: 6000 });
const desktop = [1440, 900];

const transition = [
  start(desktop, 1),
  ...frames("to-work", "/work", "radial", DOCK.work),
  { eval: "__ftChange('/work','fade').then(()=>__release())", label: "to work" },
  ...frames("to-home", "/", "radial", DOCK.home),
];
writeFileSync(new URL("./transition.json", import.meta.url), JSON.stringify(transition, null, 1) + "\n");

const kinds = [
  start(desktop, 1),
  ...frames("linear-right", "/work", "linear-right"),
  ...frames("linear-left", "/work", "linear-left"),
  ...frames("centre", "/work", "radial", [720, 450]),
];
writeFileSync(new URL("./glass-kinds.json", import.meta.url), JSON.stringify(kinds, null, 1) + "\n");

const phone = [
  start([390, 844], 2, true),
  ...frames("phone-radial", "/work", "radial", [150, 790]),
];
writeFileSync(new URL("./glass-phone.json", import.meta.url), JSON.stringify(phone, null, 1) + "\n");
