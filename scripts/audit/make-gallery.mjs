// Writes scripts/audit/gallery.json: the checks of the two video walls (Task 11, R43.5; rewritten for round 7, R51.2: no warp,
// the arrival, the way back). Needs the production build on :5180.
// usage: node scripts/audit/make-gallery.mjs   then   BASE=http://localhost:5180 node scripts/audit/cdp.mjs scripts/audit/gallery.json <outdir>
//
// For both walls at 1440 by 900 (dpr 1), 1024 by 768 (geometry only) and 390 by 844 (dpr 3, touch):
//  - fit: every tile's box (plus 6 px for the drift) is inside the screen, clear of the heading, the back button and the
//    dock (`minEdge`, `minHeading`, `minDock` must be 0 or more), and the gap between neighbours is 8 px exactly,
//  - hits: with reduced motion (no drift, so the answer is exact) clicks at 12 points (4 centres, 4 corners 5 px
//    inside the tile, 3 gaps, 1 screen corner) and at every tile centre open what the layout says
//    (the audit does its own rectangle test; it does not use the engine's maths),
//  - arrival (R51.2): a recorder wraps `drawElements` and, right after each draw of the wall's canvas, copies the canvas and
//    reads every tile's middle (`?arrrec`): nothing is visible before the first draw; no tile is ever visible and flat (an
//    empty box); the number of visible tiles never goes down; every tile is whole at the end; the first draw comes within
//    1.2 s of the engine starting. Run with the pictures at once, slow (3 s late), failing, and YouTube's grey stand-in,
//    and under reduced motion (a fade, no stagger); frames of the arrival are photographed by a film,
//  - the way back: the back button (same pill and place as the shelves' Close) is a tab stop, Enter goes to /work through the
//    one radial change; Esc does too,
//  - frames: gaps between animation frames over 3 s of drifting and over 2.5 s of hovering across the wall (over20 must be 0),
//  - real input: a real mouse move shows the caption of the tile under it, a real click (a real tap on the phone)
//    opens it, the arrow keys move the focus (the engine's ring) and Enter opens that one,
//  - with WebGL refused (`getContext` returns null for webgl) the links are all there, visible, in place.
//  - R51.2b: a slow first load (the chunks held back by the cdp.mjs `intercept` step's `delay`, so the page runs only after the server's
//    links have been shown at 2.5 s): the wall must never go show, blank, show. A screencast film with `tiles` reads, in every frame the
//    compositor produced, how many of the wall's tiles show something (`blankFramesAfterShown` must be 0), with a timeline of the
//    stage's marks (`?tl`: data-fit, data-shown, data-drawn, data-plain, data-live) and the focus-visible tile before the engine draws,
//  - R51.2b: a lost WebGL context on a wall (`WEBGL_lose_context`): the links are the wall again with no frame between (no hole),
//  - R51.2b: the Back pill on screen, not over the heading, not under the dock and the first tab stop, at every size (320 by 568 and 844 by 390 too).
// Moves: Long form to Short form (and back) through the dock row's links: the kind of change (the one `radial` reveal since round 7),
// that no canvas exists while a change runs and that the old canvas is gone after it.
// Pictures: nothing from a third party is drawn here (and none may reach a tracked picture): the audit patches
// `Image.src` (and `setAttribute`) so YouTube thumbnail addresses give generated, numbered gradients (`?slowpics=ms` delays them;
// `?nopatch` leaves the addresses alone, for the runs where requests to the thumbnail host are intercepted: unreachable, or YouTube's
// 404 with the grey 120 by 90 stand-in); the placeholder
// art of the short form is local already and is left as it is. The wall's links and the
// engine's atlas both load through those. Links are not followed: a capture listener records which tile a click or Enter
// opened (`__opened`) and cancels it.
import { writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

// YouTube answers a removed video with HTTP 404 and a small grey picture (120 by 90) that does load: made here, so no network is needed
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
try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
(()=>{
const hue=(s)=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h};
const make=(url)=>{const m=/i\\.ytimg\\.com\\/vi\\/([^/]+)\\/(hqdefault|oar2)\\.jpg/.exec(url);if(!m)return null;
 const id=m[1],W=m[2]==='oar2'?180:320,H=m[2]==='oar2'?320:180;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
 const hh=hue(id)%360;const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'hsl('+hh+',45%,38%)');g.addColorStop(1,'hsl('+((hh+60)%360)+',55%,22%)');x.fillStyle=g;x.fillRect(0,0,W,H);
 x.fillStyle='rgba(255,255,255,.88)';x.font='bold '+Math.round(Math.min(W,H)*.34)+'px sans-serif';x.textAlign='center';x.textBaseline='middle';
 x.fillText(id.replace(/\\D+/g,'')||id.slice(0,3),W/2,H/2);
 return c.toDataURL('image/jpeg',.7)};
const q=location.search,slow=+((/slowpics=(\\d+)/.exec(q)||[])[1]||0),nopatch=/nopatch/.test(q);
const pic=(url)=>nopatch?null:make(url);
const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
const put=(img,v)=>{const m=pic(String(v));if(m&&slow)setTimeout(()=>d.set.call(img,m),slow);else d.set.call(img,m||v)};
Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,enumerable:true,get(){return d.get.call(this)},set(v){put(this,v)}});
const sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if(this instanceof HTMLImageElement&&n==='src'){put(this,v);return}return sa.call(this,n,v)};
new MutationObserver((ms)=>{for(const m of ms)for(const n of m.addedNodes){const imgs=n.nodeType===1?(n.tagName==='IMG'?[n]:[...n.querySelectorAll('img')]):[];for(const i of imgs){const s=i.getAttribute('src');if(s&&s.includes('i.ytimg.com'))i.src=s}}}).observe(document,{childList:true,subtree:true});
// WebGL refused for the "no WebGL" runs (a flag in sessionStorage, set and cleared by the steps)
const gc=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t,...a){if(sessionStorage.getItem('nogl')==='1'&&/webgl/.test(t))return null;return gc.call(this,t,...a)};
// which tile a click or Enter opened (the index in the list), and every kind of change seen
window.__opened=[];window.__kinds=[];
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.wall-tile');if(a){const li=a.closest('li');window.__opened.push(JSON.stringify({i:[...li.parentElement.children].indexOf(li),label:a.getAttribute('aria-label'),rel:a.rel,target:a.target}));e.preventDefault()}},true);
new MutationObserver(()=>{const k=document.documentElement.dataset.changeKind;if(k&&window.__kinds.at(-1)!==k)window.__kinds.push(k)}).observe(document,{attributes:true,subtree:true,attributeFilter:['data-change-kind']});
})();
// ---- geometry the audit does itself: the tile rectangles, outlines, point in polygon (there is no warp since round 7: the
// screen point of a layout point is the point itself)
window.__warp=(x,y)=>[x,y];
window.__grid=()=>JSON.parse(document.querySelector('.wall-stage').dataset.grid);
window.__rect=(g,i)=>{const row=Math.floor(i/g.cols),col=i%g.cols;return{x:g.originX+col*(g.tileW+g.gap)+(row===g.rows-1?g.lastRowOffset:0),y:g.originY+row*(g.tileH+g.gap),w:g.tileW,h:g.tileH}};
window.__poly=(g,i,n=12)=>{const r=__rect(g,i);const p=[];for(let k=0;k<n;k++)p.push([r.x+r.w*k/n,r.y]);for(let k=0;k<n;k++)p.push([r.x+r.w,r.y+r.h*k/n]);for(let k=0;k<n;k++)p.push([r.x+r.w*(1-k/n),r.y+r.h]);for(let k=0;k<n;k++)p.push([r.x,r.y+r.h*(1-k/n)]);return p.map(q=>__warp(q[0],q[1],g.vw,g.vh))};
window.__inPoly=(x,y,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[d,e]=poly[j];if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)c=!c}return c};
window.__expect=(x,y)=>{const g=__grid();for(let i=0;i<g.count;i++)if(__inPoly(x,y,__poly(g,i)))return i;return -1};
window.__live=(ms=12000)=>new Promise(r=>{const t0=performance.now();const f=()=>{const s=document.querySelector('.wall-stage'),c=document.querySelector('.wall-canvas');if(s&&s.dataset.live!==undefined&&s.dataset.grid&&c&&c.dataset.arrived!==undefined)r(true);else if(performance.now()-t0>ms)r(false);else setTimeout(f,100)};f()});
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
 const gapX=g.cols>1?__rect(g,1).x-(__rect(g,0).x+__rect(g,0).w):null;
 return JSON.stringify({vw,vh,cols:g.cols,rows:g.rows,count:g.count,gap:g.gap,gapX:gapX===null?null:+gapX.toFixed(2),tile:[r(g.tileW),r(g.tileH)],minEdge:r(minEdge),minEdgeNoDrift:r(minEdgeNoDrift),minHeading:r(minHead),minDock:r(minDock),ok:minEdge>=0&&minHead>=0&&minDock>=0&&g.gap===8&&(gapX===null||Math.abs(gapX-8)<0.01)})};
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
// ---- the arrival recorder (R51.2, ?arrrec): right after every draw of the wall's canvas, copy it and read each tile's middle
// (70% of its box, 7 by 5 points): the share of visible points (alpha over 20%) and the luma spread among them. A tile is visible when
// it has most points visible, and empty when it is visible and flat (spread under 2.5 and a mean within 2.5 of --surface-1's luma 23).
window.__arr={frames:[],canvasAt:null};
(()=>{
 if(!/arrrec/.test(location.search))return;
 const dc=WebGL2RenderingContext.prototype.drawElements;
 let cv=null,cx=null,grid=null,gridAt=0;
 WebGL2RenderingContext.prototype.drawElements=function(...a){
  const r=dc.apply(this,a);
  try{
   const c=this.canvas;
   if(c&&c.classList&&c.classList.contains('wall-canvas')&&window.__arr.frames.length<900){
    const now=performance.now();if(window.__arr.canvasAt===null)window.__arr.canvasAt=now;
    if(!grid||now-gridAt>500){grid=JSON.parse(document.querySelector('.wall-stage').dataset.grid);gridAt=now}
    if(!cv){cv=document.createElement('canvas');cx=cv.getContext('2d',{willReadFrequently:true})}
    if(cv.width!==c.width||cv.height!==c.height){cv.width=c.width;cv.height=c.height}
    cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(c,0,0);
    const k=c.width/grid.vw;let visible=0,empty=0,minSpread=1e9,drawnAlpha=0;
    for(let i=0;i<grid.count;i++){
     const row=Math.floor(i/grid.cols),col=i%grid.cols;
     const tx=grid.originX+col*(grid.tileW+grid.gap)+(row===grid.rows-1?grid.lastRowOffset:0),ty=grid.originY+row*(grid.tileH+grid.gap);
     const x0=Math.round((tx+grid.tileW*.15)*k),y0=Math.round((ty+grid.tileH*.15)*k),w=Math.max(2,Math.round(grid.tileW*.7*k)),h=Math.max(2,Math.round(grid.tileH*.7*k));
     const d=cx.getImageData(x0,y0,w,h).data;let n=0,vis=0,lo=1e9,hi=-1e9,sum=0;
     for(let yy=0;yy<5;yy++)for(let xx=0;xx<7;xx++){const px=Math.min(w-1,Math.floor((xx+.5)*w/7)),py=Math.min(h-1,Math.floor((yy+.5)*h/5)),o=(py*w+px)*4;n++;
      if(d[o+3]>51){vis++;const l=.2126*d[o]+.7152*d[o+1]+.0722*d[o+2];lo=Math.min(lo,l);hi=Math.max(hi,l);sum+=l}}
     drawnAlpha+=vis;
     if(vis>=n*.6){visible++;const sp=hi-lo,mean=sum/vis;minSpread=Math.min(minSpread,sp);if(sp<2.5&&Math.abs(mean-23)<2.5)empty++}
    }
    window.__arr.frames.push([Math.round(now-window.__arr.canvasAt),visible,empty,drawnAlpha,+(minSpread>1e8?-1:minSpread).toFixed(1)]);
   }
  }catch(e){window.__arr.error=String(e)}
  return r};
})();
window.__arrReport=()=>{const f=window.__arr.frames,c=document.querySelector('.wall-canvas'),g=document.querySelector('.wall-stage').dataset.grid?JSON.parse(document.querySelector('.wall-stage').dataset.grid):{count:0};
 const firstVis=f.findIndex(x=>x[1]>0);let down=0;for(let i=1;i<f.length;i++)if(f[i][1]<f[i-1][1])down++;
 const seen=[...new Set(f.map(x=>x[1]))];
 return JSON.stringify({draws:f.length,error:window.__arr.error||null,count:g.count,startMs:c&&+c.dataset.startMs,startPictures:c&&+c.dataset.startPictures,
  drawsBeforeFirstVisible:firstVis<0?f.length:firstVis,visibleBeforeFirstDraw:0,firstVisibleAtMs:firstVis<0?null:f[firstVis][0],
  midFrames:f.filter(x=>x[1]>0&&x[1]<g.count).length,visibleTilesSeen:seen.length,maxEmpty:Math.max(0,...f.map(x=>x[2])),framesWithEmpty:f.filter(x=>x[2]>0).length,
  visibleNeverDrops:down===0,finalVisible:f.length?f.at(-1)[1]:0,allWhole:f.length>0&&f.at(-1)[1]===g.count,lastFrameAt:f.length?f.at(-1)[0]:null,
  ok:f.length>0&&!window.__arr.error&&Math.max(0,...f.map(x=>x[2]))===0&&down===0&&f.at(-1)[1]===g.count})};
