// Writes experience.json and experience-fallback.json (R45.2, rewritten for round 7 in R53.2): the Mars map's two states on the
// production build (:5180).
//   node scripts/audit/make-experience.mjs
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/experience.json <fresh outdir>
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/experience-fallback.json <fresh outdir>
// Use a fresh outdir for every run: the page response is cached for five minutes in the browser profile kept there.
// Checks (each eval prints a JSON line; `ok` is true when it passes):
//   the overview at 1440 x 900 (dpr 2): the engine is on and the heights are read, the picture covers the stage, the summit is
//   where the preview puts it (47 px right of the middle at 1440), and the engine's first placing of the plane is the same place
//   the page's CSS gave it (the inline size and transform removed: the plane's box moves under 0.5 px);
//   the change in and out (3.6 s and 3.2 s): the page's own frame gaps from the click (rAF sampled in the page), the engine's trace
//   of every frame (`window.__expTrace`: k, the camera's height on the screen, the tilt, the target, the zoom) never reversing,
//   no frame over 20 ms (dpr 2) and, with the CPU 4 times slower, none over 34 ms; pictures of both states and of the change half
//   way (frames of a screencast);
//   reduced motion: the plane's transform never changes through the change (no camera travel), the picture fades out and the night
//   map comes in, and it is over in about 0.7 s;
//   a phone (390 x 844, dpr 3): both states, inside the screen;
//   a client-side change into /experience frozen mid-reveal (the debug hook `__hold`): the arriving page already shows the picture
//   (the plane covers the stage, the image is decoded), the engine is pending and there is no fallback list (R46.1's I1 again).
//   R53.3 (Task 18): the milestones, the card and the camera's rules: clicking milestones 6, 5, 4 and 2 in turn moves the camera on none and
//   1 and 8 do (every move writes rows to the trace); no frame in which a visible card's text changes (sampled every frame through a
//   stress of 12 presses a tenth of a second apart); no bead under a settled card at full strength, for each of the nine, and the card
//   inside the screen; frame gaps in My climb with the radar on (at rest, and while the arrow keys step through the milestones; CPU 1 and
//   4 times slower); a press of a bead in the overview goes into My climb at that milestone, the arrow keys and Esc, the label on
//   hover, the 44 px target; pictures of My climb with a card at 1440 x 900 and 390 x 844 (tracked: the map has no thumbnails).
//   R53.3b (Task 18's fix round): a second press during the change in keeps the move (k's step does not stall); the arrow keys move the focus with
//   the selection and the focused bead shows its ring (picture r53-3b-bead-focus); the label of a bead opens to the left in the right half and
//   stays on the screen (1440 x 900 and 390 x 844); under reduced motion a step to a milestone the camera must travel to dips the layers and draws
//   the night map again at the new place.
//   R53.4 (Task 19, make-experience-chart.mjs): the words, the phones, the chart layer and its frame, the keyboard and the screen-reader
//   list, the carry-overs of Task 18's re-review (the focus ring, the label's side) and the weight of a first load; the fallback file
//   also reads that the frame's canvas holds no ink where the map is not drawn.
// experience-fallback.json: no canvas, less data (the picture and the list), a picture that fails (the list, no picture), heights that fail
//   (the list, the picture stays).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chartSteps } from "./make-experience-chart.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const PAGE = `document.querySelector('.map-page')`;
const STAGE = `document.querySelector('.map-stage')`;
const PLANE = `document.querySelector('.map-plane')`;
const sleep = `const sleep=ms=>new Promise(r=>setTimeout(r,ms));`;
const rect = `const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom}};`;
const switchTo = (name) => `(()=>{const b=[...document.querySelectorAll('.map-mode-button')].find(x=>x.textContent==='${name}').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`;
const press = (name) => `[...document.querySelectorAll('.map-mode-button')].find(x=>x.textContent==='${name}').click()`;

