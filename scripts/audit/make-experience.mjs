// Writes experience.json and experience-fallback.json (R45.2): the Mars map on the production build (:5180).
//   node scripts/audit/make-experience.mjs
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/experience.json <fresh outdir>
//   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/experience-fallback.json <fresh outdir>
// Use a fresh outdir for every run: the page response is cached for five minutes in the browser profile kept there.
// Checks (each eval prints a JSON line; `ok` is true when it passes):
//   overview: cliff ring between 72% and 84% of the smaller side (0.67 of the picture, the ring's width in
//   view.ts, checked against the content file by schemas-experience.test.ts), summit within 2% of the centre,
//   first tiles painted within 300 ms of the page change ending (`data-painted`), canvas backing size;
//   wheel in enters explore (about 2 times the fit scale); panning to each edge stops at the frame;
//   frame gaps while panning and zooming (synthetic pointer and wheel events from the page, 16 ms apart, rAF sampled);
//   keys +, -, 0, Escape, arrows, the buttons, a double click; the heading block fading out in explore;
//   a last run with the CPU 4 times slower at dpr 2 (reported only);
//   reduced motion (the move is instant); phone overview, a double tap and a drag.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const PAGE = `document.querySelector('.map-page')`;
// the view from the CSS variables, and the screen
const VIEW = `(()=>{const e=${PAGE},c=getComputedStyle(e),vw=innerWidth,vh=innerHeight,s=+c.getPropertyValue('--map-s'),cx=+c.getPropertyValue('--map-cx'),cy=+c.getPropertyValue('--map-cy');return {e,vw,vh,s,cx,cy,fit:0.78*Math.min(vw,vh)/(0.67*8192)}})()`;
// wait until the view has stopped changing (three reads 120 ms apart)
const SETTLE = `const settle=async()=>{let last='',n=0;for(let i=0;i<60;i++){const v=${VIEW};const k=[v.cx,v.cy,v.s].join();n=k===last?n+1:0;last=k;if(n>=3)return v;await new Promise(r=>setTimeout(r,120))}return ${VIEW}};`;
const out = (body) => `(async()=>{${SETTLE}${body}})()`;
const round = (x, d = 2) => `+(${x}).toFixed(${d})`;

const overview = (label) => ({
  eval: out(`const v=await settle(),ring=0.67*8192*v.s/Math.min(v.vw,v.vh),dx=(8192/2-v.cx)*v.s/Math.min(v.vw,v.vh),dy=(8192/2-v.cy)*v.s/Math.min(v.vw,v.vh),painted=+v.e.dataset.painted;return JSON.stringify({engine:v.e.dataset.engine,mode:v.e.dataset.mode,ring:${round("ring", 3)},ringOk:ring>=0.72&&ring<=0.84,summitOffset:[${round("dx", 4)},${round("dy", 4)}],summitOk:Math.abs(dx)<=0.02&&Math.abs(dy)<=0.02,paintedMs:painted,paintedOk:painted<300,canvas:[document.querySelector('.map-canvas').width,document.querySelector('.map-canvas').height],seedHidden:getComputedStyle(document.querySelector('.map-seed')).visibility})`),
  label,
});
const mode = (label, want, ratio) => ({
  eval: out(`const v=await settle();return JSON.stringify({mode:v.e.dataset.mode,want:'${want}',ratio:${round("v.s/v.fit", 3)},ok:v.e.dataset.mode==='${want}'${ratio ? `&&Math.abs(v.s/v.fit-${ratio})<0.02` : ""}})`),
  label,
});
const center = (id) => `(()=>{const r=document.querySelector('${id}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`;
const edgeIs = (label, side) => ({
  eval: out(`const v=await settle(),hw=v.vw/(2*v.s),hh=v.vh/(2*v.s),at={left:v.cx-hw,right:8192-(v.cx+hw),top:v.cy-hh,bottom:8192-(v.cy+hh)};return JSON.stringify({${side}:${round(`at.${side}`)},ok:Math.abs(at.${side})<1,others:'inside',inside:Object.values(at).every(x=>x>=-0.5)})`),
  label,
});
// the page's own frame gaps while synthetic input runs (rAF sampled in the same eval)
const GAPS = (label, drive) => ({
  eval: `(async()=>{const el=${PAGE};const g=[];let l=performance.now(),run=true;const f=n=>{g.push(n-l);l=n;if(run)requestAnimationFrame(f)};requestAnimationFrame(f);const sleep=ms=>new Promise(r=>setTimeout(r,ms));const pe=(t,x,y)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:7,pointerType:'mouse',button:0,buttons:t==='pointerup'?0:1,clientX:x,clientY:y}));const we=(x,y,d)=>el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:x,clientY:y,deltaY:d}));${drive}run=false;await sleep(50);g.splice(0,2);g.sort((a,b)=>a-b);return JSON.stringify({frames:g.length,p95:+g[Math.floor(g.length*.95)].toFixed(1),max:+g[g.length-1].toFixed(1),over20:g.filter(x=>x>20).length,ok:g.filter(x=>x>20).length===0})})()`,
  label,
});

