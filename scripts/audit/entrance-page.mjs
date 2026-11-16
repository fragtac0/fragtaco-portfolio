// What make-experience-entrance.mjs runs inside the page (R56.6, round 7 second look spec 8): expressions for Runtime.evaluate, as strings. Nothing here
// touches the app's code: it reads the page the way a visitor's browser would (computed opacities, pixels of the canvases, performance marks).

/** The reveal's own times (ms after the anchor): the five of spec 8's check. */
export const TARGETS = (T) => [0.6 * T, 0.8 * T, T, T + 1100, T + 3200];

/**
 * Starts the sampler: every frame a row (time from the anchor, letters shown in the title and the label, beads in, the entrance's state), and at each target time one
 * snapshot with the pixels read (the trail's cream line, the radar's orange). The anchor is the reveal's start (`arrival-go`, mode 'change') or the moment the page began
 * to play (`data-entrance` became `play`, mode 'load': the picture was shown). The frame gaps are kept for the verdict.
 */
export const ARM = (mode, T = 2250) => String.raw`(()=>{
const S=window.__sam={rows:[],snaps:[],gaps:[],anchor:null,mode:${JSON.stringify(mode)},T:${T},targets:${JSON.stringify(TARGETS(T))},next:0,done:false};
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const shown=sel=>{const l=qa(sel+' .map-letter');return [l.filter(x=>+getComputedStyle(x).opacity>0.5).length,l.length]};
const px=(sel,test)=>{const c=q(sel),x=c&&c.getContext('2d');if(!x)return 0;const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(test(d[i],d[i+1],d[i+2],d[i+3]))n++;return n};
const cream=()=>px('.map-trail',(r,g,b,a)=>a>=200&&r>=235&&g>=235&&b>=200);
const orange=()=>px('.map-radar',(r,g,b,a)=>a>40&&r>200&&g<150);
const row=(t,now)=>{const [tl,tt]=shown('.map-title'),[ll,lt]=shown('.map-caption-title');const pins=qa('.map-pin');return {t:+t.toFixed(1),title:tl,titleTotal:tt,label:ll,labelTotal:lt,desc:+getComputedStyle(q('.map-text')).opacity,lines:qa('.map-caption .map-rise').map(x=>+getComputedStyle(x).opacity),pinsIn:pins.filter(p=>!p.hasAttribute('data-wait')).length,pins:pins.length,state:q('.map-page')?.dataset.entrance}};
let last=performance.now();
const loop=now=>{S.gaps.push([now,now-last]);last=now;
 if(S.anchor===null){if(S.mode==='change'){const e=performance.getEntriesByName('arrival-go').at(-1);if(e)S.anchor=e.startTime}else if(window.__playAt!==null)S.anchor=window.__playAt}
 if(S.anchor!==null&&q('.map-page')){const t=now-S.anchor,r=row(t,now);S.rows.push(r);
  while(S.next<S.targets.length&&t>=S.targets[S.next]){S.snaps.push({at:S.targets[S.next],...r,cream:cream(),orange:orange()});S.next++}
  if(t>S.T+4300){S.done=true;return}}
 requestAnimationFrame(loop)};
requestAnimationFrame(loop);return 'armed'})()`;

export const INIT = String.raw`try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__ls=[];window.__loaf=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__loaf.push({s:e.startTime,d:e.duration,b:e.blockingDuration||0,sc:(e.scripts||[]).map(x=>(x.invoker||'')+' '+(x.sourceFunctionName||'')+' '+(x.sourceURL||'').split('/').pop()+':'+(x.sourceCharPosition||0)+' '+x.duration.toFixed(0)+(x.forcedStyleAndLayoutDuration>5?' forced'+x.forcedStyleAndLayoutDuration.toFixed(0):'')).slice(0,6)})}).observe({type:'long-animation-frame',buffered:true})}catch(e){}
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__ls.push({t:e.startTime,v:e.value,input:e.hadRecentInput})}).observe({type:'layout-shift',buffered:true})}catch(e){}
window.__playAt=null;
try{if(sessionStorage.getItem('ft:nocanvas')==='1')HTMLCanvasElement.prototype.getContext=()=>null}catch(e){}
{const arm=()=>{const p=document.querySelector('.map-page');if(!p)return requestAnimationFrame(arm);if(p.dataset.entrance==='play'&&window.__playAt===null)window.__playAt=performance.now();new MutationObserver(()=>{if(p.dataset.entrance==='play'&&window.__playAt===null)window.__playAt=performance.now()}).observe(p,{attributes:true,attributeFilter:['data-entrance']})};requestAnimationFrame(arm)}` + `\ntry{if(sessionStorage.getItem('ft:armLoad')==='1'){sessionStorage.removeItem('ft:armLoad');${ARM('load')}}}catch(e){}`;