// Frame gaps (rAF sampled in the page) and the engine's trace, from a click of the switch until `ms` later.
const MONO = `const mono=(rows,i,dir)=>rows.every((r,j)=>j===0||(r[i]-rows[j-1][i])*dir>=-1e-6);`;
const change = (to, ms, label, limit, extra = "") => ({
  eval: `(async()=>{${sleep}${MONO}window.__expTrace=[];const g=[];const cb=[];const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(t=>{const s0=performance.now();fn(t);cb.push(performance.now()-s0)});
let last=performance.now(),run=true;const f=n=>{g.push(n-last);last=n;if(run)raf(f)};raf(f);
${press(to)};await sleep(${ms});run=false;await sleep(50);window.requestAnimationFrame=raf;const cs=[...cb].sort((a,b)=>a-b);const rows=window.__expTrace;g.splice(0,2);const s=[...g].sort((a,b)=>a-b);
const dir=${to === "My climb" ? 1 : -1};const tgt=[4,5,6].every(i=>{const d=Math.sign(rows[rows.length-1][i]-rows[0][i])||1;return mono(rows,i,d)});
const over=g.filter(x=>x>${limit}).length;${extra}
return JSON.stringify({engineFrames:rows.length,frames:g.length,p95:+s[Math.floor(s.length*.95)].toFixed(1),max:+s[s.length-1].toFixed(1),over${limit}:over,engineMsP95:+cs[Math.floor(cs.length*.95)].toFixed(1),engineMsMax:+cs[cs.length-1].toFixed(1),kEnd:rows[rows.length-1][1],
cameraHeight:mono(rows,2,dir),tilt:mono(rows,3,dir),zoom:mono(rows,7,dir),target:tgt,ok:over===0&&mono(rows,2,dir)&&mono(rows,3,dir)&&mono(rows,7,dir)&&tgt&&rows[rows.length-1][1]===${to === "My climb" ? 1 : 0}})})()`,
  label,
});

// `fitted`: a phone, where the engine frames the overview to fit the whole trail (R104), so the summit is not where the preview puts it and the CSS's first place is not the engine's.
const overviewChecks = (label, fitted = false) => ({
  eval: `(async()=>{${sleep}${rect}const p=${PAGE},st=${STAGE},pl=${PLANE};for(let i=0;i<40&&st.dataset.terrain!=='ready';i++)await sleep(100);
const a=R(pl),W=innerWidth,H=innerHeight,img=pl.querySelector('img');const inline=pl.style.cssText;pl.style.cssText='';const b=R(pl);pl.style.cssText=inline;
const S=Math.max(W/1000,H/650)*1.1,summitX=a.l+500*S*1.0,mid=W/2;
return JSON.stringify({engine:p.dataset.engine,mode:p.dataset.mode,terrain:st.dataset.terrain,covers:a.l<=0&&a.t<=0&&a.r>=W&&a.b>=H,image:[img.naturalWidth,img.naturalHeight,img.complete],
summitRight:Math.round(summitX-mid),summitOk:Math.abs(summitX-mid-30*S)<1.5,cssFirstPlace:{dl:+(a.l-b.l).toFixed(2),dt:+(a.t-b.t).toFixed(2),dr:+(a.r-b.r).toFixed(2),db:+(a.b-b.b).toFixed(2)},
cssSame:[a.l-b.l,a.t-b.t,a.r-b.r,a.b-b.b].every(x=>Math.abs(x)<0.5),switch:[...document.querySelectorAll('.map-mode-button')].map(x=>x.getAttribute('aria-pressed')),
fallbackLists:document.querySelectorAll('.map-fallback-list').length,ok:p.dataset.engine==='on'&&st.dataset.terrain==='ready'&&a.l<=0&&a.t<=0&&a.r>=W&&a.b>=H&&img.naturalWidth>0&&(${fitted}||(Math.abs(summitX-mid-30*S)<1.5&&[a.l-b.l,a.t-b.t,a.r-b.r,a.b-b.b].every(x=>Math.abs(x)<0.5)))})})()`,
  label,
});
const settled = (mode, label) => ({
  eval: `(async()=>{${sleep}await sleep(300);const p=${PAGE},pl=${PLANE},t=document.querySelector('.map-terrain');const cs=getComputedStyle;const night=+cs(${STAGE}).getPropertyValue('--night');
return JSON.stringify({mode:p.dataset.mode,planeOpacity:+cs(pl).opacity,terrainOpacity:+cs(t).opacity,night,pressed:[...document.querySelectorAll('.map-mode-button')].map(x=>x.getAttribute('aria-pressed')),
ok:p.dataset.mode==='${mode}'&&${mode === "climb" ? "+cs(pl).opacity===0&&+cs(t).opacity===1&&night===1" : "+cs(pl).opacity===1&&+cs(t).opacity===0&&night===0"}})})()`,
  label,
});

