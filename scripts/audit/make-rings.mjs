// Writes scripts/audit/rings.json: the checks of the work page's rings (Task 8, R43.2). Needs the production build on :5180.
// usage: node scripts/audit/make-rings.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/rings.json <outdir>
//
// Per size (the Review Focus ones, 320 by 568 to 2560 by 1440):
//  - waits for every ring to mount, finishes the arrival animation (read first: delays, length, start scale),
//  - freezes the rings at 40 sampled phases (each ring and its items' turn-back set to the same random share of
//    its period, paused) and reads the gap between every pair of item boxes (`.work-item-turn`, upright): the
//    smallest gap over all pairs and phases, and how many pairs touch or overlap (both must be 12 or more / 0),
//  - checks the intro (title and its lines of text) sits inside the stack ring's icons, that no video tile comes within 40 px of it (R54.2),
//    that nothing is cut out round the dock (R56.4, spec 4 of the round 7 second look: no mask on any ring, no keep-out block or custom property, a tile under the dock's glass cannot be
//    pressed through it: elementFromPoint over the glass at 40 phases is always the dock) and that the share of the screen under tiles is no less than before (the layout of 4621443),
//  - keyboard focus (Review Focus 2): every video tile focused in turn while the rings turn, and again under reduced motion: a tile more than half under the dock is brought clear
//    (at most 0.5 of it under at rest), a tile that is clear is not moved, no frame moves the tile more than 30 px; then sixteen real Tab presses,
//  - the arrival through a page change (R60, R56): every ring item is in the page's first commit and the reveal waits for their pictures; the rings stand still (their animations made and paused) while it runs, then turn together, from standstill.
// Pictures (1440 by 900, 1920 by 1080, 820 by 1180, 390 by 844) at three ring phases each. The long form pictures are YouTube thumbnails loaded at run time;
// where they cannot be reached (or must not be kept) the audit paints neutral, generated gradients on the tiles (a number and a corner
// mark show they are upright) so the geometry can still be seen: nothing from a third party is drawn.
// The two order modes are photographed from two builds (RING_ORDER_MODE is a constant), see the task report.
import { writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

// YouTube answers a removed video with HTTP 404 and a small grey picture (120 by 90) that does load: made here (a flat grey PNG), so no network is needed
const png = (w, h, grey) => {
  const raw = Buffer.alloc((w * 3 + 1) * h, grey);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const chunk = (type, data) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
};
const GREY_404 = png(120, 90, 160);

const init = `
try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
// every ring and its items' turn-back to one random share of the ring's period, paused
window.__phase=(seed)=>{let s=seed>>>0;const rnd=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
 document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 for(const ul of document.querySelectorAll('.work-ring')){const f=rnd();
  for(const a of ul.getAnimations({subtree:true})){if(a.animationName!=='work-spin'&&a.animationName!=='work-unspin')continue;
   a.pause();a.currentTime=f*a.effect.getTiming().duration}}return seed};
// the smallest gap between two item boxes (negative: they overlap) at the current phase
window.__gap=()=>{const b=[...document.querySelectorAll('.work-item-turn')].map(e=>{const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,id:e.parentElement.dataset.id}});
 let min=Infinity,pair='',touching=0;
 for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){const a=b[i],c=b[j];
  const g=Math.max(a.l-c.r,c.l-a.r,a.t-c.b,c.t-a.b);if(g<min){min=g;pair=a.id+' / '+c.id}if(g<11.99)touching++}
 return{n:b.length,min,pair,touching}};
// the nearest a video tile comes to the title block's text (R54.2: 40 px or more): the gap between boxes, 0 where they touch
window.__titleGap=()=>{const rects=[];for(const el of document.querySelectorAll('.work-title,.work-text-full,.work-text-short')){
  if(getComputedStyle(el).display==='none')continue;const r=document.createRange();r.selectNodeContents(el);rects.push(...r.getClientRects())}
 let min=Infinity;for(const t of document.querySelectorAll('.work-item[data-kind=video] .work-item-turn')){const b=t.getBoundingClientRect();
  for(const r of rects){const dx=Math.max(r.left-b.right,b.left-r.right,0),dy=Math.max(r.top-b.bottom,b.top-r.bottom,0);min=Math.min(min,Math.hypot(dx,dy))}}return min};
window.__sweep=(k)=>{let min=Infinity,pair='',touching=0,n=0,title=Infinity;
 for(let i=1;i<=k;i++){window.__phase(i*7919);const g=window.__gap();n=g.n;touching+=g.touching;if(g.min<min){min=g.min;pair=g.pair}title=Math.min(title,window.__titleGap())}
 return{items:n,phases:k,minGap:+min.toFixed(2),worst:pair,pairsUnder12:touching,titleGapMin:+title.toFixed(1)}};
// nothing is cut out round the dock (R56.4): no mask on a ring group, a ring or an item, none of the old keep-out's block or custom properties (set by rings.tsx on .work-rings before)
window.__cutout=()=>{const d=document.querySelector('[data-dock-glass]');const r=d.getBoundingClientRect();const cs=getComputedStyle(document.querySelector('.work-rings'));
 const masked=[...document.querySelectorAll('.work-rings,.work-ring-group,.work-ring,.work-item')].filter(g=>{const m=getComputedStyle(g);return (m.maskImage&&m.maskImage!=='none')||(m.webkitMaskImage&&m.webkitMaskImage!=='none')}).length;
 return{dock:[r.left,r.top,r.right,r.bottom].map(Math.round),masked,keepOutBlocks:document.querySelectorAll('.work-keep-out').length,
  keepVars:['--keep-l','--keep-r','--keep-t','--keep-f'].filter(n=>cs.getPropertyValue(n).trim()!=='').length}};
// a tile under the dock cannot be pressed through it: at k ring phases, the topmost element at a grid of points across the glass (clear of its rounded corners) must be the dock's, never a
// ring item; underTile counts the points that have a video tile behind them, so the check is about something
window.__through=(k)=>{const d=document.querySelector('[data-dock-glass]').getBoundingClientRect();const pts=[];
 for(let i=0;i<7;i++)for(const f of [0.2,0.5,0.8])pts.push([d.left+30+(d.width-60)*i/6,d.top+d.height*f]);
 let onItem=0,notDock=0,underTile=0,n=0;
 for(let i=1;i<=k;i++){window.__phase(i*7919);const tiles=[...document.querySelectorAll('.work-item[data-kind=video] .work-item-turn')].map(t=>t.getBoundingClientRect());
  for(const[x,y]of pts){n++;const e=document.elementFromPoint(x,y);if(e&&e.closest('.work-item'))onItem++;if(!(e&&e.closest('[data-dock-glass]')))notDock++;
   if(tiles.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))underTile++}}
 return{phases:k,points:n,onItem,notDock,pointsWithATileBehind:underTile}};
// the share of the screen under video tiles (their boxes, on the screen), averaged over k random phases, against the share the layout of 4621443 counted (BEFORE in ring-before.fixture.ts)
window.__share=(k,before)=>{let sum=0;for(let i=1;i<=k;i++){window.__phase(i*104729);let a=0;
  for(const t of document.querySelectorAll('.work-item[data-kind=video] .work-item-turn')){const r=t.getBoundingClientRect();
   const w=Math.min(r.right,innerWidth)-Math.max(r.left,0),h=Math.min(r.bottom,innerHeight)-Math.max(r.top,0);if(w>0&&h>0)a+=w*h}sum+=a/(innerWidth*innerHeight)}
 const share=sum/k;return{phases:k,share:+share.toFixed(4),before,ratio:+(share/before).toFixed(3),atLeastBefore:share>=before*0.97}};
// keyboard focus (R56.4, Review Focus 2): every video tile focused in turn (a key was pressed first, so the focus is a keyboard one), each watched frame by frame until it has stood still for 20 frames
const underOf=(t,d)=>{const w=Math.min(t.right,d.right)-Math.max(t.left,d.left),h=Math.min(t.bottom,d.bottom)-Math.max(t.top,d.top);return w>0&&h>0?w*h/(t.width*t.height):0};
const watch=async(turn,dockEl)=>{const t0=performance.now();let prev=turn.getBoundingClientRect(),first=prev,max=0,still=0;
 while(performance.now()-t0<9000){await new Promise(r=>requestAnimationFrame(r));const r=turn.getBoundingClientRect();const st=Math.hypot(r.left-prev.left,r.top-prev.top);max=Math.max(max,st);prev=r;still=st<0.2?still+1:0;if(still>=20)break}
 const r=turn.getBoundingClientRect();return{under:+underOf(r,dockEl.getBoundingClientRect()).toFixed(3),maxStepPx:+max.toFixed(1),movedPx:+Math.hypot(r.left-first.left,r.top-first.top).toFixed(1),ms:Math.round(performance.now()-t0)}};
window.__focusAll=async()=>{const dockEl=document.querySelector('[data-dock-glass]');const rows=[];
 for(const face of document.querySelectorAll('.work-item[data-kind=video] .work-item-face')){const turn=face.closest('.work-item-turn');
  const before=underOf(turn.getBoundingClientRect(),dockEl.getBoundingClientRect());face.focus({preventScroll:true});
  const w=await watch(turn,dockEl);rows.push({before:+before.toFixed(3),...w,focusVisible:face.matches(':focus-visible')})}
 const hit=rows.filter(r=>r.before>0.5),clear=rows.filter(r=>r.before<=0.5);document.activeElement.blur();
 return JSON.stringify({tiles:rows.length,moreThanHalfUnder:hit.length,worstUnderAtRest:Math.max(...rows.map(r=>r.under)),maxStepPx:Math.max(...rows.map(r=>r.maxStepPx)),
  clearTilesMoved:clear.filter(r=>r.movedPx>1.5).length,slowest:Math.max(...rows.map(r=>r.ms)),allFocusVisible:rows.every(r=>r.focusVisible),
  pass:rows.every(r=>r.under<=0.5)&&rows.every(r=>r.maxStepPx<=30)&&clear.every(r=>r.movedPx<=1.5),hit:hit.map(r=>[r.before,r.under,r.maxStepPx,r.ms])})};
// after a real Tab press: what has focus, how much of it is under the dock once it has stood still
window.__tabbed=async()=>{const a=document.activeElement;const turn=a&&a.closest&&a.closest('.work-item-turn');if(!turn)return JSON.stringify({on:a?(a.getAttribute('aria-label')||a.textContent||a.tagName).trim().slice(0,30):null,tile:false});
 const w=await watch(turn,document.querySelector('[data-dock-glass]'));return JSON.stringify({tile:true,focusVisible:a.matches(':focus-visible'),...w,ok:w.under<=0.5&&w.maxStepPx<=30})};
// the intro's room to the stack icons against what round 6 left at that size (R119: the icons keep at least that; measured on 19ca81b's rules, 60 px icons and a 14 px margin, by
// setting those two custom properties and the ring 8 px nearer; phones, whose icons did not change, are what they were). 0.3 px of rounding is allowed
window.__roomVs=(round6)=>{const i=window.__intro();return{...i,round6,atLeastRound6:i.roomToIcons>=round6-0.3}};
// frame gaps over ms: how many frames, the average, the 95th percentile, the worst and how many were over 20 ms
window.__frames=(ms)=>new Promise(r=>{const g=[];let l=performance.now();const t0=l;function f(n){g.push(n-l);l=n;if(n-t0<ms)requestAnimationFrame(f);else{g.shift();g.sort((a,b)=>a-b);
 r(JSON.stringify({frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+g[Math.floor(g.length*.95)].toFixed(2),max:+g[g.length-1].toFixed(2),over20:g.filter(x=>x>20).length}))}}requestAnimationFrame(f)});
// every ring back to the start of its turn, still running, and where its first item then is
window.__start=(sel)=>{document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
 for(const a of document.getAnimations())if(a.animationName==='work-spin'||a.animationName==='work-unspin')a.currentTime=0;
 const r=document.querySelector(sel).getBoundingClientRect();return JSON.stringify([Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)])};
// wait for every ring of the plan to be mounted (one per frame after the page change)
window.__ready=(want)=>new Promise(res=>{const t0=performance.now();const w=setInterval(()=>{
 const n=document.querySelectorAll('.work-ring').length;
 if((n>=want&&document.querySelectorAll('.work-item').length>0)||performance.now()-t0>6000){clearInterval(w);res(n)}},30)});
// the arrival of the rings as the page sets it: a recorder from the start of the page notes each ring group's
// animation the first frame it is seen (delay, length and where it starts) and when that was
window.__arr=[];(function(){const t0=performance.now();const f=()=>{
 for(const g of document.querySelectorAll('.work-ring-group')){if(g.__seen)continue;const a=g.getAnimations().find(x=>x.animationName==='work-ring-in');
  if(a){g.__seen=1;const t=a.effect.getTiming();window.__arr.push({ring:g.dataset.ring,delay:t.delay,duration:t.duration,from:a.effect.getKeyframes()[0].scale,seenAtMs:Math.round(performance.now()-t0)})}}
 if(performance.now()-t0<3500)requestAnimationFrame(f)};requestAnimationFrame(f)})();
window.__arrival=()=>JSON.stringify(window.__arr);
// the intro inside the stack ring: the least room between its text and the stack icons, in px
window.__intro=()=>{const cx=innerWidth/2,cy=innerHeight/2;const ul=document.querySelector('.work-ring[data-ring-id="stack"]');
 const R=parseFloat(ul.style.getPropertyValue('--r'));const icon=ul.querySelector('.work-item-turn').getBoundingClientRect().width;
 let far=0;const rects=[];for(const el of document.querySelectorAll('.work-title,.work-text-full,.work-text-short')){
  if(getComputedStyle(el).display==='none')continue;const r=document.createRange();r.selectNodeContents(el);rects.push(...r.getClientRects())}
 for(const r of rects)for(const x of [r.left,r.right])for(const y of [r.top,r.bottom])far=Math.max(far,Math.hypot(x-cx,y-cy));
 return{stackRadius:+R.toFixed(1),icon,textReach:+far.toFixed(1),roomToIcons:+(R-icon/2-far).toFixed(1)}};
// the rings arriving through a page change (R60): from the start of a change to /work (the debug hook), polls every frame for when the
// first item and the last item are in the page, whether the rings are standing still (data-still) while the reveal runs, how many
// pictures have loaded (and none is lazy) when the reveal is a second old, then waits for the change to end and reads that the rings
// are all turning together (a spin on every ring and a turn-back on every item, each started at the same moment)
window.__viaChange=()=>new Promise(res=>{const t0=performance.now();const out={firstItemMs:null,allItemsMs:null,stillDuringReveal:null,pausedAnimations:null,lazy:null,readyAt1s:null,coversAt1s:null,
 turningAfter:null,startsEqual:null,rings:0,items:0,changeEndedMs:null};__ftChange('/work');
 const iv=setInterval(()=>{const t=performance.now()-t0;const n=document.querySelectorAll('.work-item').length;
  if(out.firstItemMs===null&&n>0)out.firstItemMs=Math.round(t);
  const want=window.__want||0;if(out.allItemsMs===null&&n>0&&n>=want&&t>0){out.allItemsMs=Math.round(t)}
  if(out.stillDuringReveal===null&&n>0&&t>700){const m=document.querySelector('.work-page');const sa=document.getAnimations().filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin');out.stillDuringReveal=!!m&&m.hasAttribute('data-still')&&sa.length>0&&sa.every(a=>a.playState==='paused'&&(+a.currentTime||0)===0);out.pausedAnimations=sa.length;
   out.lazy=document.querySelectorAll('.work-cover img[loading=lazy]').length;out.coversAt1s=document.querySelectorAll('.work-cover img').length;out.readyAt1s=document.querySelectorAll('.work-cover img[data-ready]').length;out.items=n;out.rings=document.querySelectorAll('.work-ring').length}
  if(t>1500&&!document.documentElement.dataset.changeKind){clearInterval(iv);out.changeEndedMs=Math.round(t);
   setTimeout(()=>{const sp=document.getAnimations().filter(a=>a.animationName==='work-spin');const un=document.getAnimations().filter(a=>a.animationName==='work-unspin');
    out.turningAfter={spin:sp.length,unspin:un.length,stillAttr:document.querySelector('.work-page').hasAttribute('data-still')};
    out.startsEqual=new Set([...sp,...un].map(a=>Math.round(a.startTime))).size<=2;res(JSON.stringify(out))},400)}
  if(t>9000){clearInterval(iv);res(JSON.stringify({timeout:true,out}))}},16)});
// the rings arriving through a reduced-motion change (the 120 ms fade; since R56 the page is made for it like for the radial reveal): polls every 8 ms for how many items are in the page
// each time that number changes (it must go from none to all in one step), whether the page carries the change arrival or standing-still marks, and the
// ring groups' own animation (the plain fade) once they are in
window.__viaFade=()=>new Promise(res=>{const t0=performance.now();const out={steps:[],kind:null,arrival:'unset',still:'unset',groupAnim:null,groupMs:null,turning:null,changeEndedMs:null};let last=-1;__ftChange('/work');
 const iv=setInterval(()=>{const t=performance.now()-t0;const n=document.querySelectorAll('.work-item').length;
  if(!out.kind&&document.documentElement.dataset.changeKind)out.kind=document.documentElement.dataset.changeKind;
  if(n!==last){out.steps.push([Math.round(t),n]);last=n}
  const g=document.querySelector('.work-ring-group');const m=document.querySelector('.work-page');
  if(g&&out.groupAnim===null){const a=g.getAnimations().find(x=>x.animationName==='work-fade'||x.animationName==='work-ring-in');out.groupAnim=getComputedStyle(g).animationName;out.groupMs=a?a.effect.getTiming().duration:null;out.arrival=String(m.getAttribute('data-arrival'));out.still=String(m.hasAttribute('data-still'))}
  if(t>400&&!document.documentElement.dataset.changeKind){clearInterval(iv);out.changeEndedMs=Math.round(t);
   setTimeout(()=>{out.turning=document.getAnimations().filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin').length;res(JSON.stringify(out))},400)}
  if(t>6000){clearInterval(iv);res(JSON.stringify({timeout:true,out}))}},8)});
// which YouTube thumbnail each landscape tile loaded: sddefault, hqdefault (asked for, or the fallback for a video with no sddefault), and the tile's width in device pixels
window.__sources=()=>{const c=[...document.querySelectorAll('.work-item[data-ring=long] .work-cover img')];const w=c.length?c[0].getBoundingClientRect().width*devicePixelRatio:0;
 return JSON.stringify({tiles:c.length,tileDevicePx:Math.round(w),sd:c.filter(i=>i.currentSrc.includes('/sddefault.jpg')).length,hq:c.filter(i=>i.currentSrc.includes('/hqdefault.jpg')).length,
  hqFallback:c.filter(i=>'hq' in i.dataset).length,localArt:c.filter(i=>i.currentSrc.startsWith('data:')).length})};
// the covers: how many, how many are lazy, ready (shown), swapped for the local art (fallback) and still showing a loaded picture of 120 px or less
window.__covers=()=>{const c=[...document.querySelectorAll('.work-cover img')];return JSON.stringify({covers:c.length,lazy:c.filter(i=>i.loading==='lazy').length,ready:c.filter(i=>'ready' in i.dataset).length,
 fallback:c.filter(i=>'fallback' in i.dataset).length,localArt:c.filter(i=>i.currentSrc.startsWith('data:')).length,greyShown:c.filter(i=>i.complete&&i.naturalWidth>0&&i.naturalWidth<=120&&!i.currentSrc.startsWith('data:')).length,
 faded:c.filter(i=>getComputedStyle(i).opacity==='1').length})};
// a change to /work, then the covers once the change is over and the pictures have had time (all of them load at once through a change)
window.__changeCovers=()=>new Promise(res=>{const t0=performance.now();__ftChange('/work');const iv=setInterval(()=>{
 if(performance.now()-t0>1500&&!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(window.__covers()),1500)}
 if(performance.now()-t0>9000){clearInterval(iv);res('timeout')}},50)});
// neutral generated pictures (no third party) when the real ones cannot be loaded
window.__fake=()=>{let i=0;for(const img of document.querySelectorAll('.work-cover img')){i++;const tall=img.closest('.work-item').dataset.ring==='short';
 const W=tall?360:640,H=tall?640:360,hue=(i*47)%360;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+hue+',45%,38%)"/><stop offset="1" stop-color="hsl('+((hue+60)%360)+',50%,22%)"/></linearGradient></defs><rect width="'+W+'" height="'+H+'" fill="url(#g)"/><path d="M0 0H90L0 90Z" fill="rgba(255,255,255,.35)"/><text x="'+W/2+'" y="'+(H/2+30)+'" font-family="monospace" font-size="'+Math.round(H*.22)+'" text-anchor="middle" fill="rgba(255,255,255,.85)">'+i+'</text></svg>';
 img.src='data:image/svg+xml;utf8,'+encodeURIComponent(svg)}return i};
`.trim();

const SIZES = [
  { name: "1440x900", before: 0.308961, round6: 26.3, size: [1440, 900], dpr: 1, rings: 3, pictures: true },
  { name: "1920x1080", before: 0.270521, round6: 33, size: [1920, 1080], dpr: 1, rings: 3, pictures: true },
  { name: "820x1180", before: 0.209879, round6: 73.5, size: [820, 1180], dpr: 1, rings: 3, pictures: true, mobile: true, touch: true },
  { name: "390x844", before: 0.230922, round6: 31.5, size: [390, 844], dpr: 2, rings: 2, pictures: true, mobile: true, touch: true },
  { name: "375x667", before: 0.201577, round6: 30, size: [375, 667], dpr: 2, rings: 2, pictures: true, mobile: true, touch: true },
  { name: "568x320", before: 0.077492, round6: 26.1, size: [568, 320], dpr: 2, rings: 2, pictures: true, mobile: true, touch: true },
  { name: "320x568", before: 0.189805, round6: 23, size: [320, 568], dpr: 2, rings: 2, pictures: true, mobile: true, touch: true },
  { name: "1024x768", before: 0.279105, round6: 15.9, size: [1024, 768], dpr: 1, rings: 3 },
  { name: "2560x1440", before: 0.257215, round6: 46.6, size: [2560, 1440], dpr: 1, rings: 4 },
];

// where the first long-1 and stack items sit at the start of a turn at 1440 by 900 (read by the step before them)
const HOVER = { long1: [844, 70], stack: [720, 234] };
const steps = [];
let first = true;
for (const s of SIZES) {
  const head = { size: s.size, dpr: s.dpr, ...(s.mobile ? { mobile: true } : { mobile: false }), touch: !!s.touch };
  if (first) head.init = init;
  steps.push({ ...head, go: "{{BASE}}/work", wait: 1500, label: `${s.name} arrival (a ring per frame, delay 60 ms apart, 500 ms, from 96%)`, eval: "window.__arrival()" });
  first = false;
  steps.push({ label: `${s.name} rings mounted`, eval: `window.__ready(${s.rings})` });
  steps.push({ label: `${s.name} overlap at 40 phases`, eval: "window.__sweep(40)" });
  steps.push({ label: `${s.name} intro inside the stack ring`, eval: "window.__intro()" });
  steps.push({ label: `${s.name} the intro's room to the stack icons, at least round 6's (R119)`, eval: `window.__roomVs(${s.round6})` });
  steps.push({ label: `${s.name} no cut-out round the dock (R56.4): no mask, no keep-out block`, eval: "window.__cutout()" });
  steps.push({ label: `${s.name} a tile under the dock's glass cannot be pressed through it, 40 phases (R56.4)`, eval: "window.__through(40)" });
  steps.push({ label: `${s.name} the share of the screen under tiles is no less than before R56.4 (${s.before})`, eval: `window.__share(200, ${s.before})` });
  if (s.pictures) {
    steps.push({ label: `${s.name} generated pictures on tiles`, eval: "window.__fake()", wait: 600 });
    [1, 2, 3].forEach((p) => {
      steps.push({ eval: `window.__phase(${p * 104729})`, wait: 300 });
      steps.push({ shot: `warm-${s.name}-p${p}` });
      steps.push({ shot: `rings-${s.name}-p${p}` });
    });
  }
}

// behaviour: hover pauses one ring, a stack icon is no tab stop and does nothing, reduced motion is still
steps.push({ size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/work", wait: 1500, eval: "window.__ready(3)", label: "ready for behaviour" });
steps.push({
  label: "stack icons: names, no tab stop, no link",
  eval: `JSON.stringify({n:document.querySelectorAll('.work-item[data-kind=stack]').length,
    names:[...document.querySelectorAll('.work-item[data-kind=stack] img')].map(i=>i.alt),
    imgs:document.querySelectorAll('.work-item[data-kind=stack] img').length,
    focusable:document.querySelectorAll('.work-item[data-kind=stack] a,.work-item[data-kind=stack] button,.work-item[data-kind=stack] [tabindex]').length,
    bare:[...document.querySelectorAll('.work-item[data-kind=stack] img[data-bare]')].map(i=>i.alt),
    tileRadius:getComputedStyle(document.querySelector('.work-item[data-kind=stack] .work-mark')).borderRadius})`,
});
// every ring back to the start of its turn and running, so the slots are where the layout puts them (slot 0 at the top)
steps.push({
  label: "back to the start of the turn (running): where the first long-1 and stack items are",
  eval: `(()=>{document.getAnimations().filter(a=>a.animationName==='work-ring-in').forEach(a=>a.finish());
    for(const a of document.getAnimations())if(a.animationName==='work-spin'||a.animationName==='work-unspin')a.currentTime=0
    const c=s=>{const r=document.querySelector(s).getBoundingClientRect();return[Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]};
    return JSON.stringify({long1:c('.work-ring[data-ring-id="long-1"] .work-item-turn'),stack:c('.work-ring[data-ring-id="stack"] .work-item-turn')})})()`,
});
const state = `JSON.stringify(Object.fromEntries([...document.querySelectorAll('.work-ring')].map(u=>[u.dataset.ringId,u.getAnimations().find(a=>a.animationName==='work-spin').playState])))`;
steps.push({ label: "no hover: every ring running", eval: state });
steps.push({ move: HOVER.long1, wait: 150 });
steps.push({ label: "pointer on a long-1 video: only long-1 paused", eval: state });
steps.push({ move: [5, 5], wait: 150 });
steps.push({ label: "pointer away: all running again", eval: state });
steps.push({ move: HOVER.stack, wait: 150 });
steps.push({
  label: "pointer on a stack icon: the stack ring paused, the icon does not grow",
  eval: `JSON.stringify({rings:${state.replace(/`/g, "'")},scale:getComputedStyle(document.querySelector('.work-item:hover .work-item-face')).scale,hovered:document.querySelector('.work-item:hover').dataset.kind})`,
});
steps.push({ move: [5, 5] });
// Frame timing, CPU 4 times slower, after the arrival: at rest, then with the pointer on a ring item (that ring paused).
// The hover points are the first long-1 item at the start of a turn (read by the step before each).
const FRAME_RUNS = [
  { name: "1440x900 dpr 2", size: [1440, 900], dpr: 2, mobile: false, touch: false, hover: [844, 70] },
  { name: "390x844 dpr 3", size: [390, 844], dpr: 3, mobile: true, touch: true, hover: [300, 109] },
];
for (const f of FRAME_RUNS) {
  steps.push({ size: f.size, dpr: f.dpr, mobile: f.mobile, touch: f.touch, cpu: 4, go: "{{BASE}}/work", wait: 3000, eval: "window.__ready(" + (f.mobile ? 2 : 3) + ")", label: `frames ${f.name}: ready` });
  steps.push({ wait: 1200, label: `frames ${f.name} at rest, 4 s`, eval: "window.__frames(4000)" });
  // a tile wider than hqdefault's 480 px at the screen's pixels asks for sddefault (R54.2b, M5), and falls back to hqdefault where the video has none
  steps.push({ label: `frames ${f.name}: the pictures asked for (sddefault where a tile is over 480 device pixels wide)`, eval: "window.__sources()" });
  steps.push({ label: `frames ${f.name}: first long-1 item at the start of the turn`, eval: `window.__start('.work-ring[data-ring-id="long-1"] .work-item-turn')` });
  steps.push({ move: f.hover, wait: 200 });
  steps.push({ label: `frames ${f.name} with the pointer on a ring item, 4 s`, eval: `window.__frames(4000)` });
  steps.push({ label: `frames ${f.name}: a ring is paused (hover took)`, eval: `JSON.stringify(document.querySelectorAll('.work-item:hover').length)` });
  steps.push({ move: [5, 5], cpu: 1 });
}

// the rings arriving through a page change from home (R60): present for the reveal (all 34 items in the first commit, the reveal waiting for their pictures, standing
// still, pictures loading at once, none lazy), turning together when the change ends
steps.push({ size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/", wait: 3000, eval: "window.__want=34;'ready'", label: "via a change: from home" });
steps.push({ label: "via a change: the rings during the reveal and when it ends", eval: "window.__viaChange()" });

// reduced motion through a change (the 120 ms fade): the rings come in whole at the first commit and the fade is their arrival (no fade of their own)
steps.push({ reduce: true, size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/", wait: 3000, eval: "'ready'", label: "reduced motion via a change: from home" });
steps.push({ label: "reduced motion via a change: every item is in the first commit (the 120 ms fade is the arrival: the page has the change marks and no fade of its own)", eval: "window.__viaFade()" });
steps.push({ reduce: false });

// a cover that fails (R51.1b): the tile shows the local art. Requests to YouTube's thumbnail host are intercepted: unreachable (the host does not resolve), then
// a removed video (HTTP 404 with the small grey picture), with the cache off (a cached thumbnail would not be intercepted). Through a change every picture loads at once. The pictures are generated art, so the shot may be committed.
steps.push({ intercept: [{ match: "i.ytimg.com", fail: "NameNotResolved" }], nocache: true, size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/", wait: 3000, eval: "'ready'", label: "failed covers (host unreachable): from home" });
steps.push({ label: "failed covers (host unreachable): every cover swapped for the local art, none grey", eval: "window.__changeCovers()" });
steps.push({ shot: "r51-covers-unreachable" });
steps.push({ intercept: [{ match: "i.ytimg.com", status: 404, type: "image/png", body: GREY_404 }], go: "{{BASE}}/", wait: 3000, eval: "'ready'", label: "failed covers (404, grey 120 by 90 picture): from home" });
steps.push({ label: "failed covers (404, grey picture): swapped for the local art, none grey", eval: "window.__changeCovers()" });
steps.push({ shot: "r51-covers-404-grey" });
// a first load keeps the pictures lazy (they do not compete with the page's own requests); a rotating item brings its picture when it nears the screen
steps.push({ intercept: [], nocache: false, go: "{{BASE}}/work", wait: 3000, eval: "window.__covers()", label: "first load: covers are lazy" });

// keyboard focus (R56.4, Review Focus 2). A key press first, so the focus that follows is a keyboard one (:focus-visible), as a tab stop would give; every video tile focused in turn.
steps.push({ reduce: false, size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/work", wait: 1800, eval: "window.__ready(3)", label: "focus: ready (rings turning)" });
steps.push({ key: "Shift", vk: 16 });
steps.push({ label: "focus, rings turning, 1440x900: every video tile in turn: none rests more than half under the dock, a clear tile is not moved, no frame moves a tile over 30 px", eval: "window.__focusAll()" });
// real Tab presses: the dock first (nine stops), then the video tiles in order (the stack icons are no tab stop)
for (let i = 1; i <= 16; i++) {
  steps.push({ key: "Tab", vk: 9 });
  steps.push({ label: `focus, real Tab press ${i}`, eval: "window.__tabbed()" });
}
for (const f of [{ name: "390x844", size: [390, 844], dpr: 2 }, { name: "320x568", size: [320, 568], dpr: 2 }]) {
  steps.push({ size: f.size, dpr: f.dpr, mobile: true, touch: true, go: "{{BASE}}/work", wait: 1800, eval: "window.__ready(2)", label: `focus: ready ${f.name}` });
  steps.push({ key: "Shift", vk: 16 });
  steps.push({ label: `focus, rings turning, ${f.name}: every video tile in turn`, eval: "window.__focusAll()" });
}
steps.push({ reduce: true, size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/work", wait: 1500, eval: "window.__ready(3)", label: "reduced motion: ready" });
steps.push({
  label: "reduced motion: no ring or item is turning",
  eval: `JSON.stringify({turning:document.getAnimations().filter(a=>a.animationName==='work-spin'||a.animationName==='work-unspin').length,
    groupAnim:[...new Set([...document.querySelectorAll('.work-ring-group')].map(g=>getComputedStyle(g).animationName))]})`,
});
steps.push({ key: "Shift", vk: 16 });
steps.push({ label: "focus, reduced motion (the rings stand still: a tile under the dock is brought clear by turning its ring at once), 1440x900", eval: "window.__focusAll()" });
steps.push({ reduce: false });

writeFileSync(new URL("./rings.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");

// One picture at 1440 by 900 of whichever order mode the running build ships (RING_ORDER_MODE): build with the mode set,
// run this, and copy rings-mode.jpg to docs/redesign/screenshots/r43-rings-<mode>.jpg
const mode = [
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, init, go: "{{BASE}}/work", wait: 1500, eval: "window.__ready(3)", label: "ready" },
  { eval: "window.__fake()", wait: 600, label: "generated pictures on tiles" },
  { eval: "window.__sweep(40)", label: "overlap at 40 phases" },
  { eval: "window.__phase(104729)", wait: 300 },
  { shot: "warm-rings-mode" },
  { shot: "rings-mode" },
];
writeFileSync(new URL("./rings-mode.json", import.meta.url), JSON.stringify(mode, null, 1) + "\n");
console.log(`wrote ${steps.length} steps and ${mode.length}`);