/** Waits for the sampler to finish, then answers its verdict: spec 8's pictures as numbers, the frame gaps, the layout shifts, the clock's start. */
export const VERDICT = String.raw`(async()=>{
const S=window.__sam;for(let i=0;i<200&&!S.done;i++)await new Promise(r=>setTimeout(r,100));
const [s6,s8,sT,s11,s32]=S.snaps;if(S.snaps.length<5)return JSON.stringify({ok:false,error:'snaps',n:S.snaps.length,anchor:S.anchor});
const inWin=S.gaps.filter(([n])=>n>=S.anchor&&n<=S.anchor+S.T+4000);const win=inWin.map(x=>x[1]);const sorted=[...win].sort((a,b)=>a-b);
// a frame over 34 ms that is the heights' load (an idle callback that runs once, as soon as the change is over: it was there before the entrance) is told apart from one that is not
const idle=window.__loaf.filter(e=>e.sc.some(x=>/IdleRequestCallback/.test(x)));const long34=inWin.filter(x=>x[1]>34);// ... and from the frame after one of the sampler's own pixel reads (a snapshot reads two canvases: tens of ms the page does not spend)
const own34=long34.filter(x=>!idle.some(e=>x[0]>=e.s&&x[0]<=e.s+e.d+34)&&!S.snaps.some(sn=>x[0]>=S.anchor+sn.t&&x[0]<=S.anchor+sn.t+200));
const shifts=window.__ls.filter(e=>!e.input&&e.t>=S.anchor&&e.t<=S.anchor+S.T+4000);
const firstOf=f=>{const r=S.rows.find(f);return r?r.t:null};

const o={
 anchor:+S.anchor.toFixed(1),lagFromReveal:S.mode==='change'&&window.__playAt!==null?+(window.__playAt-S.anchor).toFixed(1):null,
 at06:{title:s6.title,label:s6.label,desc:s6.desc,pinsIn:s6.pinsIn,cream:s6.cream},
 at08:{title:s8.title+'/'+s8.titleTotal,label:s8.label,cream:s8.cream,pinsIn:s8.pinsIn},
 atT:{title:sT.title+'/'+sT.titleTotal,label:sT.label+'/'+sT.labelTotal,cream:sT.cream,pinsIn:sT.pinsIn},
 atT1100:{cream:s11.cream,share:+(s11.cream/Math.max(1,s32.cream)).toFixed(2),pinsIn:s11.pinsIn,orange:s11.orange},
 atT3200:{title:s32.title+'/'+s32.titleTotal,label:s32.label+'/'+s32.labelTotal,desc:s32.desc,lines:s32.lines,cream:s32.cream,orange:s32.orange,pinsIn:s32.pinsIn},
 firstLetterAt:firstOf(r=>r.title>0),firstCreamSnapAt:S.snaps.find(x=>x.cream>0)?.at??null,
 frames:win.length,medianGapMs:+sorted[Math.floor(sorted.length/2)].toFixed(1),maxGapMs:+sorted.at(-1).toFixed(1),over20:win.filter(x=>x>20).length,over34:long34.length,over34Idle:long34.length-own34.length,over34Own:own34.length,over34Own_at:own34.map(x=>[+(x[0]-S.anchor).toFixed(0),+x[1].toFixed(0)]),over34At:inWin.filter(x=>x[1]>34).map(x=>[+(x[0]-S.anchor).toFixed(0),+x[1].toFixed(0)]),loaf:window.__loaf.filter(e=>e.s+e.d>=S.anchor&&e.s<=S.anchor+S.T+4000&&e.d>40).map(e=>({at:+(e.s-S.anchor).toFixed(0),d:+e.d.toFixed(0),b:+e.b.toFixed(0),sc:e.sc})),
 layoutShifts:shifts.length,layoutShiftSum:+shifts.reduce((a,e)=>a+e.v,0).toFixed(5),
};
o.checks={
 nothingAt06:s6.title===0&&s6.label===0&&s6.desc<0.05&&s6.lines.every(x=>x<0.05)&&s6.pinsIn===0&&s6.cream===0,
 titlePartlyAt08:s8.title>=1&&s8.title<s8.titleTotal&&s8.cream===0&&s8.pinsIn===0,
 titleInAtTNoTrail:sT.title===sT.titleTotal&&sT.cream<0.03*s32.cream,
 halfDrawnAtT1100:o.atT1100.share>0.35&&o.atT1100.share<0.65&&s11.pinsIn>=3&&s11.pinsIn<=5&&s11.orange===0,
 everythingAtT3200:s32.title===s32.titleTotal&&s32.label===s32.labelTotal&&s32.desc>0.95&&s32.lines.every(x=>x>0.95)&&s32.pinsIn===s32.pins&&s32.orange>0&&s32.cream>0,
 noLayoutShift:shifts.length===0,
 noOwnFrameOver34:o.over34Own===0};
o.ok=Object.values(o.checks).every(Boolean);
return JSON.stringify(o)})()`;