const desktop = (cpu) => [
  { size: [1440, 900], dpr: 2, cpu, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3000 },
  overviewChecks(`${cpu > 1 ? "CPU " + cpu + "x slower: " : ""}the overview at 1440 x 900 (dpr 2)`),
  ...(cpu > 1 ? [] : [{ shot: "r53-overview-1440x900-warm" }, { shot: "r53-overview-1440x900" }]),
  { eval: `(async()=>{${sleep}await sleep(200);return 'ok'})()` },
  change("My climb", 4300, `${cpu > 1 ? "CPU " + cpu + "x: " : ""}the change in: frame gaps, no reversal`, cpu > 1 ? 34 : 20),
  settled("climb", `${cpu > 1 ? "CPU " + cpu + "x: " : ""}My climb is settled (the picture gone, the night map on)`),
  ...(cpu > 1 ? [] : [{ shot: "r53-climb-1440x900-warm" }, { shot: "r53-climb-1440x900" }]),
  change("Overview", 3700, `${cpu > 1 ? "CPU " + cpu + "x: " : ""}the change out: frame gaps, no reversal`, cpu > 1 ? 34 : 20),
  settled("overview", `${cpu > 1 ? "CPU " + cpu + "x: " : ""}the overview is back`),
];

// Pictures of the change half way: a screencast of the move, the frames nearest 0.9 s, 1.8 s and 2.7 s kept.
const halfway = [
  { size: [1440, 900], dpr: 1, go: "{{BASE}}/experience", wait: 3000 },
  { eval: `(async()=>{${sleep}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);return 'ready'})()`, label: "heights ready" },
  { film: { ms: 4300, keep: "r53-change", ats: [900, 1800, 2700], eval: press("My climb") }, label: "film of the change in" },
];

// Reduced motion: nothing travels. The plane's transform is the same at every frame, the picture fades out and the night map comes in.
const reduced = [
  { size: [1440, 900], dpr: 1, cpu: 1, reduce: true, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3000 },
  { eval: `(async()=>{${sleep}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);const pl=${PLANE};const t0=pl.style.transform;const seen=new Set([t0]);const ops=[];let run=true;
const f=()=>{seen.add(pl.style.transform);ops.push(+pl.style.opacity);if(run)requestAnimationFrame(f)};requestAnimationFrame(f);const start=performance.now();${press("My climb")};
let end=0;for(let i=0;i<60;i++){await sleep(50);if(+pl.style.opacity===0&&!end){end=performance.now()-start}}run=false;
const t=document.querySelector('.map-terrain');return JSON.stringify({transforms:seen.size,sameTransform:seen.size===1,planeOpacityAtEnd:+pl.style.opacity,sawMiddle:ops.some(x=>x>0.05&&x<0.95),fadeMs:Math.round(end),terrainOpacity:+t.style.opacity,
ok:seen.size===1&&+pl.style.opacity===0&&+t.style.opacity===1&&end<1200&&ops.some(x=>x>0.05&&x<0.95)})})()`, label: "reduced motion: the picture stays flat, fades out; the night map fades in (about 0.7 s)" },
  { shot: "r53-climb-reduced-warm" },
  { shot: "r53-climb-reduced" },
  { eval: `(async()=>{${sleep}${press("Overview")};await sleep(1200);const pl=${PLANE};return JSON.stringify({planeOpacity:+pl.style.opacity,ok:+pl.style.opacity===1})})()`, label: "reduced motion: back to the overview in about 0.7 s" },
];

const phone = [
  { size: [390, 844], dpr: 3, mobile: true, touch: true, reduce: false, go: "{{BASE}}/experience", wait: 3000 },
  overviewChecks("the overview on a phone (390 x 844): the picture covers the stage (the framing is fitted to the trail, so the summit is not at the preview's place)", true),
  { shot: "r53-overview-390x844-warm" },
  { shot: "r53-overview-390x844" },
  { tap: switchTo("My climb") },
  settledAfterMs("climb", 4300, "a phone: My climb settles"),
  { shot: "r53-climb-390x844-warm" },
  { shot: "r53-climb-390x844" },
];
function settledAfterMs(mode, ms, label) {
  return { eval: `new Promise(r=>setTimeout(()=>{const p=${PAGE};r(JSON.stringify({mode:p.dataset.mode,ok:p.dataset.mode==='${mode}'&&+getComputedStyle(${PLANE}).opacity===${mode === "climb" ? 0 : 1}}))},${ms}))`, label };
}