// ---- the back button (R51.2): the shelves' close pill (the same component), a link to /work, a tab stop, at the header's right end
window.__back=()=>{const a=document.querySelector('.wall-head a.xp-close'),h=document.querySelector('.wall-head');if(!a)return JSON.stringify({found:false});
 const r=a.getBoundingClientRect(),hs=getComputedStyle(h),pr=parseFloat(hs.paddingRight),pt=parseFloat(hs.paddingTop),k=a.querySelector('kbd');
 return JSON.stringify({found:true,tag:a.tagName,href:a.getAttribute('href'),cls:a.className,tabIndex:a.tabIndex,label:a.getAttribute('aria-label'),text:a.textContent.trim(),
  rightGap:+(innerWidth-r.right).toFixed(1),padRight:pr,topGap:+r.top.toFixed(1),padTop:pt,height:Math.round(r.height),
  samePlaceAsShelf:Math.abs(innerWidth-r.right-pr)<0.6&&Math.abs(r.top-pt)<0.6,
  kbdShown:!!k&&getComputedStyle(k).display!=='none',focusable:a.matches('a[href]')})};
// ---- the stage's marks over time (?tl): when data-fit, data-shown, data-drawn, data-plain and data-live change, and how many canvases and visible tiles there are then
window.__tl=[];
(()=>{
 if(!/[?&]tl(&|$)/.test(location.search))return;
 const snap=()=>{const s=document.querySelector('.wall-stage');if(!s)return null;const d=s.dataset;
  const t0=s.querySelector('.wall-tile').getBoundingClientRect(),cols=d.grid?JSON.parse(d.grid).cols:null; // the first link's place (to 10 px) and the grid's columns: a layout jump while the links show is a change here
  return {fit:d.fit!==undefined,shown:d.shown!==undefined,drawn:d.drawn!==undefined,plain:d.plain!==undefined,live:d.live!==undefined,canvases:document.querySelectorAll('.wall-canvas').length,cols,tile0:[Math.round(t0.left/10)*10,Math.round(t0.top/10)*10,Math.round(t0.width/10)*10],
   listOpacity:+getComputedStyle(s.querySelector('.wall-links')).opacity,tilesVisible:[...document.querySelectorAll('.wall-tile')].filter(a=>+getComputedStyle(a).opacity*+getComputedStyle(a.closest('.wall-links')).opacity>0.5).length}};
 const note=()=>{const v=snap();if(!v)return;const p=window.__tl.at(-1);const k=JSON.stringify(v);if(!p||p.k!==k)window.__tl.push({t:Math.round(performance.now()),k,...v})};
 new MutationObserver(note).observe(document,{attributes:true,subtree:true,childList:true,attributeFilter:['data-fit','data-shown','data-drawn','data-plain','data-live']});
 setInterval(note,100);
 // a headless page that is only waiting (for a held back script) is not given frames, so the CSS animation that shows the server's links and every timer stand still; a frame loop keeps it running
 const keep=()=>requestAnimationFrame(keep);keep();
})();
// ---- the Back pill: on screen, over nothing, the first tab stop of the page's content (R51.2b)
window.__backOnScreen=()=>{const a=document.querySelector('.wall-head a.xp-close');if(!a)return JSON.stringify({found:false});
 const r=a.getBoundingClientRect(),n=document.querySelector('.wall-name').getBoundingClientRect(),c=document.querySelector('.wall-count').getBoundingClientRect();
 const cy=r.top+r.height/2,hit=document.elementFromPoint(r.left+r.width/2,cy),hit2=document.elementFromPoint(r.left+r.height/2,cy),hit3=document.elementFromPoint(r.right-r.height/2,cy); // the pill's two round ends: their middles, not the box's corners
 const dockEl=document.querySelector('[data-dock-glass]');const dock=dockEl?dockEl.getBoundingClientRect():null;
 const hits=(b)=>!(r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom);
 const first=document.querySelector('.wall-links a'),head=document.querySelector('.wall-head');
 const tabbables=[...document.querySelectorAll('main a[href],main button')];
 return JSON.stringify({found:true,viewport:[innerWidth,innerHeight],box:[r.left,r.top,r.right,r.bottom].map(v=>+v.toFixed(1)),
  inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,opacity:+getComputedStyle(a).opacity,
  clickable:a.contains(hit)&&a.contains(hit2)&&a.contains(hit3),overHeading:hits(n)||hits(c),underDock:dock?hits(dock):false,
  headerBeforeWall:!!(head.compareDocumentPosition(document.querySelector('.wall-stage'))&Node.DOCUMENT_POSITION_FOLLOWING),
  backFirstTabStop:tabbables[0]===a,backBeforeFirstTile:!!(a.compareDocumentPosition(first)&Node.DOCUMENT_POSITION_FOLLOWING),
  headingLeftOfBack:n.left<r.left&&Math.abs(n.top-r.top)<60,height:Math.round(r.height)})};
