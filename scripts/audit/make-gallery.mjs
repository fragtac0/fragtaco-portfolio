// Writes scripts/audit/gallery.json: the checks of the two video walls (Task 11, R43.5). Needs the production build on :5180.
// usage: node scripts/audit/make-gallery.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/gallery.json <outdir>
//
// For both walls at 1440 by 900 (dpr 1), 1024 by 768 (geometry only) and 390 by 844 (dpr 3, touch):
//  - fit: every tile's box (the warped outline, plus 6 px for the drift) is inside the screen, clear of the
//    heading, the return mark and the dock (`minEdge`, `minHeading`, `minDock` must be 0 or more),
//  - hits: with reduced motion (no drift, so the answer is exact) clicks at 12 points (4 centres, 4 corners 5 px
//    inside the tile, 3 gaps, 1 screen corner) and at every tile centre open what the forward warp of the layout says
//    (the audit warps the tile outlines itself and does a point in polygon test; it does not use the engine's maths),
//  - frames: gaps between animation frames over 3 s of drifting and over 2.5 s of hovering across the wall (over20 must be 0),
//  - real input: a real mouse move shows the caption of the tile under it, a real click (a real tap on the phone)
//    opens it, the arrow keys move the focus (the engine's ring) and Enter opens that one,
//  - with WebGL refused (`getContext` returns null for webgl) the links are all there, visible, in place.
// Moves: Long form to Short form (and back) through the dock row's links: the kind of change (`linear-right`, `linear-left`),
// that no canvas exists while a change runs and that the old canvas is gone after it.
// Pictures: picsum is not reachable from every machine, and nothing from a third party is drawn here: the audit patches
// `Image.src` (and `setAttribute`) so picsum addresses give generated, numbered gradients; the wall's links and the
// engine's atlas both load through those. Links are not followed: a capture listener records which tile a click or Enter
// opened (`__opened`) and cancels it.
import { writeFileSync } from "node:fs";