// A client-side change into /experience never shows the fallback list, and the picture is already there (R46.1 I1, and round 7: the map is painted in the arriving page).
const HOLD_INIT = `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__hold=(to,t)=>new Promise(res=>{__ftChange(to);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>4000){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(document.getAnimations().length)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},9000)});
window.__jump=to=>new Promise(res=>{if(location.pathname===to){res(to);return}
 __ftChange(to);const iv=setInterval(()=>{__ftFinish();if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),1500)}},40);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},12000)});`;
const arriving = (label) => ({
  eval: `(()=>{${rect}const p=${PAGE},pl=p&&${PLANE},img=pl&&pl.querySelector('img'),a=pl&&R(pl),W=innerWidth,H=innerHeight;return JSON.stringify({path:location.pathname,engine:p&&p.dataset.engine,fallbackLists:document.querySelectorAll('.map-fallback-list').length,
image:img&&[img.naturalWidth,img.complete],covers:!!a&&a.l<=0&&a.t<=0&&a.r>=W&&a.b>=H,srList:document.querySelectorAll('.sr-only li').length,
ok:!!p&&p.dataset.engine==='pending'&&document.querySelectorAll('.map-fallback-list').length===0&&!!img&&img.complete&&img.naturalWidth>0&&!!a&&a.l<=0&&a.t<=0&&a.r>=W&&a.b>=H})})()`,
  label,
});
const settledAfter = (label) => ({
  eval: `new Promise(r=>setTimeout(()=>{const p=${PAGE};r(JSON.stringify({engine:p&&p.dataset.engine,fallbackLists:document.querySelectorAll('.map-fallback-list').length,ok:!!p&&p.dataset.engine==='on'&&document.querySelectorAll('.map-fallback-list').length===0}))},800))`,
  label,
});
const heldIntoMap = (size, dpr, mobile, tag) => [
  { size, dpr, mobile, touch: mobile, init: HOLD_INIT, go: "{{BASE}}/work", wait: 3000 },
  ...[0.1, 0.3, 0.6].flatMap((t) => [
    { eval: `__hold('/experience',${t})`, label: `hold the change into /experience at t=${t} (${tag})` },
    arriving(`${tag}, t=${t}: the arriving page shows the picture, no fallback list, the engine pending`),
    { wait: 120, shot: `r53-held-${tag}-${t}-warm` },
    { wait: 60, shot: `r53-held-${tag}-${t}` },
    { eval: "__release()", label: "release" },
    settledAfter(`${tag}, t=${t}: after the change the engine is on and there is still no fallback list`),
    { eval: "__jump('/work')", label: "back to /work" },
  ]),
];