// ---- a lost context on a wall (R51.2b): from the loss on, every animation frame says whether the canvas is there, the links are the wall (data-plain) and how many tiles show
window.__lose=()=>new Promise(res=>{const c=document.querySelector('.wall-canvas');if(!c){res(JSON.stringify({error:'no canvas'}));return}
 const gl=c.getContext('webgl2');const ext=gl&&gl.getExtension('WEBGL_lose_context');if(!ext){res(JSON.stringify({error:'no WEBGL_lose_context'}));return}
 const s=document.querySelector('.wall-stage'),n=document.querySelectorAll('.wall-tile').length,t0=performance.now();
 const rows=[];let holes=0,plainAt=null,canvasGoneAt=null;
 ext.loseContext();
 const f=()=>{const t=Math.round(performance.now()-t0),canvases=document.querySelectorAll('.wall-canvas').length,plain=s.dataset.plain!==undefined,
   visible=[...document.querySelectorAll('.wall-tile')].filter(a=>+getComputedStyle(a).opacity>0.99).length;
  if(canvasGoneAt===null&&canvases===0)canvasGoneAt=t;if(plainAt===null&&plain)plainAt=t;
  // a hole: no canvas to draw the wall and the links not yet showing all of it
  if(canvases===0&&visible<n)holes++;
  rows.push([t,canvases,plain?1:0,visible]);
  if(t<1500)requestAnimationFrame(f);else{const last=rows.at(-1);
   res(JSON.stringify({tiles:n,canvasGoneAtMs:canvasGoneAt,plainAtMs:plainAt,holeFrames:holes,frames:rows.length,final:{canvases:last[1],plain:!!last[2],tilesVisible:last[3]},
    inside:[...document.querySelectorAll('.wall-tile')].every(a=>{const r=a.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}),
    ok:holes===0&&last[1]===0&&!!last[2]&&last[3]===n}))}};
 requestAnimationFrame(f)});