const init = `
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
(()=>{
const hue=(s)=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h};
const make=(url)=>{const m=/picsum\\.photos\\/seed\\/([^/]+)\\/(\\d+)\\/(\\d+)/.exec(url);if(!m)return null;
 const id=m[1],W=Math.round(+m[2]/2),H=Math.round(+m[3]/2);const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 const hh=hue(id)%360;const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'hsl('+hh+',45%,38%)');g.addColorStop(1,'hsl('+((hh+60)%360)+',55%,22%)');x.fillStyle=g;x.fillRect(0,0,W,H);
 x.fillStyle='rgba(255,255,255,.88)';x.font='bold '+Math.round(Math.min(W,H)*.34)+'px sans-serif';x.textAlign='center';x.textBaseline='middle';
 x.fillText(id.replace(/\\D+/g,'')||id.slice(0,3),W/2,H/2);x.fillRect(0,0,W*.12,H*.06);
 return c.toDataURL('image/jpeg',.7)};
const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,enumerable:true,get(){return d.get.call(this)},set(v){d.set.call(this,make(String(v))||v)}});
const sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if(this instanceof HTMLImageElement&&n==='src'){v=make(String(v))||v}return sa.call(this,n,v)};
new MutationObserver((ms)=>{for(const m of ms)for(const n of m.addedNodes){const imgs=n.nodeType===1?(n.tagName==='IMG'?[n]:[...n.querySelectorAll('img')]):[];for(const i of imgs){const s=i.getAttribute('src');if(s&&s.includes('picsum.photos'))i.src=s}}}).observe(document,{childList:true,subtree:true});
// WebGL refused for the "no WebGL" runs (a flag in sessionStorage, set and cleared by the steps)
const gc=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t,...a){if(sessionStorage.getItem('nogl')==='1'&&/webgl/.test(t))return null;return gc.call(this,t,...a)};
// which tile a click or Enter opened (the index in the list), and every kind of change seen
window.__opened=[];window.__kinds=[];
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.wall-tile');if(a){const li=a.closest('li');window.__opened.push(JSON.stringify({i:[...li.parentElement.children].indexOf(li),label:a.getAttribute('aria-label'),rel:a.rel,target:a.target}));e.preventDefault()}},true);
new MutationObserver(()=>{const k=document.documentElement.dataset.changeKind;if(k&&window.__kinds.at(-1)!==k)window.__kinds.push(k)}).observe(document,{attributes:true,subtree:true,attributeFilter:['data-change-kind']});
})();
// ---- geometry the audit does itself: the forward warp of the layout, outlines, point in polygon
window.__K=0.05;
window.__warp=(x,y,vw,vh)=>{const u=(2*x-vw)/vw,v=(2*y-vh)/vh,f=1-window.__K*(u*u+v*v);return[((u*f+1)*vw)/2,((v*f+1)*vh)/2]};
window.__grid=()=>JSON.parse(document.querySelector('.wall-stage').dataset.grid);
window.__rect=(g,i)=>{const row=Math.floor(i/g.cols),col=i%g.cols;return{x:g.originX+col*(g.tileW+g.gap)+(row===g.rows-1?g.lastRowOffset:0),y:g.originY+row*(g.tileH+g.gap),w:g.tileW,h:g.tileH}};
window.__poly=(g,i,n=12)=>{const r=__rect(g,i);const p=[];for(let k=0;k<n;k++)p.push([r.x+r.w*k/n,r.y]);for(let k=0;k<n;k++)p.push([r.x+r.w,r.y+r.h*k/n]);for(let k=0;k<n;k++)p.push([r.x+r.w*(1-k/n),r.y+r.h]);for(let k=0;k<n;k++)p.push([r.x,r.y+r.h*(1-k/n)]);return p.map(q=>__warp(q[0],q[1],g.vw,g.vh))};
window.__inPoly=(x,y,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[d,e]=poly[j];if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)c=!c}return c};
window.__expect=(x,y)=>{const g=__grid();for(let i=0;i<g.count;i++)if(__inPoly(x,y,__poly(g,i)))return i;return -1};
window.__live=(ms=12000)=>new Promise(r=>{const t0=performance.now();const f=()=>{const s=document.querySelector('.wall-stage');if(s&&s.dataset.live!==undefined&&s.dataset.grid)r(true);else if(performance.now()-t0>ms)r(false);else setTimeout(f,100)};f()});
window.__fit=()=>{const g=__grid(),vw=g.vw,vh=g.vh;
 const heads=[...document.querySelectorAll('[data-wall-top]')].map(e=>e.getBoundingClientRect());
 const dockEl=document.querySelector('[data-dock-glass]');const dock=dockEl?dockEl.getBoundingClientRect():null;
 const sep=(a,b)=>Math.max(b.left-a.x1,a.x0-b.right,b.top-a.y1,a.y0-b.bottom);
 let minEdge=1e9,minHead=1e9,minDock=1e9,minEdgeNoDrift=1e9;
 for(let i=0;i<g.count;i++){const p=__poly(g,i);const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
  const b={x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
  minEdgeNoDrift=Math.min(minEdgeNoDrift,b.x0,b.y0,vw-b.x1,vh-b.y1);
  const d={x0:b.x0-6,x1:b.x1+6,y0:b.y0-6,y1:b.y1+6};
  minEdge=Math.min(minEdge,d.x0,d.y0,vw-d.x1,vh-d.y1);
  for(const h of heads)minHead=Math.min(minHead,sep(d,h));
  if(dock)minDock=Math.min(minDock,sep(d,dock))}
 const r=(v)=>+v.toFixed(1);
 return JSON.stringify({vw,vh,cols:g.cols,rows:g.rows,count:g.count,tile:[r(g.tileW),r(g.tileH)],minEdge:r(minEdge),minEdgeNoDrift:r(minEdgeNoDrift),minHeading:r(minHead),minDock:r(minDock),ok:minEdge>=0&&minHead>=0&&minDock>=0})};
// ---- synthetic input on the canvas (pointer capture is faked: a made up pointer id has nothing to capture)
window.__send=(type,x,y)=>{const c=document.querySelector('.wall-canvas');const r=c.getBoundingClientRect();c.setPointerCapture=()=>{};c.releasePointerCapture=()=>{};c.hasPointerCapture=()=>false;
 const o={bubbles:true,cancelable:true,pointerId:7,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+x,clientY:r.top+y};
 c.dispatchEvent(type==='click'?new MouseEvent('click',o):new PointerEvent(type,o))};
window.__clickAt=async(x,y)=>{window.__opened=[];__send('pointerdown',x,y);__send('pointerup',x,y);__send('click',x,y);await new Promise(r=>setTimeout(r,20));
 const a=window.__opened.at(-1);return a?JSON.parse(a).i:-1};
window.__hits=async()=>{const g=__grid(),R=(i)=>__rect(g,i),n=g.count,last=n-1,first=(g.rows-1)*g.cols;
 const L=[];const at=(kind,lx,ly,intended)=>{const[sx,sy]=__warp(lx,ly,g.vw,g.vh);L.push({kind,x:sx,y:sy,intended})};
 const c=(i)=>[R(i).x+R(i).w/2,R(i).y+R(i).h/2];
 for(const i of [0,g.cols-1,last,Math.floor(n/2)])at('centre',...c(i),i);
 at('corner',R(0).x+5,R(0).y+5,0);at('corner',R(g.cols-1).x+R(g.cols-1).w-5,R(g.cols-1).y+5,g.cols-1);
 at('corner',R(last).x+R(last).w-5,R(last).y+R(last).h-5,last);at('corner',R(first).x+5,R(first).y+R(first).h-5,first);
 at('gap',R(0).x+R(0).w+g.gap/2,R(0).y+R(0).h/2,-1);at('gap',R(0).x+R(0).w/2,R(0).y+R(0).h+g.gap/2,-1);at('gap',R(0).x+R(0).w+g.gap/2,R(0).y+R(0).h+g.gap/2,-1);
 L.push({kind:'screen-corner',x:4,y:4,intended:-1});
 const bad=[];for(const p of L){p.expected=__expect(p.x,p.y);p.got=await __clickAt(p.x,p.y);if(p.expected!==p.intended||p.got!==p.expected)bad.push({kind:p.kind,x:Math.round(p.x),y:Math.round(p.y),intended:p.intended,expected:p.expected,got:p.got})}
 const all=[];for(let i=0;i<n;i++){const[x,y]=c(i);const[sx,sy]=__warp(x,y,g.vw,g.vh);const got=await __clickAt(sx,sy);if(got!==i)all.push({i,got})}
 return JSON.stringify({points:L.length,pointsWrong:bad,centres:n,centresWrong:all,ok:bad.length===0&&all.length===0})};
// ---- frame gaps
window.__frames=(ms,fn)=>new Promise(r=>{const g=[];let l=performance.now();const t0=l;if(fn)fn(ms);function f(n){g.push(n-l);l=n;if(n-t0<ms)requestAnimationFrame(f);else{g.shift();g.sort((a,b)=>a-b);
 r(JSON.stringify({frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+g[Math.floor(g.length*.95)].toFixed(2),max:+g[g.length-1].toFixed(2),over20:g.filter(x=>x>20).length}))}}requestAnimationFrame(f)});
window.__hoverSweep=async(ms)=>{const g=__grid();const t0=performance.now();let k=0;while(performance.now()-t0<ms){const i=k%g.count;const q=__rect(g,i);const[x,y]=__warp(q.x+q.w/2,q.y+q.h/2,g.vw,g.vh);__send('pointermove',x,y);k+=3;await new Promise(r=>setTimeout(r,30))}
 document.querySelector('.wall-canvas').dispatchEvent(new PointerEvent('pointerleave',{bubbles:true,pointerType:'mouse'}))};
window.__caption=()=>{const c=document.querySelector('.wall-caption');return JSON.stringify({on:c.classList.contains('on'),title:c.querySelector('.t').textContent,year:c.querySelector('.a').textContent})};
window.__focusIndex=()=>{const a=document.activeElement;const li=a&&a.closest&&a.closest('li');return li&&li.closest('.wall-links')?[...li.parentElement.children].indexOf(li):-1};
window.__nogl=(on)=>{sessionStorage.setItem('nogl',on?'1':'0');return on};
window.__fallback=()=>{const g=document.querySelector('.wall-stage');const links=[...document.querySelectorAll('.wall-links a')];
 const vw=innerWidth,vh=innerHeight;const grid=g.dataset.grid?JSON.parse(g.dataset.grid):null;let out=0,hidden=0,dmax=0;
 links.forEach((a,i)=>{const r=a.getBoundingClientRect();if(r.left<0||r.top<0||r.right>vw||r.bottom>vh)out++;if(+getComputedStyle(a).opacity<1||r.width<2)hidden++;
  if(grid&&g.dataset.live===undefined){const p=__poly(grid,i);const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
   dmax=Math.max(dmax,Math.abs(r.left-Math.min(...xs)),Math.abs(r.right-Math.max(...xs)),Math.abs(r.top-Math.min(...ys)),Math.abs(r.bottom-Math.max(...ys)))}});
 return JSON.stringify({live:g.dataset.live!==undefined,canvases:document.querySelectorAll('.wall-canvas').length,links:links.length,imgs:document.querySelectorAll('.wall-links img').length,withHref:links.filter(a=>a.href&&a.target==='_blank'&&a.rel==='noreferrer').length,outside:out,hidden,maxEdgeOffFromOutlineBox:+dmax.toFixed(1)})};
`;

