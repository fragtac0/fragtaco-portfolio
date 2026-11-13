// Writes scripts/audit/hero-return.json: the home page's picture through a page change (R49.1), on the production build.
// usage: node scripts/audit/make-hero-return.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/hero-return.json <outdir>
// Every `film` step photographs every frame the compositor produces (a screencast) from the moment the change to home starts
// until 4 s after; a frame is bare when 75% of its 48 by 30 cells are darker than luma 20 (a painting, even a dark one, stays
// under 55%; the bare ground and the black canvas are 98%+). `ok` must be true: no bare frame while the hero is visible.
// The cases: a return (the intro was seen; Hero remembers its painting) and a first visit (landed on /work, nothing remembered: the
// blurred placeholder carries the change), each at full speed and with the CPU 6 times slower (so the work between the end of the
// change and the first engine frame is long: the picture must hold however long the change and the arrival take), by the dock, by
// Back, with reduced motion, and with a held change (the reveal frozen part way: the picture is already there). Then the order of the
// words through one painting change.
import { writeFileSync } from "node:fs";

const base = (seen) => `try{${seen ? "sessionStorage.setItem('ft:intro-seen','1');" : ""}sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__hold=(to,kind,t,ox,oy)=>new Promise(res=>{__ftChange(to,kind,ox!=null?{x:ox,y:oy}:undefined);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>4000){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(document.getAnimations().length)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},6000)});`;
const toWork = "__ftChange('/work','radial',{x:676,y:846}).then(()=>new Promise(r=>setTimeout(r,1500)))";
const toHome = "__ftChange('/','radial',{x:559,y:846})";
const steps = [];
const wait = (ms) => ({ wait: ms });

/** Opens on `/` (seen) or `/work` (not seen); leaves the page on /work, ready for the change to home. */
function arrive(kind, o = {}) {
  steps.push({ size: [1440, 900], dpr: o.dpr ?? 1, reduce: !!o.reduce, cpu: 1, init: base(kind === "return"), go: "{{BASE}}" + (kind === "return" ? "/" : "/work"), wait: 7000 });
  if (kind === "return") steps.push({ eval: toWork, wait: 3500 });
  if (o.cpu) steps.push({ cpu: o.cpu, wait: 500 });
}
// `at`: the frame nearest that time is saved too (<keep>-at.jpg), just after the change: the home picture, where the bare frame was
const film = (label, keep, at, evalCode = toHome) => steps.push({ film: { ms: 4000, eval: evalCode, keep, at }, label });
const state = (label) => steps.push({ label, eval: "JSON.stringify({path:location.pathname,still:(()=>{const s=document.querySelector('.paint-still');return s?(s.hidden?'hidden':'shown'):'none'})(),canvas:!!document.querySelector('.paint-host canvas'),intro:document.documentElement.classList.contains('intro'),words:document.querySelector('#hero')?.dataset.words||''})" });

arrive("return"); film("return, dock, 1x: no bare frame", "return-darkest", 740); state("return state");
arrive("return", { cpu: 6 }); film("return, dock, CPU 6x: no bare frame", "return-slow-darkest", 1050);
arrive("first"); film("first visit (landed on /work), dock, 1x: no bare frame", "first-darkest", 740); state("first visit state");
arrive("first", { cpu: 6 }); film("first visit, dock, CPU 6x: no bare frame", "first-slow-darkest", 1050);
arrive("return"); steps.push({ film: { ms: 4000, eval: "history.back()", keep: "back-darkest" }, label: "return by Back: no bare frame" });
arrive("return", { reduce: true }); film("return, reduced motion: no bare frame", "return-reduced-darkest", 400);
arrive("first", { reduce: true }); film("first visit, reduced motion: no bare frame", "first-reduced-darkest", 400);
arrive("return", { dpr: 2 }); film("return, dpr 2: no bare frame", "return-dpr2-darkest");

// held: the reveal frozen part way, the new page's picture is already there (the first visit has no remembered painting)
for (const kind of ["return", "first"]) {
  arrive(kind);
  for (const t of [0.3, 0.7]) {
    steps.push({ eval: `__hold('/','radial',${t},559,846)`, label: `${kind} held at ${t}` });
    steps.push(wait(120), { shot: `${kind}-held-${t}-warm` }, wait(60), { shot: `${kind}-held-${t}` });
    steps.push({ film: { ms: 400, keep: `${kind}-held-${t}-darkest` }, label: `${kind} held at ${t}: no bare frame` });
    steps.push({ eval: "__release()", label: "release" }, { eval: toWork, wait: 3000 });
  }
}

// the words through one painting change: out (about 400 ms), then the painting changes, then in only once the swap is done
steps.push({ size: [1440, 900], dpr: 1, cpu: 1, init: base(true), go: "{{BASE}}/", wait: 6000 });
steps.push({
  label: "caption order through one painting change",
  eval: `new Promise(res=>{const root=document.querySelector('#hero'),cap=root.querySelector('.caption'),t=cap.querySelector('.t');
 const t0=performance.now(),log=[],op=[];let last=root.dataset.words||'',txt=t.textContent,txtAt={},swappedAt=0;
 const iv=setInterval(()=>{const w=root.dataset.words||'',now=Math.round(performance.now()-t0),o=+getComputedStyle(cap).opacity;
  op.push([now,w,+o.toFixed(2)]);
  if(w!==last){log.push([now,w,+o.toFixed(2),t.textContent!==txt]);last=w}
  if(w==='swapping'&&t.textContent!==txt)txtAt.swapping=now;
  if(w==='swapped'&&!swappedAt)swappedAt=now;
  if(swappedAt&&now-swappedAt>1300){clearInterval(iv);clearTimeout(to);
   const at=n=>(log.find(l=>l[1]===n)||[])[0];const out=at('caption-out'),sw=at('swapping'),done=at('swapped');
   const hiddenDuring=op.filter(r=>r[1]==='swapping').every(r=>r[2]<=0.05);
   const firstVisibleAfterDone=op.find(r=>r[2]>0.1&&r[0]>=sw);
   res(JSON.stringify({phases:log,outMs:sw-out,swapMs:done-sw,hiddenDuringSwap:hiddenDuring,textChangedWhileHidden:txtAt.swapping!=null&&txtAt.swapping<done,textNow:t.textContent,firstVisibleAt:firstVisibleAfterDone&&firstVisibleAfterDone[0],doneAt:done,
    ok:out!=null&&sw!=null&&done!=null&&sw-out>=380&&sw-out<=480&&hiddenDuring&&done-sw>=2000&&firstVisibleAfterDone&&firstVisibleAfterDone[0]>=done-60}))}},40);
 const to=setTimeout(()=>{clearInterval(iv);res(JSON.stringify({error:'no painting change within 30 s',phases:log}))},30000)})`,
});
writeFileSync(new URL("./hero-return.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