// ---- long animation frames (what script made a long frame), kept from the start of the page
window.__loaf=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__loaf.push({t:Math.round(e.startTime),d:Math.round(e.duration),s:(e.scripts||[]).map(x=>(x.sourceURL.split('/').pop()||'-')+':'+x.invoker.slice(0,40)+':'+Math.round(x.duration)).join(';')})}).observe({type:'long-animation-frame',buffered:true})}catch(e){}
// ---- frame gaps
window.__frames=(ms,fn)=>new Promise(r=>{const g=[];let l=performance.now();const t0=l;const fa=[];if(fn)fn(ms);function f(n){g.push(n-l);if(n-l>20)fa.push(Math.round(n));l=n;if(n-t0<ms)requestAnimationFrame(f);else{g.shift();const w=window.__loaf.filter(e=>e.t+e.d>=t0&&e.t<=l).slice(0,4);g.sort((a,b)=>a-b);
 r(JSON.stringify({frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+g[Math.floor(g.length*.95)].toFixed(2),max:+g[g.length-1].toFixed(2),over20:g.filter(x=>x>20).length,...(fa.length?{slowAt:fa,longAnimationFrames:w}:{})}))}}requestAnimationFrame(f)});
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
  steps.push({ eval: "__backOnScreen()", label: `${tag}: the back pill is on screen, over nothing, the first tab stop` });
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

  // 3. the arrival (R51.2): the recorder reads every drawn frame (see __arrReport). Pictures at once, slow, unreachable, YouTube's grey 404, reduced motion
  const A = (label, query, extra = {}) => {
    steps.push({ ...extra, go: `{{BASE}}${path}${query}`, wait: 600 });
    steps.push({ eval: "__live(15000).then(v=>__arrReport().replace('{','{\"live\":'+v+','))", label: `${tag} arrival ${label}` });
  };
  steps.push({ reduce: false });
  A("(pictures at once)", "?arrrec");
  if (opts.film) {
    // every frame the compositor produces while the page loads and the wall arrives (the page navigates itself; the film outlives it),
    // saved every 50 ms for 1.5 s; the arrival is about half a second long and starts a few hundred ms after the load
    const ats = Array.from({ length: 31 }, (_, k) => k * 50);
    steps.push({ film: { ms: 2900, dark: 8, keep: `r51-wall-${tag}-arrival`, ats, eval: `location.href='${path}'` }, label: `${tag} arrival film` });
  }
  if (!phone) {
    A("(pictures 3 s late: art first)", "?arrrec&slowpics=3000");
    if (kind === "long") {
      A("(host unreachable)", "?arrrec&nopatch", { intercept: [{ match: "i.ytimg.com", fail: "NameNotResolved" }], nocache: true });
      A("(404 with the grey 120 by 90 picture)", "?arrrec&nopatch", { intercept: [{ match: "i.ytimg.com", status: 404, type: "image/png", body: GREY_404 }] });
      steps.push({ intercept: [], nocache: false });
    }
    A("(reduced motion)", "?arrrec", { reduce: true });
    steps.push({ reduce: false });
  }
  if (!phone && kind === "long") {
    // a slow connection (R51.2): three.js is still on its way when the page has arrived; the wait is bounded (5 s, ENGINE_WAIT_MS), then the plain
    // grid of links is the wall on the tiles' art. The throttle starts right after the click, so only the engine's own chunk is slow.
    steps.push({ net: { kbps: 100000, latency: 0 }, nocache: true, go: `{{BASE}}/work?nopatch`, wait: 2500 });
    steps.push({ eval: "window.__t0=performance.now();document.querySelector('[data-work-tab=\\\"/work/long-form\\\"]').click();1", label: `${tag} slow connection: click Long form` });
    steps.push({ net: { kbps: 150, latency: 150 }, eval: "new Promise(r=>{const t0=window.__t0;const log=[];const f=()=>{const s=document.querySelector('.wall-stage');const st=s?{live:s.dataset.live!==undefined,plain:s.dataset.plain!==undefined,changing:!!document.documentElement.dataset.changeKind,canvas:document.querySelectorAll('.wall-canvas').length,shown:[...document.querySelectorAll('.wall-tile')].filter(a=>+getComputedStyle(a).opacity>0.9).length}:{none:true,changing:!!document.documentElement.dataset.changeKind};if(!log.length||JSON.stringify(log.at(-1).st)!==JSON.stringify(st))log.push({t:Math.round(performance.now()-t0),st});if(performance.now()-t0>16000)r(JSON.stringify(log));else setTimeout(f,100)};f()})", label: `${tag} slow connection: states over time (changing, canvas made, plain after 5 s, links shown)` });
    steps.push({ shot: `slow-warm-${tag}` });
    steps.push({ shot: `local-r51-wall-${tag}-slow-plain` });
    steps.push({ net: { kbps: 100000, latency: 0 }, nocache: false });
  }
  if (!phone) {
    // a slow first load (R51.2b): the page's scripts are held back 6 s (so the server's links, shown from about 3 s, have been on screen for seconds before the page runs) and three.js
    // a further time. Frames of the whole load, tiles counted in each: after the wall has been seen it must never go blank (blankFramesAfterShown 0).
    //  (a) three.js arrives 1.5 s later: the links stay, the engine draws whole tiles at once and the links fade out under them;
    //  (c) only three.js is late (4 s): the links are shown 1.5 s after the wall could start and stay until the engine has drawn;
    //  (b) three.js never arrives in time (14 s, the engine's wait is 5 s): the links are the wall.
    const slowLoad = (label, threeMs, keep, jsMs = 6000) => {
      steps.push({ net: { kbps: 100000, latency: 0 }, nocache: true, intercept: [{ match: "three.module", delay: threeMs }, ...(jsMs ? [{ match: ".js", delay: jsMs }] : [])], go: "about:blank", wait: 1500 }); // the film navigates from a page that is really blank (a slow navigation would cancel it)
      steps.push({ film: { ms: 22000, dark: 8, keep: `local-r51-${tag}-firstload-${keep}`, ats: [1500, 2400, 2700, 3000, 3500, 4500, 6000, 7000, 8500, 10000, 13000], tiles: true, eval: `location.href='{{BASE}}${path}?tl'` }, label: `${tag} slow first load ${label}: frames` });
      steps.push({ eval: "JSON.stringify({timeline:window.__tl.map(({k,...r})=>r),focusable:document.querySelectorAll('.wall-links a').length})", label: `${tag} slow first load ${label}: the stage's marks over time` });
      steps.push({ intercept: [], nocache: false, net: { kbps: 100000, latency: 0 } });
    };
    slowLoad("(a) three.js 1.5 s later", 1500, "a");
    // (c) the page's own scripts are quick but three.js is held 4 s: the wall must not stay blank until it comes: the links show from 1.5 s after the wall could start and fade out under the engine
    slowLoad("(c) only three.js 4 s late", 4000, "c", 0);
    if (kind === "long") slowLoad("(b) three.js too late", 14000, "b");
    // the same load with the first tile focused by the keyboard while the engine is not drawing yet: a focused link is visible, with its ring
    steps.push({ net: { kbps: 100000, latency: 0 }, nocache: true, intercept: [{ match: "three.module", delay: 6000 }], reduce: false, go: `{{BASE}}${path}`, wait: 3000 });
    steps.push({ key: "Tab", vk: 9 });
    steps.push({ key: "Tab", vk: 9 });
    steps.push({ eval: "new Promise(r=>setTimeout(()=>{const a=document.activeElement,s=document.querySelector('.wall-stage');const c=a?getComputedStyle(a):null;r(JSON.stringify({onTile:!!a&&a.classList.contains('wall-tile'),focusVisible:!!a&&a.matches(':focus-visible'),fit:s.dataset.fit!==undefined,drawn:s.dataset.drawn!==undefined,plain:s.dataset.plain!==undefined,opacity:c&&+c.opacity,outline:c&&c.outlineStyle+' '+c.outlineWidth,othersHidden:[...document.querySelectorAll('.wall-tile')].filter(t=>t!==a&&+getComputedStyle(t).opacity<0.01).length}))},800))", label: `${tag} before the engine draws: a focused tile shows with its ring` });
    steps.push({ shot: `focus-early-warm-${tag}` });
    steps.push({ shot: `r51-wall-${tag}-focus-before-engine` });
    steps.push({ intercept: [], nocache: false });
    // a lost context on a wall (R51.2b): the links are the wall again with no hole (a frame with no canvas and the links not all showing)
    steps.push({ reduce: false, go: `{{BASE}}${path}`, wait: 1500 });
    steps.push(LIVE(`${tag}: live (for the lost context)`));
    steps.push({ wait: 800 });
    steps.push({ eval: "__lose()", label: `${tag}: lost context: the plain list at once, no hole` });
    steps.push({ shot: `lost-warm-${tag}` });
    steps.push({ shot: `r51-wall-${tag}-lost-context` });
  }
  // 4. no WebGL: the links
  steps.push({ eval: "__nogl(true)", label: `${tag}: webgl refused` });
  steps.push({ go: `{{BASE}}${path}`, wait: 2500 });
  steps.push({ eval: "__fallback()", label: `${tag}: fallback (no WebGL)` });
  steps.push({ shot: `fb-warm-${tag}` });
  steps.push({ shot: `r43-wall-${tag}-fallback` });
  steps.push({ eval: "__nogl(false)", label: `${tag}: webgl allowed again` });
  // 5. the way back: the back button (a link, a tab stop), focused by keyboard, Enter goes to the rings through the one radial change
  steps.push({ go: `{{BASE}}${path}`, wait: 1500 });
  steps.push(LIVE(`${tag}: live (for the way back)`));
  steps.push({ eval: "__back()", label: `${tag}: the back button` });
  steps.push({ key: "Shift", vk: 16 }); // a key press first, so the browser treats the focus that follows as the keyboard's and draws the ring
  steps.push({ eval: "document.querySelector('.wall-head a.xp-close').focus();window.__kinds=[];(()=>{const a=document.querySelector('.wall-head a.xp-close'),c=getComputedStyle(a);return JSON.stringify({focused:document.activeElement===a,focusVisible:a.matches(':focus-visible'),outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth})})()", label: `${tag}: back button focused` });
  steps.push({ shot: `focus-warm-${tag}` });
  steps.push({ shot: `r51-wall-${tag}-back-focus` });
  steps.push({ key: "Enter", vk: 13, wait: 150 });
  steps.push({ eval: "new Promise(r=>{const t0=performance.now();const f=()=>{if(location.pathname==='/work'&&document.documentElement.dataset.changeKind===undefined)r(JSON.stringify({path:location.pathname,kinds:window.__kinds,wallCanvases:document.querySelectorAll('.wall-canvas').length,ms:Math.round(performance.now()-t0)}));else if(performance.now()-t0>9000)r('timeout '+location.pathname+' '+JSON.stringify(window.__kinds));else setTimeout(f,50)};f()})", label: `${tag}: Enter on Back goes to the rings` });
  return steps;
}