const desktop = [
  { size: [1440, 900], dpr: 1, go: "{{BASE}}/experience", wait: 2500 },
  overview("desktop overview"),
  { eval: `JSON.stringify({heading:getComputedStyle(document.querySelector('.map-heading')).opacity,caption:getComputedStyle(document.querySelector('.map-caption')).opacity,dockCurrent:document.querySelector('[data-work-tab="/experience"]').getAttribute('aria-current'),ground:getComputedStyle(${PAGE}).backgroundColor,buttons:[...document.querySelectorAll('.map-button')].map(b=>b.getAttribute('aria-label')+(b.disabled?' (off)':'')),moments:document.querySelectorAll('.sr-only li').length})`, label: "overview page" },
  { shot: "r45-map-warm" },
  { shot: "r45-map-desktop-overview" },
  // wheel in enters explore
  { wheel: [720, 450, 0, -120, 1] },
  mode("wheel in enters explore (2 times the fit scale)", "explore", 2),
  { eval: `new Promise(r=>setTimeout(()=>r(JSON.stringify({heading:getComputedStyle(document.querySelector('.map-heading')).opacity,caption:getComputedStyle(document.querySelector('.map-caption')).opacity,ok:getComputedStyle(document.querySelector('.map-heading')).opacity==='0'})),700))`, label: "heading and caption fade out in explore" },
  { shot: "r45-map-warm2" },
  { shot: "r45-map-desktop-explore" },
  // panning to each edge stops at the frame (real mouse drags, far past the edge)
  { mdrag: [100, 450, 1400, 450, 12] },
  { mdrag: [100, 450, 1400, 450, 12] },
  edgeIs("pan to the left edge", "left"),
  { mdrag: [1400, 450, 100, 450, 12] },
  { mdrag: [1400, 450, 100, 450, 12] },
  { mdrag: [1400, 450, 100, 450, 12] },
  edgeIs("pan to the right edge", "right"),
  { mdrag: [720, 20, 720, 880, 12] },
  { mdrag: [720, 20, 720, 880, 12] },
  { mdrag: [720, 20, 720, 880, 12] },
  edgeIs("pan to the top edge", "top"),
  { mdrag: [720, 880, 720, 20, 12] },
  { mdrag: [720, 880, 720, 20, 12] },
  { mdrag: [720, 880, 720, 20, 12] },
  { mdrag: [720, 880, 720, 20, 12] },
  edgeIs("pan to the bottom edge", "bottom"),
  { shot: "r45-map-warm3" },
  { shot: "r45-map-desktop-edge" },
  // zoom in about the pointer to the native size, then out to explore's start
  { wheel: [720, 450, 0, -240, 30] },
  { eval: out(`const v=await settle();return JSON.stringify({scale:v.s,max:v.s<=1.0001&&v.s>0.99,mode:v.e.dataset.mode})`), label: "zoom in stops at the native size (scale 1)" },
  { shot: "r45-map-warm4" },
  { shot: "r45-map-desktop-native" },
  GAPS("frame gaps while panning (90 moves) and zooming (60 wheel events) in explore", `pe('pointerdown',900,450);for(let i=0;i<90;i++){pe('pointermove',900-i*5,450-i*2);await sleep(16)}pe('pointerup',450,270);for(let i=0;i<60;i++){we(700,450,i<30?-60:60);await sleep(16)}`),
  // keys and buttons back in the overview
  { key: "Escape", vk: 27 },
  mode("Escape goes back to the overview", "overview", 1),
  { key: "+", vk: 187 },
  mode("+ enters explore", "explore", 2),
  { key: "+", vk: 187 },
  { key: "-", vk: 189 },
  { key: "-", vk: 189 },
  mode("- twice goes back to the overview", "overview", 1),
  { key: "+", vk: 187 },
  mode("+ again", "explore", 2),
  { key: "ArrowRight", vk: 39 },
  { key: "ArrowDown", vk: 40 },
  { eval: out(`const v=await settle();return JSON.stringify({cx:${round("v.cx")},cy:${round("v.cy")},moved:v.cx>4096&&v.cy>4096})`), label: "arrow keys pan" },
  { key: "0", vk: 48 },
  mode("0 goes back to the overview", "overview", 1),
  { eval: out(`const v=await settle();return JSON.stringify({cx:${round("v.cx")},cy:${round("v.cy")},centred:Math.abs(v.cx-4096)<1&&Math.abs(v.cy-4096)<1})`), label: "the overview is centred again" },
  { click: center('[aria-label="Zoom in"]'), wait: 100 },
  mode("the + button enters explore", "explore", 2),
  { click: center('[aria-label="Zoom out"]'), wait: 100 },
  mode("the - button goes back to the overview", "overview", 1),
  { click: [720, 450] },
  { click: [720, 450] },
  mode("double click enters explore", "explore", 2),
  { click: center('[aria-label="Show the whole mountain"]'), wait: 100 },
  mode("the fit button goes back", "overview", 1),
  // wheel out at explore's start goes back; the quiet-gesture lock
  { wheel: [720, 450, 0, -120, 1] },
  mode("wheel in", "explore", 2),
  { wheel: [720, 450, 0, 120, 1], wait: 800 },
  mode("wheel out past 2 times goes back to the overview", "overview", 1),
  // the page changes still work into and out of the page (nav.json and dock-row.json cover the sequences)
  { eval: `JSON.stringify({requestsAreTiles:performance.getEntriesByType('resource').filter(e=>e.name.includes('/mars/')).length,mosaic:performance.getEntriesByType('resource').some(e=>e.name.includes('mosaic'))})`, label: "tiles requested (the mosaic is not)" },
  // a page change into the map (the dock row's link): the first tiles are painted within 300 ms of the change ending
  { go: "{{BASE}}/work", wait: 2500 },
  { eval: `document.querySelector('header[data-site-nav] [data-work-tab="/experience"]').click();1` },
  { wait: 2500 },
  overview("client-side change work to experience (paintedMs counts from the change ending)"),
  // reduced motion: the move is instant
  { reduce: true, go: "{{BASE}}/experience?reduced", wait: 2500 },
  { wheel: [720, 450, 0, -120, 1], wait: 150 },
  { eval: `JSON.stringify({mode:${PAGE}.dataset.mode,ratio:${round(`(+getComputedStyle(${PAGE}).getPropertyValue('--map-s'))/(0.78*Math.min(innerWidth,innerHeight)/(0.67*8192))`, 3)},instant:true})`, label: "reduced motion: wheel in is instant (read 150 ms later; 700 ms would still be moving)" },
  { reduce: false },
  // phone
  { size: [390, 844], dpr: 3, mobile: true, touch: true, go: "{{BASE}}/experience", wait: 2500 },
  overview("phone overview"),
  { shot: "r45-map-warm5" },
  { shot: "r45-map-phone-overview" },
  { tap: [195, 420], wait: 120 },
  { tap: [195, 420] },
  mode("double tap enters explore", "explore", 2),
  { drag: [300, 600, 100, 300, 10] },
  { eval: out(`const v=await settle();return JSON.stringify({cx:${round("v.cx")},cy:${round("v.cy")},panned:v.cx>4096&&v.cy>4096})`), label: "a drag pans" },
  { shot: "r45-map-warm6" },
  { shot: "r45-map-phone-explore" },
  GAPS("phone frame gaps while panning and zooming", `pe('pointerdown',300,600);for(let i=0;i<60;i++){pe('pointermove',300-i*3,600-i*4);await sleep(16)}pe('pointerup',120,360);for(let i=0;i<40;i++){we(195,420,i<20?-60:60);await sleep(16)}`),
  // the same on a slow processor (4 times slower): reported, not a pass mark
  { cpu: 4, size: [1440, 900], dpr: 2, mobile: false, touch: false, go: "{{BASE}}/experience", wait: 3000 },
  { wheel: [720, 450, 0, -120, 1] },
  mode("slow CPU: wheel in enters explore", "explore", 2),
  GAPS("slow CPU (4x), dpr 2: frame gaps while panning and zooming", `pe('pointerdown',900,450);for(let i=0;i<90;i++){pe('pointermove',900-i*5,450-i*2);await sleep(16)}pe('pointerup',450,270);for(let i=0;i<60;i++){we(700,450,i<30?-60:60);await sleep(16)}`),
];

