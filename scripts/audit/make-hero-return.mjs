// Writes scripts/audit/hero-return.json: the home page's picture through a page change (R49.1), on the production build.
// usage: node scripts/audit/make-hero-return.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/hero-return.json <outdir>
// Every `film` step photographs every frame the compositor produces (a screencast) from the moment the change to home starts
// until AFTER_MS past the change's end (the change's real length is read from the source: GLASS.ms in glass-math.ts, the
// reduced-motion fade in page-change.ts, so a longer change lengthens the film and moves the frames, never the other way round);
// a frame is bare when 75% of the cells of the hero's box (48 by 30 of them) are darker than luma 20 (a painting, even a dark one,
// stays under 55%; the bare ground and the black canvas are 98%+). `ok` must be true: no bare frame while the hero is visible.
// Each case prints its `darkShareMax`, the baseline to compare against after a change (see the Task 3 report for the numbers).
// The cases: a return (the intro was seen; Hero remembers its painting) and a first visit (landed on /work, nothing remembered: the
// blurred placeholder carries the change), each at full speed and with the CPU 6 times slower (so the work between the end of the
// change and the first engine frame is long: the picture must hold however long the change and the arrival take), by the dock, by
// Back, with reduced motion, and with a held change (the reveal frozen part way: the picture is already there). Then the order of the
// words through one painting change.
import { readFileSync, writeFileSync } from "node:fs";

/** A number read out of a source file, so the audit follows the app's own constants (it fails loudly when the source moved). */
function constant(file, re, what) {
  const m = re.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
  if (!m) throw new Error(`make-hero-return: cannot read ${what} from ${file}`);
  return Number(m[1]);
}
const CHANGE_MS = constant("../../app/components/page-change/glass-math.ts", /\bms:\s*(\d+)/, "GLASS.ms");
const REDUCED_CHANGE_MS = constant("../../app/lib/page-change.ts", /\bfade:\s*(\d+)\s*\}/, "the reduced-motion change length (MS.fade)");
/** How long the film runs past the change's end (the brief: at least 1.5 s; the bare frames came 0.4 s after the end on a slow CPU). */
const AFTER_MS = 3000;
const filmMs = (changeMs) => changeMs + AFTER_MS;
/** The frames saved are placed after the change's end: where the bare frame was (the end plus 0.18 s), and on a slow CPU (plus 0.49 s). */
const atAfter = (changeMs, after) => changeMs + after;
const base = (seen) => `try{${seen ? "sessionStorage.setItem('ft:intro-seen','1');" : ""}sessionStorage.setItem('ft:debug-change','1')}catch(e){}
${wordsRecorder}
window.__hold=(to,t)=>new Promise(res=>{__ftChange(to);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>${filmMs(CHANGE_MS)}){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(document.getAnimations().length)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},${CHANGE_MS + 5500})});`;
// A sampler for the first painting's words (Ruling R54): [time, phase, opacity, text length] every 16 ms, and its summary: the words
// must be hidden while the phase is `awaiting` (the painting is not up), and fade in (many in-between opacities, no jump) after it.
const wordsRecorder = `window.__wl=[];setInterval(()=>{const r=document.querySelector('#hero'),c=r&&r.querySelector('.caption');if(!c)return;
 window.__wl.push([Math.round(performance.now()),r.dataset.words||'',+(+getComputedStyle(c).opacity).toFixed(2),r.querySelector('.caption .t').textContent.length])},16);
window.__wsum=()=>{const l=window.__wl,i0=l.findIndex(r=>r[1]==='awaiting');if(i0<0)return{awaiting:false,ok:false};
 const aw=l.filter(r=>r[1]==='awaiting'),i1=l.findIndex((r,i)=>i>i0&&r[1]==='swapped');if(i1<0)return{awaiting:true,swapped:false,ok:false};
 const after=l.slice(i1).filter(r=>r[0]-l[i1][0]<1600);let step=0;for(let i=1;i<after.length;i++)step=Math.max(step,Math.abs(after[i][2]-after[i-1][2]));
 const hidden=aw.every(r=>r[2]<=0.05),mid=after.filter(r=>r[2]>0.05&&r[2]<0.95).length,end=after.at(-1)[2];
 return{awaitingMs:l[i1][0]-l[i0][0],hiddenWhileAwaiting:hidden,inBetweenSamples:mid,largestStep:+step.toFixed(2),endOpacity:end,ok:hidden&&mid>=5&&step<0.4&&end>=0.95}};`;
const toWork = "__ftChange('/work').then(()=>new Promise(r=>setTimeout(r,1500)))";
// the words log is cleared just before the change, so `__wsum` reads this change's own fade (not the hard load's)
const toHome = "(window.__wl.length=0,__ftChange('/'))";
const steps = [];
const wait = (ms) => ({ wait: ms });

