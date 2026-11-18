// R58 step 7, no step at a tile swap (plan 2026-11-17-round7-edge-look, Task 32): home to the portfolio at 1440 by 900, filmed in real time
// (every frame the compositor makes, a screencast), three times. A recorder in the page (a MutationObserver on the bend filters' map pictures)
// notes the moment each map picture's `href` changes: that is the frame in which the bend's tile changes (glass-run.ts writes it from the
// animation frame, and only then). Each film frame is reduced to 160 by 100 grey levels and its mean absolute difference to the frame before
// it is kept (`d`). For each swap the frame it shows in is the first whose time is at or after the swap; because the two clocks can be a frame
// apart, the ratio is taken as the largest over that frame and the one each side: ratio = d / mean(d of the two neighbours), floored at 0.2
// grey levels. The target is at most 1.5 at every swap. Run with the lock:
//   node scripts/audit/make-tile-swaps.mjs                      writes tile-swaps.json
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/tile-swaps.json <outdir> > <out.txt>
// The lines whose label starts with `swaps` carry the numbers: every film frame (time since the click, mean absolute difference to the frame
// before) and every write of the map picture's source (time since the click, the linear progress, the front's radius through the app's ease and the tile), and whether the tiles recovered strictly increase (`strictlyIncreasing`: the audit's own check). NOBEND=1 writes the
// control (the tab's own rule `ft-glass-bend=off`: the same change with no bend, so no tile swaps of the bend), and sum-tile-swaps.mjs puts the two together.
import { writeFileSync } from "node:fs";
import { GENERATED } from "./generated-png.mjs";
import { sourceNumber } from "./glass-constants.mjs";

// the numbers the in-page report needs to name the tile and the front's radius at each swap, read from the app's own source
const STEP = sourceNumber("app/components/page-change/glass-field.ts", /BEND_EARLY_STEP\s*=\s*([\d.]+)/, "BEND_EARLY_STEP");
const FIRST = sourceNumber("app/components/page-change/glass-field.ts", /BEND_FIRST\s*=\s*(-?[\d.]+)/, "BEND_FIRST");
const HAND = sourceNumber("app/components/page-change/glass-field.ts", /HAND_OVER\s*=\s*([\d.]+)/, "HAND_OVER");
const RATIO = sourceNumber("app/components/page-change/glass-field.ts", /TILE_RATIO\s*=\s*([\d.]+)/, "TILE_RATIO");
const BAND = sourceNumber("app/components/page-change/glass-math.ts", /band:\s*([\d.]+)/, "GLASS.band");
const WARP = sourceNumber("app/components/page-change/glass-math.ts", /WARP\s*=\s*([\d.]+)/, "WARP");
const UNC = sourceNumber("app/components/page-change/glass-math.ts", /UNCOVERED_AT\s*=\s*([\d.]+)/, "UNCOVERED_AT");
const TOP = sourceNumber("app/components/page-change/glass-field.ts", /TILE_TOP\s*=\s*([\d.]+)/, "TILE_TOP");