/** The layout of spec 7, read from the page once the entrance is over: where the two blocks are, and how clear of the cliff, the beads, the trail and the switch. */
export const CLEAR = (cliff, wide) => String.raw`(async()=>{
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
for(let i=0;i<150&&!(q('.map-page')?.dataset.entrance==='done'&&q('.map-stage')?.dataset.terrain==='ready');i++)await sleep(100);
await sleep(300);
const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};
const W=innerWidth,H=innerHeight,page=q('.map-page'),head=R(q('.map-heading')),cap=R(q('.map-caption')),sw=R(q('.map-mode')),dock=R(q('[data-dock-glass]'));
const gutter=parseFloat(getComputedStyle(page).getPropertyValue('--map-gutter'))||48;
const M=new DOMMatrixReadOnly(getComputedStyle(q('.map-plane')).transform);const at=(x,y)=>{const p=M.transformPoint(new DOMPoint(x,y));return [p.x/p.w,p.y/p.w]};
const gap=(a,b)=>Math.hypot(Math.max(a.l-b.r,0,b.l-a.r),Math.max(a.t-b.b,0,b.t-a.b));
const sum=at(500,325);const o={W,H,words:page.dataset.words??null,engine:page.dataset.engine,titleSize:parseFloat(getComputedStyle(q('.map-title')).fontSize),head:[head.l,head.t,head.r,head.b].map(Math.round),cap:[cap.l,cap.t,cap.r,cap.b].map(Math.round),summitRow:Math.round(sum[1])};
if(${wide}){
 const ring=${JSON.stringify(cliff)}.map(([x,y])=>at(x,y));let left=Infinity;
 ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];for(let s=0;s<=400;s++){const x=a[0]+(b[0]-a[0])*s/400,y=a[1]+(b[1]-a[1])*s/400;if(y>=head.t&&y<=head.b)left=Math.min(left,x)}});
 o.cliffGap=+(left-head.r).toFixed(1);o.titleRowOffset=+((head.t+head.b)/2-sum[1]).toFixed(2);o.headLeft=Math.round(head.l);o.capRightGap=+(W-gutter-cap.r).toFixed(2);
 o.captionMoved=+((cap.t+cap.b)/2-sum[1]).toFixed(1);
 const beads=qa('.map-bead').map(b=>{const r=R(b);return {x:(r.l+r.r)/2,y:(r.t+r.b)/2,rad:r.w/2}});
 o.beadGap=+Math.min(...beads.map(b=>Math.hypot(Math.max(cap.l-b.x,0,b.x-cap.r),Math.max(cap.t-b.y,0,b.y-cap.b))-b.rad)).toFixed(1);
 const c=q('.map-trail'),k=c.width/W,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let trailGap=Infinity;
 const x0=Math.max(0,Math.floor((cap.l-60)*k)),x1=Math.min(c.width,Math.ceil((cap.r+60)*k)),y0=Math.max(0,Math.floor((cap.t-60)*k)),y1=Math.min(c.height,Math.ceil((cap.b+60)*k));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d[(y*c.width+x)*4+3]>=100){const px=x/k,py=y/k;trailGap=Math.min(trailGap,Math.hypot(Math.max(cap.l-px,0,px-cap.r),Math.max(cap.t-py,0,py-cap.b)))}
 o.trailGap=+trailGap.toFixed(1);o.switchGap=+gap(cap,sw).toFixed(1);o.dockGap=+gap(cap,dock).toFixed(1);
 const spans=qa('.map-caption-line,.map-caption-fact,.map-caption-credit').map(s=>{const w=R(s).w,m=parseFloat(getComputedStyle(s).maxWidth);return {w:Math.round(w),max:Math.round(m)}});o.spans=spans;
 o.ok=o.words===null&&o.titleSize>=34&&o.cliffGap>=24&&Math.abs(o.titleRowOffset)<1.5&&Math.abs(o.headLeft-gutter)<1&&Math.abs(o.capRightGap)<1&&o.beadGap>=32&&o.trailGap>=32&&o.switchGap>=32&&o.dockGap>=0&&spans.every(s=>s.w<=s.max+1)&&head.t>=0&&cap.t>=0&&cap.b<=H;
}else{
 o.headTop=Math.round(head.t);o.headLeft=Math.round(head.l);o.capLeft=Math.round(cap.l);o.capAboveDock=+(dock.t-cap.b).toFixed(1);o.titleSizeWant=+Math.min(64,Math.max(34,W*0.046)).toFixed(2);
 o.ok=o.words==='old'&&Math.abs(head.l-gutter)<1&&Math.abs(cap.l-gutter)<1&&head.t<=40&&cap.b<=dock.t&&Math.abs(o.titleSize-o.titleSizeWant)<0.1;
}
return JSON.stringify(o)})()`;