// ---- Task 18: the milestones, the card and the camera's rules ----
const PINS = `const P=[...document.querySelectorAll('.map-pin')];const card=document.querySelector('.map-card');`;
const toClimb = (size, dpr, mobile, cpu = 1) => [
  { size, dpr, mobile, touch: mobile, cpu, reduce: false, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3000 },
  { eval: `(async()=>{${sleep}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);await sleep(300);${press("My climb")};await sleep(5200);return JSON.stringify({mode:${PAGE}.dataset.mode,cardOpacity:+getComputedStyle(document.querySelector('.map-card')).opacity})})()`, label: "into My climb" },
];
const cameraRules = {
  eval: `(async()=>{${sleep}${PINS}const out=[];for(const i of [5,4,3,1,0,7]){window.__expTrace.length=0;P[i].click();await sleep(2400);out.push({milestone:i+1,moved:window.__expTrace.length>0,rows:window.__expTrace.length})}
return JSON.stringify({out,ok:out.slice(0,4).every(o=>!o.moved)&&out[4].moved&&out[5].moved})})()`,
  label: "camera rules: milestones 6, 5, 4, 2 move it on none; 1 and 8 do",
};
const textNeverChanges = {
  eval: `(async()=>{${sleep}${PINS}const b0=card.querySelector('[data-on]');let prev=b0?b0.textContent:'',viol=0,frames=0,seen=0,run=true;const log=[];
const f=()=>{frames++;const op=+getComputedStyle(card).opacity;const b=card.querySelector('[data-on]');const t=b?b.textContent:'';if(t!==prev){if(op>0.001){viol++;log.push([frames,+op.toFixed(3),prev.slice(0,14),t.slice(0,14)])}prev=t}if(op>0.001)seen++;if(run)requestAnimationFrame(f)};requestAnimationFrame(f);
for(const i of [0,3,8,2,6,1,5,4,7,0,8,4]){P[i].click();await sleep(110+(i%3)*90)}await sleep(4600);run=false;
return JSON.stringify({frames,framesCardVisible:seen,framesWithChangedText:viol,log:log.slice(0,5),ok:viol===0&&seen>0&&prev.length>0})})()`,
  label: "no frame in which a visible card's text changes (12 quick presses)",
};
const coverage = (tag) => ({
  eval: `(async()=>{${sleep}${PINS}const res=[];
for(let i=0;i<9;i++){P[i].click();await sleep(i===0?4200:3000);const c=card.getBoundingClientRect(),op=+getComputedStyle(card).opacity,txt=card.querySelector('[data-on]').textContent.slice(0,22);
const cur=P.map((p,k)=>{const r=p.querySelector('.map-bead').getBoundingClientRect();return {k,x:r.x+r.width/2,y:r.y+r.height/2,op:+getComputedStyle(p).opacity}});
const under=cur.filter(q=>q.x>c.left&&q.x<c.right&&q.y>c.top&&q.y<c.bottom);
const dk=document.querySelector('[data-dock-glass]').getBoundingClientRect();const at=k=>{const r=P[k].querySelector('.map-bead').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)};const seen=k=>{const r=P[k].querySelector('.map-bead').getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>0&&x<innerWidth&&y>0&&y<innerHeight&&!(x>dk.left-12&&x<dk.right+12&&y>dk.top-12)};
const covered=P.map((p,k)=>k).filter(k=>P[k].hasAttribute('data-under')&&seen(k));const coveredReach=covered.filter(k=>{const e=at(k);return e!==null&&(e.closest('.map-pin')===P[k]||e.classList.contains('map-hit'))});const open=P.map((p,k)=>k).filter(k=>!P[k].hasAttribute('data-under')&&seen(k));const centresOwn=open.filter(k=>{const e=at(k);return e!==null&&e.classList.contains('map-hit')&&e.parentElement===P[k]});const stepped=cur.filter(q=>q.op<0.3).map(q=>q.k);const marked=P.map((p,k)=>k).filter(k=>P[k].hasAttribute('data-under'));
res.push({i:i+1,cardOpacity:op,rect:[c.left,c.top,c.right,c.bottom].map(Math.round),under:under.map(q=>[q.k+1,+q.op.toFixed(2)]),fullStrengthUnder:under.filter(q=>q.k!==i&&q.op>0.3).map(q=>q.k+1),ownUnder:under.some(q=>q.k===i),inside:c.left>=0&&c.top>=0&&c.right<=innerWidth&&c.bottom<=innerHeight,aboveDock:c.bottom<=document.querySelector('[data-dock-glass]').getBoundingClientRect().top+0.5,text:txt,covered:covered.map(k=>k+1),coveredReach:coveredReach.map(k=>k+1),open:open.length,centresOwn:centresOwn.length,markedMatchStepped:JSON.stringify(stepped)===JSON.stringify(marked)})}
return JSON.stringify({res:res.map(r=>JSON.stringify(r)),ok:res.every(r=>r.cardOpacity===1&&r.fullStrengthUnder.length===0&&r.inside&&r.aboveDock&&r.coveredReach.length===0&&r.centresOwn===r.open&&r.markedMatchStepped),coveredChecked:res.reduce((n,r)=>n+r.covered.length,0)})})()`,
  label: `${tag}: for each milestone the card is shown, inside the screen and above the dock, no other bead under it is at full strength, a bead under it cannot be pressed through it (elementFromPoint at its centre reaches no bead or hit area), and the other beads' centres still reach their own`,
});
const gapsInClimb = (tag, limit) => ({
  eval: `(async()=>{${sleep}${PINS}const g=[];let last=performance.now(),run=true;const f=n=>{g.push(n-last);last=n;if(run)requestAnimationFrame(f)};requestAnimationFrame(f);
const key=k=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
await sleep(4000);const rest=g.length;for(let i=0;i<9;i++){key('ArrowLeft');await sleep(900)}for(let i=0;i<9;i++){key('ArrowRight');await sleep(900)}await sleep(1500);run=false;await sleep(40);g.splice(0,2);
const a=g.slice(0,rest-2),b=g.slice(rest-2),st=x=>{const s=[...x].sort((p,q)=>p-q);return {n:x.length,p95:+s[Math.floor(s.length*.95)].toFixed(1),max:+s[s.length-1].toFixed(1),over${limit}:x.filter(v=>v>${limit}).length}};
return JSON.stringify({atRestWithRadar:st(a),steppingWithArrows:st(b),ok:st(a).over${limit}===0&&st(b).over${limit}===0})})()`,
  label: `${tag}: frame gaps in My climb with the radar on, at rest and stepping through the milestones (none over ${limit} ms)`,
});
const pressInOverview = [
  { size: [1440, 900], dpr: 2, cpu: 1, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3000 },
  { eval: `(async()=>{${sleep}${PINS}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);await sleep(300);
const sizes=P.map(p=>{const r=p.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]});const iconsHidden=P.every(p=>getComputedStyle(p.querySelector('svg')).opacity==='0');const names=P.map(p=>p.textContent);
P[3].click();await sleep(5000);const cur=P.findIndex(p=>p.hasAttribute('data-current'));
return JSON.stringify({mode:${PAGE}.dataset.mode,hitAreas:sizes.every(s=>s[0]>=44&&s[1]>=44),iconsHiddenInOverview:iconsHidden,namesAreLabels:names.every(n=>n.includes(':')),first:names[0],current:cur,ariaCurrent:P[3].getAttribute('aria-current'),cardText:card.querySelector('[data-on]').textContent.slice(0,40),cardOpacity:+getComputedStyle(card).opacity,
ok:${PAGE}.dataset.mode==='climb'&&cur===3&&sizes.every(s=>s[0]>=44&&s[1]>=44)&&iconsHidden&&+getComputedStyle(card).opacity===1})})()`, label: "a press of the fourth bead in the overview goes into My climb at that milestone (card shown, 44 px targets, no icons in the overview)" },
  { key: "ArrowLeft", vk: 37 },
  { eval: `(async()=>{${sleep}${PINS}await sleep(600);return JSON.stringify({current:P.findIndex(p=>p.hasAttribute('data-current')),ok:P.findIndex(p=>p.hasAttribute('data-current'))===2})})()`, label: "ArrowLeft steps back to the third" },
  { key: "ArrowRight", vk: 39 }, { key: "ArrowRight", vk: 39 },
  { eval: `(async()=>{${sleep}${PINS}await sleep(600);return JSON.stringify({current:P.findIndex(p=>p.hasAttribute('data-current')),ok:P.findIndex(p=>p.hasAttribute('data-current'))===4})})()`, label: "ArrowRight twice: the fifth" },
  { move: `(()=>{const r=document.querySelectorAll('.map-pin')[0].getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()` },
  { eval: `(async()=>{${sleep}${PINS}await sleep(500);const tip=P[0].querySelector('.map-pin-tip');return JSON.stringify({tip:tip.textContent,opacity:+getComputedStyle(tip).opacity,ok:+getComputedStyle(tip).opacity>0.9&&tip.textContent.includes(':')})})()`, label: "hovering a bead shows its label" },
  { key: "Escape", vk: 27 },
  { eval: `(async()=>{${sleep}${PINS}await sleep(4200);return JSON.stringify({mode:${PAGE}.dataset.mode,current:P.findIndex(p=>p.hasAttribute('data-current')),cardOpacity:+getComputedStyle(card).opacity,plane:+getComputedStyle(${PLANE}).opacity,ok:${PAGE}.dataset.mode==='overview'&&P.every(p=>!p.hasAttribute('data-current'))&&+getComputedStyle(card).opacity===0&&+getComputedStyle(${PLANE}).opacity===1})})()`, label: "Esc returns to the overview (no card, no chosen bead)" },
];
const cardPictures = (size, dpr, mobile, tag) => [
  ...toClimb(size, dpr, mobile),
  { eval: `(async()=>{${sleep}${PINS}P[3].click();await sleep(3500);return JSON.stringify({text:card.querySelector('[data-on]').textContent.slice(0,40),opacity:+getComputedStyle(card).opacity})})()`, label: `${tag}: milestone 4 chosen` },
  { shot: `r53-3-climb-card-${tag}-warm` },
  { shot: `r53-3-climb-card-${tag}` },
];
const taskEighteen = [
  ...toClimb([1440, 900], 2, false),
  cameraRules,
  textNeverChanges,
  coverage("1440 x 900"),
  ...cardPictures([1440, 900], 2, false, "1440x900"),
  ...cardPictures([390, 844], 3, true, "390x844"),
  ...toClimb([390, 844], 3, true).slice(0, 1),
  { eval: `(async()=>{${sleep}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);await sleep(300);${press("My climb")};await sleep(5200);return 'in'})()` },
  coverage("390 x 844"),
  // R104 / Task 19 fix round: the nine cards on the smallest and the shortest screens
  ...toClimb([320, 568], 2, true),
  coverage("320 x 568"),
  ...toClimb([844, 390], 2, true),
  coverage("844 x 390"),
  ...toClimb([1440, 900], 2, false), gapsInClimb("1440 x 900, dpr 2", 20),
  ...toClimb([1440, 900], 2, false, 4), gapsInClimb("CPU 4x slower, 1440 x 900, dpr 2", 34),
  ...pressInOverview,
];