const LIVE = (label) => ({ eval: "__live().then(v=>JSON.stringify({live:v}))", label });
const frames = (label, fn) => ({ eval: `__frames(${fn ? 2500 : 3000}${fn ? ",()=>__hoverSweep(2500)" : ""})`, label });

function wall(kind, size, opts = {}) {
  const { name, w, h, phone } = size;
  const path = kind === "long" ? "/work/long-form" : "/work/short-form";
  const tag = `${kind}-${name}`;
  const setup = { size: [w, h], dpr: phone ? 3 : 1, mobile: !!phone, touch: !!phone };
  const steps = [];
  // 1. reduced motion: fit and exact hits
  steps.push({ ...setup, reduce: true, go: `{{BASE}}${path}`, wait: 1500 });
  steps.push(LIVE(`${tag} (reduced): live`));
  steps.push({ eval: "__fit()", label: `${tag}: fit` });
  steps.push({ eval: "__hits()", label: `${tag}: hits (reduced motion)` });
  if (opts.geometryOnly) return steps;
  // 2. motion on: frames, real input, pictures
  steps.push({ reduce: false, go: `{{BASE}}${path}`, wait: 1500 });
  steps.push(LIVE(`${tag}: live`));
  steps.push({ wait: 1200 });
  steps.push({ shot: `${tag}-warm` });
  steps.push({ shot: `r43-wall-${tag}` });
  steps.push(frames(`${tag}: frames while drifting`));
  steps.push(frames(`${tag}: frames while hovering`, true));
  steps.push({ eval: "document.querySelector('.wall-canvas').getBoundingClientRect().width+'x'+document.querySelector('.wall-canvas').getBoundingClientRect().height+' canvases='+document.querySelectorAll('.wall-canvas').length", label: `${tag}: canvas` });
  const pt = "(()=>{const g=__grid(),i=Math.floor(g.count/2),q=__rect(g,i);return __warp(q.x+q.w/2,q.y+q.h/2,g.vw,g.vh)})()";
  steps.push({ eval: `window.__e=Math.floor(__grid().count/2);window.__opened=[];window.__e`, label: `${tag}: the middle tile is the one to pick` });
  if (phone) {
    steps.push({ tap: pt, wait: 300 });
  } else {
    steps.push({ move: pt, wait: 400 });
    steps.push({ eval: "__caption()", label: `${tag}: caption after a real move` });
    steps.push({ shot: `hov-warm-${tag}` });
    steps.push({ shot: `r43-wall-${tag}-hover` });
    steps.push({ click: pt, wait: 300 });
  }
  steps.push({ eval: "JSON.stringify({expected:window.__e,opened:window.__opened.map(s=>JSON.parse(s))})", label: `${tag}: ${phone ? "real tap" : "real click"} opened` });
  if (!phone) {
    steps.push({ move: [6, h - 6], wait: 300 });
    steps.push({ key: "ArrowRight", vk: 39, wait: 250 });
    steps.push({ key: "ArrowDown", vk: 40, wait: 250 });
    steps.push({ key: "ArrowRight", vk: 39, wait: 250 });
    steps.push({ eval: "JSON.stringify({focus:__focusIndex(),caption:JSON.parse(__caption())})", label: `${tag}: arrows (first, down, right) move the focus` });
    steps.push({ shot: `ring-warm-${tag}` });
    steps.push({ shot: `r43-wall-${tag}-ring` });
    steps.push({ eval: "window.__opened=[];0" });
    steps.push({ key: "Enter", vk: 13, wait: 250 });
    steps.push({ eval: "JSON.stringify({focus:__focusIndex(),opened:window.__opened.map(s=>JSON.parse(s))})", label: `${tag}: Enter opens the focused one` });
  }
  // 3. no WebGL: the links
  steps.push({ eval: "__nogl(true)", label: `${tag}: webgl refused` });
  steps.push({ go: `{{BASE}}${path}`, wait: 2500 });
  steps.push({ eval: "__fallback()", label: `${tag}: fallback (no WebGL)` });
  steps.push({ shot: `fb-warm-${tag}` });
  steps.push({ shot: `r43-wall-${tag}-fallback` });
  steps.push({ eval: "__nogl(false)", label: `${tag}: webgl allowed again` });
  return steps;
}

