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
// experience-fallback.json: no canvas, less data (the picture and the list), a picture that fails (the list, no picture), heights that fail
//   (the list, the picture stays).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const overviewChecks = (label) => ({
  eval: `(async()=>{${sleep}${rect}const p=${PAGE},st=${STAGE},pl=${PLANE};for(let i=0;i<40&&st.dataset.terrain!=='ready';i++)await sleep(100);
const a=R(pl),W=innerWidth,H=innerHeight,img=pl.querySelector('img');const inline=pl.style.cssText;pl.style.cssText='';const b=R(pl);pl.style.cssText=inline;
const S=Math.max(W/1000,H/650)*1.1,summitX=a.l+500*S*1.0,mid=W/2;
return JSON.stringify({engine:p.dataset.engine,mode:p.dataset.mode,terrain:st.dataset.terrain,covers:a.l<=0&&a.t<=0&&a.r>=W&&a.b>=H,image:[img.naturalWidth,img.naturalHeight,img.complete],
summitRight:Math.round(summitX-mid),summitOk:Math.abs(summitX-mid-30*S)<1.5,cssFirstPlace:{dl:+(a.l-b.l).toFixed(2),dt:+(a.t-b.t).toFixed(2),dr:+(a.r-b.r).toFixed(2),db:+(a.b-b.b).toFixed(2)},
cssSame:[a.l-b.l,a.t-b.t,a.r-b.r,a.b-b.b].every(x=>Math.abs(x)<0.5),switch:[...document.querySelectorAll('.map-mode-button')].map(x=>x.getAttribute('aria-pressed')),
fallbackLists:document.querySelectorAll('.map-fallback-list').length,ok:p.dataset.engine==='on'&&st.dataset.terrain==='ready'&&a.l<=0&&a.t<=0&&a.r>=W&&a.b>=H&&img.naturalWidth>0&&Math.abs(summitX-mid-30*S)<1.5&&[a.l-b.l,a.t-b.t,a.r-b.r,a.b-b.b].every(x=>Math.abs(x)<0.5)})})()`,
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
  overviewChecks("the overview on a phone (390 x 844)"),
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

const experience = [
  ...desktop(1),
  ...halfway,
  ...desktop(4),
  ...reduced,
  ...phone,
  ...heldIntoMap([1440, 900], 1, false, "desktop"),
  ...heldIntoMap([390, 844], 2, true, "phone"),
];

const fallbackCheck = (label, want) => ({
  eval: `(async()=>{${sleep}await sleep(1500);const p=${PAGE},img=document.querySelector('.map-plane img'),list=document.querySelector('.map-fallback-list');
return JSON.stringify({engine:p.dataset.engine,picture:img?[img.naturalWidth,img.complete]:null,list:list?list.querySelectorAll('li').length:0,switch:document.querySelectorAll('.map-mode').length,terrain:${STAGE}.dataset.terrain??null,
srList:document.querySelectorAll('.sr-only li').length,ok:p.dataset.engine==='off'&&!!list&&list.querySelectorAll('li').length===9&&document.querySelectorAll('.map-mode').length===0&&${want}})})()`,
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
      ...failing("nopicture", "relief.webp", "the picture fails: the list, no picture, no switch", "!img"),
      ...failing("noheights", "heights.png", "the heights fail: the list, the picture stays, no switch", "!!img&&img.naturalWidth>0"),
    ],
    null,
    1,
  ) + "\n",
);
console.log("wrote experience.json and experience-fallback.json");