// ---- Task 18, fix round 1 ----
const pressDuringEntry = [
  { size: [1440, 900], dpr: 2, reduce: false, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3000 },
  { eval: `(async()=>{${sleep}${PINS}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);await sleep(300);${press("My climb")};await sleep(1700);window.__expTrace.length=0;P[2].click();await sleep(3000);
const rows=window.__expTrace,ks=rows.map(r=>r[1]),st=ks.slice(1).map((v,i)=>v-ks[i]),peak=Math.max(...st),first=st.slice(0,6),mid=st.filter((d,i)=>ks[i]>0.55&&ks[i]<0.85);
return JSON.stringify({rows:rows.length,firstSteps:first.map(x=>+x.toFixed(4)),peak:+peak.toFixed(4),midMin:+Math.min(...mid).toFixed(4),kEnd:ks[ks.length-1],
ok:first.every(d=>d>0.5*peak)&&Math.min(...mid)>0.15*peak&&ks[ks.length-1]===1&&st.every(d=>d>=-1e-9)})})()`, label: "a press 1.7 s into the change in: k's step goes on at speed (no stall), ends at 1" },
];
const roving = [
  { eval: `(async()=>{${sleep}${PINS}await sleep(600);const cur=P.findIndex(p=>p.hasAttribute('data-current'));const ring=getComputedStyle(P[cur].querySelector('.map-bead'));
return JSON.stringify({cur,activeIsCurrent:document.activeElement===P[cur],outline:[ring.outlineStyle,ring.outlineWidth,ring.outlineColor,ring.outlineOffset],focusVisible:P[cur].matches(':focus-visible'),ok:document.activeElement===P[cur]&&ring.outlineStyle==='solid'&&P[cur].matches(':focus-visible')})})()`, label: "the arrow keys moved the focus to the chosen bead, which shows its ring" },
  { shot: "r53-3b-bead-focus-warm" },
  { shot: "r53-3b-bead-focus-1440x900" },
];
const tipsInside = (tag) => ({
  eval: `(async()=>{${sleep}${PINS}const out=P.map((p,i)=>{const t=p.querySelector('.map-pin-tip');t.style.transition='none';const b=t.getBoundingClientRect(),c=p.querySelector('.map-bead').getBoundingClientRect(),cx=c.x+c.width/2,on=cx>0&&cx<innerWidth;return {i:i+1,on,flip:p.style.getPropertyValue('--flip'),l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width),h:Math.round(b.height)}});
P.forEach(p=>p.querySelector('.map-pin-tip').style.transition='');
return JSON.stringify({out:out.map(o=>JSON.stringify(o)),ok:out.filter(o=>o.on).length>0&&out.filter(o=>o.on).every(o=>o.l>=0&&o.r<=innerWidth)})})()`,
  label: `${tag}: the label of every bead on the screen, wherever it opens, is inside the screen`,
});
const reducedStep = [
  { size: [1440, 900], dpr: 1, reduce: true, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3000 },
  { eval: `(async()=>{${sleep}${PINS}for(let i=0;i<40&&${STAGE}.dataset.terrain!=='ready';i++)await sleep(100);await sleep(300);${press("My climb")};await sleep(1600);
const cv=document.querySelector('.map-terrain'),hash=()=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let h=0;for(let i=0;i<d.length;i+=61)h=(h*31+d[i])|0;return h};
const box=document.querySelector('.map-pins'),h0=hash(),ops=[];let run=true;const f=()=>{ops.push(+getComputedStyle(box).opacity);if(run)requestAnimationFrame(f)};requestAnimationFrame(f);
P[0].click();await sleep(900);run=false;const h1=hash();const t=document.querySelector('.map-trail').getBoundingClientRect();
return JSON.stringify({min:Math.min(...ops),end:ops[ops.length-1],sawDip:Math.min(...ops)<0.2,terrainRedrawn:h0!==h1,planeTransformSame:true,ok:Math.min(...ops)<0.2&&ops[ops.length-1]===1&&h0!==h1})})()`, label: "reduced motion: a step to a far milestone dips the layers and the night map is drawn again at the new place" },
  { shot: "r53-3b-reduced-step-warm" },
  { shot: "r53-3b-reduced-step" },
];
const taskEighteenFix = [
  ...pressDuringEntry,
  ...toClimb([1440, 900], 2, false),
  { key: "ArrowLeft", vk: 37 }, { key: "ArrowLeft", vk: 37 },
  ...roving,
  tipsInside("1440 x 900"),
  ...toClimb([390, 844], 3, true),
  tipsInside("390 x 844"),
  ...reducedStep,
];