/** Starts the change into My experience from the page the steps are on, with the sampler armed, and answers once the sampler's anchor is `afterMs` old. */
export const START = (mode, afterMs = 0) => String.raw`(async()=>{window.__t0=performance.now();${ARM(mode)};window.__ftChange('/experience');
for(let i=0;i<300&&!(window.__sam.anchor!==null&&performance.now()-window.__sam.anchor>=${afterMs});i++)await new Promise(r=>setTimeout(r,20));return JSON.stringify({anchor:window.__sam.anchor,now:performance.now()})})()`;

/** After a press: waits `ms`, then reads what is shown now and what the trail's cream pixels are a few seconds later (a trail drawn at once is already whole). */
export const FINISHED = (ms) => String.raw`(async()=>{const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];await new Promise(r=>setTimeout(r,${ms}));
const px=(sel,t)=>{const c=q(sel);const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(t(d[i],d[i+1],d[i+2],d[i+3]))n++;return n};
const cream=()=>px('.map-trail',(r,g,b,a)=>a>=200&&r>=235&&g>=235&&b>=200);
const now=()=>({state:q('.map-page').dataset.entrance,mode:q('.map-page').dataset.mode,letters:qa('.map-letter').filter(x=>+getComputedStyle(x).opacity>0.95).length,total:qa('.map-letter').length,rise:qa('.map-rise').filter(x=>+getComputedStyle(x).opacity>0.95).length,riseTotal:qa('.map-rise').length,pinsIn:qa('.map-pin').filter(p=>!p.hasAttribute('data-wait')).length,pins:qa('.map-pin').length,cream:cream(),orange:px('.map-radar',(r,g,b,a)=>a>40&&r>200&&g<150)});
const a=now();await new Promise(r=>setTimeout(r,3500));const b=now();
const o={soon:a,later:b,whole:a.cream>=0.97*b.cream};o.ok=a.state==='done'&&a.letters===a.total&&a.rise===a.riseTotal&&a.pinsIn===a.pins&&o.whole&&a.orange>0;return JSON.stringify(o)})()`;

/** A bead that has the focus is shown, though the trail's tip has not reached it. */
export const FOCUS = String.raw`(async()=>{const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const pin=qa('.map-pin').at(-1);const before={wait:pin.hasAttribute('data-wait'),disabled:pin.disabled,op:+getComputedStyle(pin).opacity,hasFocus:document.hasFocus()};
pin.focus();await new Promise(r=>setTimeout(r,150));
const after={wait:pin.hasAttribute('data-wait'),op:+getComputedStyle(pin).opacity,focused:document.activeElement===pin,focusVisible:pin.matches(':focus-visible')};
return JSON.stringify({before,after,ok:before.wait&&after.wait&&after.focused&&after.op>0.3&&after.op>before.op})})()`;

/** Back from My climb: nothing plays again, the words fade in as they do, and the trail is whole. */
export const BACK = String.raw`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const btn=n=>[...document.querySelectorAll('.map-mode-button')].find(x=>x.textContent===n);
const px=(sel,t)=>{const c=q(sel);const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(t(d[i],d[i+1],d[i+2],d[i+3]))n++;return n};
const cream=()=>px('.map-trail',(r,g,b,a)=>a>=200&&r>=235&&g>=235&&b>=200);
for(let i=0;i<150&&!(q('.map-page').dataset.entrance==='done'&&btn('My climb')&&!btn('My climb').disabled);i++)await sleep(100);
await sleep(500);const before=cream();btn('My climb').click();await sleep(4500);const inClimb=['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity);
btn('Overview').click();const names=new Set();const t0=performance.now();let mid=null;
while(performance.now()-t0<2400){for(const a of document.getAnimations())if(/map-(letter|rise|fade)-in/.test(a.animationName||''))names.add(a.animationName);if(mid===null&&performance.now()-t0>250)mid=['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity);await new Promise(r=>requestAnimationFrame(r))}
const after=cream();const o={entrance:q('.map-page').dataset.entrance,inClimb,fadingBack:mid,backIn:['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity),replayed:[...names],pinsIn:qa('.map-pin').filter(p=>!p.hasAttribute('data-wait')).length,pins:qa('.map-pin').length,creamBefore:before,creamAfter:after};
o.ok=o.entrance==='done'&&inClimb.every(x=>x<0.05)&&o.fadingBack.every(x=>x>0&&x<1)&&o.backIn.every(x=>x===1)&&o.replayed.length===0&&o.pinsIn===o.pins&&after>=0.95*before;return JSON.stringify(o)})()`;