/** Opens on `/` (seen) or `/work` (not seen); leaves the page on /work, ready for the change to home. */
function arrive(kind, o = {}) {
  steps.push({ size: [1440, 900], dpr: o.dpr ?? 1, reduce: !!o.reduce, cpu: 1, init: base(kind === "return"), go: "{{BASE}}" + (kind === "return" ? "/" : "/work"), wait: 7000 });
  if (kind === "return") steps.push({ eval: toWork, wait: 3500 });
  if (o.cpu) steps.push({ cpu: o.cpu, wait: 500 });
}
// `at`: the frame nearest that time is saved too (<keep>-at.jpg), just after the change: the home picture, where the bare frame was
const film = (label, keep, at, evalCode = toHome, changeMs = CHANGE_MS) =>
  steps.push({ film: { ms: filmMs(changeMs), rect: "#hero", eval: evalCode, keep, at }, label });
const state = (label) => steps.push({ label, eval: "JSON.stringify({path:location.pathname,still:(()=>{const s=document.querySelector('.paint-still');return s?(s.hidden?'hidden':'shown'):'none'})(),canvas:!!document.querySelector('.paint-host canvas'),intro:document.documentElement.classList.contains('intro'),words:document.querySelector('#hero')?.dataset.words||''})" });

const words = (label) => steps.push({ label, eval: "JSON.stringify(__wsum())" });
arrive("return"); film("return, dock, 1x: no bare frame", "return-darkest", atAfter(CHANGE_MS, 180)); state("return state"); words("return: words wait for the painting, then fade in (not pop)");
arrive("return", { cpu: 6 }); film("return, dock, CPU 6x: no bare frame", "return-slow-darkest", atAfter(CHANGE_MS, 490));
arrive("first"); film("first visit (landed on /work), dock, 1x: no bare frame", "first-darkest", atAfter(CHANGE_MS, 180)); state("first visit state"); words("first visit: words wait for the sharp painting (not the placeholder), then fade in");
arrive("first", { cpu: 6 }); film("first visit, dock, CPU 6x: no bare frame", "first-slow-darkest", atAfter(CHANGE_MS, 490));
arrive("return"); film("return by Back: no bare frame", "back-darkest", atAfter(CHANGE_MS, 180), "(window.__wl.length=0,history.back())");
arrive("return", { reduce: true }); film("return, reduced motion: no bare frame", "return-reduced-darkest", atAfter(REDUCED_CHANGE_MS, 280), toHome, REDUCED_CHANGE_MS);
arrive("first", { reduce: true }); film("first visit, reduced motion: no bare frame", "first-reduced-darkest", atAfter(REDUCED_CHANGE_MS, 280), toHome, REDUCED_CHANGE_MS);
arrive("return", { dpr: 2 }); film("return, dpr 2: no bare frame", "return-dpr2-darkest");

// held: the reveal frozen part way, the new page's picture is already there (the first visit has no remembered painting)
for (const kind of ["return", "first"]) {
  arrive(kind);
  for (const t of [0.3, 0.7]) {
    steps.push({ eval: `__hold('/',${t})`, label: `${kind} held at ${t}` });
    steps.push(wait(120), { shot: `${kind}-held-${t}-warm` }, wait(60), { shot: `${kind}-held-${t}` });
    steps.push({ film: { ms: 400, rect: "#hero", keep: `${kind}-held-${t}-darkest` }, label: `${kind} held at ${t}: no bare frame` });
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
  if(w==='swapped'&&!swappedAt&&log.some(l=>l[1]==='caption-out'))swappedAt=now;
  if(swappedAt&&now-swappedAt>1300){clearInterval(iv);clearTimeout(to);
   const at=n=>(log.find(l=>l[1]===n)||[])[0];const out=at('caption-out'),sw=at('swapping'),done=at('swapped');
   const hiddenDuring=op.filter(r=>r[1]==='swapping').every(r=>r[2]<=0.05);
   const firstVisibleAfterDone=op.find(r=>r[2]>0.1&&r[0]>=sw);
   res(JSON.stringify({phases:log,outMs:sw-out,swapMs:done-sw,hiddenDuringSwap:hiddenDuring,textChangedWhileHidden:txtAt.swapping!=null&&txtAt.swapping<done,textNow:t.textContent,firstVisibleAt:firstVisibleAfterDone&&firstVisibleAfterDone[0],doneAt:done,
    ok:out!=null&&sw!=null&&done!=null&&sw-out>=380&&sw-out<=480&&hiddenDuring&&done-sw>=2000&&firstVisibleAfterDone&&firstVisibleAfterDone[0]>=done-60}))}},40);
 const to=setTimeout(()=>{clearInterval(iv);res(JSON.stringify({error:'no painting change within 30 s',phases:log}))},30000)})`,
});
writeFileSync(new URL("./hero-return.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