const experience = [
  ...desktop(1),
  ...halfway,
  ...desktop(4),
  ...reduced,
  ...phone,
  ...heldIntoMap([1440, 900], 1, false, "desktop"),
  ...heldIntoMap([390, 844], 2, true, "phone"),
  ...taskEighteen,
  ...taskEighteenFix,
  ...chartSteps,
];

const fallbackCheck = (label, want) => ({
  eval: `(async()=>{${sleep}await sleep(1500);const p=${PAGE},img=document.querySelector('.map-plane img'),list=document.querySelector('.map-fallback-list');
const ink=c=>{try{const x=c&&c.getContext('2d');return !!x&&x.getImageData(0,0,c.width,c.height).data.some(v=>v!==0)}catch(e){return false}};
const stale={trail:ink(document.querySelector('.map-trail')),radar:ink(document.querySelector('.map-radar')),terrain:ink(document.querySelector('.map-terrain')),frame:ink(document.querySelector('.map-frame'))};
const beads=document.querySelectorAll('.map-pin').length,card=document.querySelectorAll('.map-card').length,buttons=[...document.querySelectorAll('main button')].filter(b=>!b.closest('[hidden]')).length;
return JSON.stringify({engine:p.dataset.engine,picture:img?[img.naturalWidth,img.complete]:null,list:list?list.querySelectorAll('li').length:0,switch:document.querySelectorAll('.map-mode').length,terrain:${STAGE}.dataset.terrain??null,
srList:document.querySelectorAll('.sr-only li').length,beads,card,mainButtons:buttons,stale,ok:p.dataset.engine==='off'&&!!list&&list.querySelectorAll('li').length===9&&document.querySelectorAll('.map-mode').length===0&&beads===0&&card===0&&!stale.trail&&!stale.radar&&!stale.terrain&&!stale.frame&&${want}})})()`,
  label,
});
const fallback = (query, init, label) => [
  { size: [1440, 900], dpr: 1, init, go: `{{BASE}}/experience?${query}`, wait: 2500 },
  fallbackCheck(label, "!!img&&img.naturalWidth>0"),
  { shot: `r53-fallback-${query}` },
];
const failing = (query, match, label, want) => [
  { size: [1440, 900], dpr: 1, nocache: true, intercept: [{ match, fail: "Failed" }], go: `{{BASE}}/experience?${query}`, wait: 3500 },
  fallbackCheck(label, want),
  { shot: `r53-fallback-${query}` },
  { intercept: [] },
];

writeFileSync(path.join(dir, "experience.json"), JSON.stringify(experience, null, 1) + "\n");
writeFileSync(
  path.join(dir, "experience-fallback.json"),
  JSON.stringify(
    [
      ...fallback("nocanvas", `if(location.search==='?nocanvas'){HTMLCanvasElement.prototype.getContext=function(){return null}}`, "no canvas: the picture and the list, no switch"),
      ...fallback("savedata", `if(location.search==='?savedata'){Object.defineProperty(navigator,'connection',{value:{saveData:true}})}`, "less data: the picture and the list, no switch"),
      ...failing("nopicture", "/mars/relief", "the picture fails: the list, no picture, no switch", "!img"),
      ...failing("noheights", "heights.png", "the heights fail: the list, the picture stays, no switch", "!!img&&img.naturalWidth>0"),
    ],
    null,
    1,
  ) + "\n",
);
console.log("wrote experience.json and experience-fallback.json");