const fallback = (query, label) => [
  { size: [1440, 900], dpr: 1, init: `if(location.search==='?${query}'){${query === "nocanvas" ? "HTMLCanvasElement.prototype.getContext=function(){return null}" : "Object.defineProperty(navigator,'connection',{value:{saveData:true}})"}}`, go: `{{BASE}}/experience?${query}`, wait: 2500 },
  { eval: `JSON.stringify({engine:${PAGE}.dataset.engine,mosaic:(()=>{const i=document.querySelector('.map-seed img');return i&&i.getAttribute('src')+' '+i.naturalWidth})(),canvasPainted:${PAGE}.dataset.painted??null,buttons:document.querySelectorAll('.map-button').length,tilesRequested:performance.getEntriesByType('resource').filter(e=>/\\/mars\\/[2-4]\\//.test(e.name)).length,ok:${PAGE}.dataset.engine==='off'})`, label },
  { shot: `r45-map-fallback-${query}` },
];

writeFileSync(path.join(dir, "experience.json"), JSON.stringify(desktop, null, 1) + "\n");
writeFileSync(path.join(dir, "experience-fallback.json"), JSON.stringify([...fallback("nocanvas", "no canvas: the mosaic image, no buttons, no fine tiles"), ...fallback("savedata", "less data: the mosaic image, no buttons, no fine tiles")], null, 1) + "\n");
console.log("wrote experience.json and experience-fallback.json");