const D = { name: "1440", w: 1440, h: 900 };
const M = { name: "1024", w: 1024, h: 768 };
const P = { name: "390", w: 390, h: 844, phone: true };

// The dock row's links are clicked from inside the page (a real `click()` on the link: PageLink handles it like a pointer click),
// since the steps file has fixed coordinates.
const moveSteps = [
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, reduce: false, go: "{{BASE}}/work/long-form", wait: 1500 },
  LIVE("moves: long live"),
  { wait: 1500 },
  { eval: "window.__kinds=[];window.__during=0;window.__target='short';(()=>{const f=()=>{const w=document.querySelector('.wall-page');if(document.documentElement.dataset.changeKind&&w&&w.dataset.wall===window.__target)window.__during=Math.max(window.__during,document.querySelectorAll('.wall-canvas').length);requestAnimationFrame(f)};f()})();1", label: "moves: armed" },
  { eval: "document.querySelector('[data-work-tab=\"/work/short-form\"]').click();new Promise(r=>setTimeout(()=>r(1),100))", label: "moves: click Short form" },
  { eval: "new Promise(r=>{const t0=performance.now();const f=()=>{const s=document.querySelector('.wall-stage');if(location.pathname==='/work/short-form'&&s&&s.dataset.live!==undefined&&document.documentElement.dataset.changeKind===undefined)r(JSON.stringify({path:location.pathname,wall:document.querySelector('.wall-page').dataset.wall,kinds:window.__kinds,canvasWhileChanging:window.__during,canvasesAfter:document.querySelectorAll('.wall-canvas').length,ms:Math.round(performance.now()-t0)}));else if(performance.now()-t0>12000)r('timeout '+location.pathname+' '+JSON.stringify(window.__kinds));else setTimeout(f,50)};f()})", label: "moves: long to short" },
  { wait: 1500 },
  { shot: "warm-short-after" },
  { eval: "window.__kinds=[];window.__during=0;window.__target='long';document.querySelector('[data-work-tab=\"/work/long-form\"]').click();new Promise(r=>setTimeout(()=>r(1),100))", label: "moves: click Long form" },
  { eval: "new Promise(r=>{const t0=performance.now();const f=()=>{const s=document.querySelector('.wall-stage');if(location.pathname==='/work/long-form'&&s&&s.dataset.live!==undefined&&document.documentElement.dataset.changeKind===undefined)r(JSON.stringify({path:location.pathname,wall:document.querySelector('.wall-page').dataset.wall,kinds:window.__kinds,canvasWhileChanging:window.__during,canvasesAfter:document.querySelectorAll('.wall-canvas').length,ms:Math.round(performance.now()-t0)}));else if(performance.now()-t0>12000)r('timeout '+location.pathname+' '+JSON.stringify(window.__kinds));else setTimeout(f,50)};f()})", label: "moves: short to long" },
  { key: "Escape", vk: 27 },
  { eval: "new Promise(r=>{const t0=performance.now();const f=()=>{if((location.pathname==='/work'&&document.documentElement.dataset.changeKind===undefined)||performance.now()-t0>8000)r(JSON.stringify({path:location.pathname,wallCanvases:document.querySelectorAll('.wall-canvas').length}));else setTimeout(f,50)};f()})", label: "moves: Esc to the rings, canvas freed" },
];

const steps = [
  { init },
  ...wall("long", D),
  ...wall("short", D),
  ...wall("long", M, { geometryOnly: true }),
  ...wall("short", M, { geometryOnly: true }),
  ...wall("long", P),
  ...wall("short", P),
  ...moveSteps,
];
writeFileSync(new URL("./gallery.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
console.log(`gallery.json: ${steps.length} steps`);
