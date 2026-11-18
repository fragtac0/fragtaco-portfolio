// The browser-side init script of the gallery audit (make-gallery.mjs): thumbnail patching, the geometry, the recorders and the helpers the steps call,
// and the grey 120 by 90 picture YouTube answers a removed video with (made here, so no network is needed).
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
export const GREY_404 = png(120, 90, 160);

export const init = `
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
window.__wallTrace=[];
window.__driftCheck=()=>{const t=window.__wallTrace.filter((r)=>Math.abs(r[1])<1e6);if(!t.length)return {ok:false,rows:0};const first=t[0];let mx=0,my=0;for(const r of t){mx=Math.max(mx,Math.abs(r[1]));my=Math.max(my,Math.abs(r[2]))}const firstPx=Math.hypot(first[1],first[2]);return {rows:t.length,firstFrameOffsetPx:+firstPx.toFixed(3),maxAbsX:+mx.toFixed(2),maxAbsY:+my.toFixed(2),ok:firstPx<0.5&&mx<=6.01&&my<=6.01}};
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