/** Reduced motion: no letters and no drawing; everything fades in together over 200 ms when the (120 ms) reveal ends. */
export const REDUCED = String.raw`(async()=>{const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const px=(sel,t)=>{const c=q(sel);const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(t(d[i],d[i+1],d[i+2],d[i+3]))n++;return n};
const names=new Set(),rows=[];let anchor=null,idle=0;const t00=performance.now();window.__ftChange('/experience');
await new Promise(res=>{const f=now=>{if(anchor===null){const e=performance.getEntriesByName('arrival-go').at(-1);if(e)anchor=e.startTime}
 const p=q('.map-page');if(anchor!==null&&p){const t=now-anchor;for(const a of document.getAnimations())if(/map-(letter|rise|fade)-in/.test(a.animationName||''))names.add(a.animationName);
  const ops=qa('.map-letter').map(x=>+getComputedStyle(x).opacity);rows.push({t:+t.toFixed(0),min:Math.min(...ops),max:Math.max(...ops),pinsIn:qa('.map-pin').filter(x=>!x.hasAttribute('data-wait')).length,state:p.dataset.entrance});if(t>1500)return res()}
 if(now-t00>12000)return res();requestAnimationFrame(f)};requestAnimationFrame(f)});
const last=rows.at(-1),firstShown=rows.find(r=>r.max>0.05),full=rows.find(r=>r.min>0.95);
const o={anchor,names:[...names],revealEnd:120,firstShownAt:firstShown?.t,fullAt:full?.t,fadeMs:firstShown&&full?full.t-firstShown.t:null,togetherMax:+Math.max(...rows.map(r=>r.max-r.min)).toFixed(2),pinsInAtFull:full?.pinsIn,pins:qa('.map-pin').length,
 cream:px('.map-trail',(r,g,b,a)=>a>=200&&r>=235&&g>=235&&b>=200),finalState:last?.state};
o.ok=o.names.every(n=>n==='map-fade-in')&&o.names.length>0&&firstShown&&firstShown.t>=100&&o.fadeMs>=120&&o.fadeMs<=320&&full&&full.pinsIn===o.pins&&o.cream>0;return JSON.stringify(o)})()`;

/** No map (no canvas): the words still enter, in their old places, with no trail and no beads. */
export const NOMAP = String.raw`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const S=window.__sam;for(let i=0;i<150&&!S.done;i++)await sleep(100);
const letters=qa('.map-letter'),shown=letters.filter(x=>+getComputedStyle(x).opacity>0.95).length;const first=S.rows.find(r=>r.title>0);
const o={engine:q('.map-page').dataset.engine,words:q('.map-page').dataset.words,state:q('.map-page').dataset.entrance,letters:[shown,letters.length],pins:qa('.map-pin').length,list:!!q('.map-fallback-list'),firstLetterAt:first?first.t:null,anchor:S.anchor};
o.ok=o.engine==='off'&&o.words==='old'&&o.pins===0&&o.list&&shown===letters.length&&first!==undefined&&first.t>=1400;return JSON.stringify(o)})()`;

/** After a click on the switch during the trail: the entrance is done, everything is shown, and the click's action was taken (My climb). */
export const CLICKED = String.raw`(async()=>{const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];await new Promise(r=>setTimeout(r,400));
const o={state:q('.map-page').dataset.entrance,mode:q('.map-page').dataset.mode,letters:qa('.map-letter').filter(x=>+getComputedStyle(x).opacity>0.95).length,total:qa('.map-letter').length,pinsIn:qa('.map-pin').filter(p=>!p.hasAttribute('data-wait')).length,pins:qa('.map-pin').length};
o.ok=o.state==='done'&&o.mode==='climb'&&o.letters===o.total&&o.pinsIn===o.pins;return JSON.stringify(o)})()`;