const init = (consts) => `
window.__K=${JSON.stringify(consts)};
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1');${consts.noBend?"sessionStorage.setItem('ft-glass-bend','off')":''}}catch(e){}
window.__sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.__wait=(f,ms)=>new Promise(res=>{const t0=performance.now();const iv=setInterval(()=>{let v=false;try{v=f()}catch(e){}if(v||performance.now()-t0>ms){clearInterval(iv);res(!!v)}},50)});
window.__jump=to=>new Promise(res=>{if(location.pathname===to){res(to);return}
 __ftChange(to);const iv=setInterval(()=>{__ftFinish();if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),1500)}},40);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},12000)});
// the recorder: the moments the bend's map pictures change their source (epoch ms), with the glass animation's LINEAR progress then (the animation's
// timing function is the keyframes' own easing, so getComputedTiming().progress is the time fraction: the report applies the app's ease, R58 fix round I2)
window.__swapRec=()=>{window.__swaps=[];window.__frames=[];window.__fprev=null;window.__swapObs?.disconnect();
 const maps=['ft-glass-old-map','ft-glass-new-map'].map(id=>document.getElementById(id));
 window.__swapObs=new MutationObserver(list=>{for(const m of list){if(m.target.id!=='ft-glass-old-map')continue;
  const a=document.getAnimations().find(x=>x.animationName==='glass-p');const p=a?a.effect.getComputedTiming().progress:null;
  window.__swaps.push({t:Date.now(),p})}});
 for(const m of maps){if(m)window.__swapObs.observe(m,{attributes:true,attributeFilter:['href']})}
 return maps.map(Boolean)};
// run on every film frame (cdp.mjs film.analyze)
window.__fd=async(b64,meta)=>{const bmp=await createImageBitmap(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'image/jpeg'}));
 const c=new OffscreenCanvas(160,100),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,160,100);const d=x.getImageData(0,0,160,100).data;
 const g=new Float32Array(160*100);for(let i=0;i<g.length;i++)g[i]=0.2126*d[i*4]+0.7152*d[i*4+1]+0.0722*d[i*4+2];
 let diff=null;if(window.__fprev){let s=0;for(let i=0;i<g.length;i++)s+=Math.abs(g[i]-window.__fprev[i]);diff=s/g.length}
 window.__fprev=g;window.__frames.push({ts:meta.ts,d:diff})};
// the frame numbers round a swap (for a film strip): the swap that writes the tile numbered tile (the first such), two frames before to two after
window.__swapFrames=tile=>{const R=JSON.parse(__swapReport());const s=R.swaps.slice(1).find(x=>x.tile===tile);if(!s)return[];let i=R.frames.findIndex(f=>f[0]>=s.sinceClickMs);if(i<0)return[];return[i-2,i-1,i,i+1,i+2]};
window.__swapReport=()=>{const F=window.__frames,K=window.__K,A=window.__clickAt;
 const ease=t=>{const bz=(u,a,b)=>{const v=1-u;return 3*a*v*v*u+3*b*v*u*u+u*u*u};let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(bz(m,0.65,0.35)<t)lo=m;else hi=m}return bz((lo+hi)/2,0,1)};
 const start=-K.band,clear=(1+K.band)/(1-K.warp),span=(clear-start)/ease(K.unc);const nEarly=Math.ceil((K.hand-K.first)/K.step-1e-9);
 let nLadder=0;for(let r=K.hand;;r*=K.ratio){nLadder++;if(r>=K.top)break}
 // the app's own arithmetic (glass-run.ts: frontAt(t) = easeGlass first; glass-field.ts: pickBendTile, the ladder clamped to its last tile)
 const radiusAt=p=>start+ease(p)*span;const tileAt=r=>r<K.hand?Math.min(nEarly-1,Math.max(0,Math.round((r-K.first)/K.step))):nEarly+Math.min(nLadder-1,Math.max(0,Math.round(Math.log(r/K.hand)/Math.log(K.ratio))));
 const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};const bendAt=p=>sm(0.05,0.15,ease(p))*(1-sm(0.93,1,ease(p)));
 const swaps=window.__swaps.map((s,k)=>{const r=s.p==null?null:radiusAt(s.p);return{k,sinceClickMs:Math.round(s.t-A),p:s.p==null?null:+s.p.toFixed(3),front:r==null?null:+r.toFixed(3),tile:r==null?null:tileAt(r),bend:s.p==null?null:+bendAt(s.p).toFixed(2)}});
 // the audit checks itself: a swap is a write of a NEW tile, so the recovered tiles must strictly increase (a repeat or a step back means the labels are wrong)
 const tiles=swaps.map(x=>x.tile);const notIncreasing=[];for(let i=1;i<tiles.length;i++)if(!(tiles[i]>tiles[i-1]))notIncreasing.push({k:i,tile:tiles[i],after:tiles[i-1]});
 const skipped=[];for(let i=1;i<tiles.length;i++)if(tiles[i]>tiles[i-1]+1)skipped.push({k:i,from:tiles[i-1],to:tiles[i]});
 // every film frame: the film time since the click, and the mean absolute difference to the frame before it (grey levels, 0 to 255)
 const frames=F.map((f,i)=>[Math.round(f.ts-A),i&&f.d!=null?+f.d.toFixed(3):null]);
 return JSON.stringify({clickAt:A,frames,swaps,strictlyIncreasing:notIncreasing.length===0,notIncreasing,skipped})};
`.trim();

const CLICK = "window.__clickAt=Date.now();document.querySelector('a[href=\"/work\"]').click()";
const RUNS = Number(process.env.RUNS ?? 3);
// STRIP=<tile,tile,...>: after the runs, one more film saves the frames round the swap that writes each of those tiles (a film strip at full quality, for a look by eye)
const STRIP = (process.env.STRIP ?? "").split(",").filter(Boolean).map(Number);
const film = (n) => [
  { label: `run ${n}: back to home (the hook)`, eval: "__jump('/')" },
  { wait: 800 },
  { label: `run ${n}: recorder armed (old and new map found)`, eval: "JSON.stringify(__swapRec())" },
  {
    label: `film ${n}: home to the portfolio in real time`,
    film: { ms: 3400, eval: CLICK, analyze: "window.__fd", quality: 70 },
  },
  { label: `swaps ${n}`, eval: "__swapReport()" },
];
const steps = [
  { size: [1440, 900], dpr: 1, init: init({ noBend: process.env.NOBEND === "1", step: STEP, first: FIRST, hand: HAND, ratio: RATIO, top: TOP, band: BAND, warp: WARP, unc: UNC }), intercept: GENERATED, go: "{{BASE}}/", wait: 6000 },
  { label: "wait for glass-warm", eval: "__wait(()=>performance.getEntriesByName('glass-warm').length>=1,30000)" },
  ...Array.from({ length: RUNS }, (_, i) => film(i + 1)).flat(),
  ...(STRIP.length
    ? [
        { label: "strip: back to home", eval: "__jump('/')" },
        { wait: 800 },
        { label: "strip: recorder armed", eval: "JSON.stringify(__swapRec())" },
        {
          label: "strip: the film, frames round the swaps of the tiles named",
          film: { ms: 3400, eval: CLICK, analyze: "window.__fd", quality: 92, keep: "strip", idxs: `[${STRIP.map((t) => `...__swapFrames(${t})`).join(",")}]` },
        },
        { label: "swaps strip", eval: "__swapReport()" },
      ]
    : []),
];
writeFileSync(new URL("./tile-swaps.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
console.log(`tile-swaps.json: ${steps.length} steps, ${RUNS} runs`);