const D = { name: "1440", w: 1440, h: 900 };
const M = { name: "1024", w: 1024, h: 768 };
const P = { name: "390", w: 390, h: 844, phone: true };
// the odd screens of the Review Focus (geometry only): a tablet, a phone on its side, the smallest phone
const T820 = { name: "820", w: 820, h: 1180 };
const L844 = { name: "844x390", w: 844, h: 390, phone: true };
const S320 = { name: "320", w: 320, h: 568, phone: true };

// The dock row's links are clicked from inside the page (a real `click()` on the link: PageLink handles it like a pointer click),
// since the steps file has fixed coordinates.
const moveSteps = [
  // R51.2: the wall's arrival runs after the 3.5 s reveal settles (so it is seen), never during it: the canvas is made after the change ends
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, reduce: false, go: "{{BASE}}/work?arrrec", wait: 1800 },
  { eval: "window.__chg={began:null,end:null};new MutationObserver(()=>{const k=document.documentElement.dataset.changeKind;if(k&&window.__chg.began===null)window.__chg.began=performance.now();if(!k&&window.__chg.began!==null&&window.__chg.end===null)window.__chg.end=performance.now()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-change-kind']});document.querySelector('[data-work-tab=\"/work/long-form\"]').click();setTimeout(()=>{window.__chg.linksShown=[...document.querySelectorAll('.wall-tile')].filter(a=>+getComputedStyle(a).opacity>0.05).length;window.__chg.canvases=document.querySelectorAll('.wall-canvas').length;window.__chg.tilesInPage=document.querySelectorAll('.wall-tile').length},1500);1", label: "reveal: click Long form from the rings" },
  { eval: "new Promise(r=>{const t0=performance.now();const f=()=>{const c=document.querySelector('.wall-canvas');if(c&&c.dataset.arrived!==undefined&&window.__chg.end!==null){const a=window.__arr,abs=a.frames.map(x=>a.canvasAt+x[0]);r(JSON.stringify({changeMs:Math.round(window.__chg.end-window.__chg.began),at1500ms:{tilesInPage:window.__chg.tilesInPage,linksShown:window.__chg.linksShown,canvases:window.__chg.canvases},firstDrawAfterChangeEndMs:Math.round(a.canvasAt-window.__chg.end),drawsBeforeChangeEnd:abs.filter(t=>t<window.__chg.end).length,draws:a.frames.length,startMs:+c.dataset.startMs,startPictures:+c.dataset.startPictures,tilesWholeAtEnd:a.frames.at(-1)[1]}))}else if(performance.now()-t0>15000)r('timeout');else setTimeout(f,50)};f()})", label: "reveal: the wall arrives after the change ends, not during it" },
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
  ...wall("long", D, { film: 2600 }),
  ...wall("short", D, { film: 2600 }),
  ...wall("long", M, { geometryOnly: true }),
  ...wall("short", M, { geometryOnly: true }),
  ...wall("long", T820, { geometryOnly: true }),
  ...wall("short", T820, { geometryOnly: true }),
  ...wall("long", L844, { geometryOnly: true }),
  ...wall("short", L844, { geometryOnly: true }),
  ...wall("long", S320, { geometryOnly: true }),
  ...wall("short", S320, { geometryOnly: true }),
  ...wall("long", P, { film: 2600 }),
  ...wall("short", P, { film: 2600 }),
  ...moveSteps,
];
writeFileSync(new URL("./gallery.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
console.log(`gallery.json: ${steps.length} steps`);
