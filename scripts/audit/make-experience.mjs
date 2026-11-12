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
//   reduced motion (the move is instant); phone overview, a double tap and a drag;
//   the heading and caption clear of the cliff ring at 1280, 1024, 1366, 1920 and 2560 wide (column layout, or stacked).
// R45.3 (the route, the moments, the places, the words): all nine markers visible and clear of each other and their year pills at the
//   overview (1440 x 900 and 390 x 844), pills inside the screen, no marker at the summit, the route's last point is the ping,
//   the line is 2 px at every zoom, drawn over 1.6 s, the ping rings every 2.4 s; a click and [ ] fly to a moment and show its card
//   (the sheet above the dock on a phone); Places hides the route and the moments and shows 8 labels clear of each other and
//   inside the screen, Olympus Rupes on the cliff trace; the phone heading is two lines with a More button; reduced motion;
//   the picture behind the heading and the caption is sampled (text hidden) for the 4.5:1 contrast.
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


// --- R45.3 helpers: run inside the page ---
const H = `const P=()=>{const c=getComputedStyle(${PAGE});return {s:+c.getPropertyValue('--map-s'),cx:+c.getPropertyValue('--map-cx'),cy:+c.getPropertyValue('--map-cy')}};const R=el=>{const r=el.getBoundingClientRect();return {x0:r.left,y0:r.top,x1:r.right,y1:r.bottom}};const hit=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1;const inside=r=>r.x0>=0&&r.y0>=0&&r.x1<=innerWidth&&r.y1<=innerHeight;const sleep=ms=>new Promise(r=>setTimeout(r,ms));const toScreen=(X,Y)=>{const p=P();return [innerWidth/2+(X-p.cx)*p.s,innerHeight/2+(Y-p.cy)*p.s]};`;
const run = (body) => `(async()=>{${H}${SETTLE}${body}})()`;
const ctr = (sel) => `(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`;
const momentBtn = (n) => `.map-pins-journey .moment:nth-child(${n}) .moment-button`;

// every marker visible, none on another or on a year pill, pills inside the screen, none at the summit, the last point is the ping
const markers = (label) => ({
  eval: run(`await settle();await sleep(2200);const btns=[...document.querySelectorAll('.moment-button')],dots=btns.map(b=>R(b.querySelector('.moment-dot'))),years=btns.map(b=>R(b.querySelector('.moment-year')));const vis=btns.every(b=>getComputedStyle(b).opacity==='1'&&getComputedStyle(b.closest('.moment')).visibility==='visible'&&getComputedStyle(b.querySelector('.moment-year')).visibility==='visible');let dd=0,yy=0,yd=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){if(i<j&&hit(dots[i],dots[j]))dd++;if(i<j&&hit(years[i],years[j]))yy++;if(i!==j&&hit(years[i],dots[j]))yd++}const v=P(),line=document.querySelector('.route-line'),end=line.getPointAtLength(line.getTotalLength()),[ex,ey]=toScreen(end.x,end.y),ping=R(document.querySelector('.now-ping')),pc=[(ping.x0+ping.x1)/2,(ping.y0+ping.y1)/2],nowDot=R(document.querySelector('.moment[data-now] .moment-dot')),summit=[innerWidth/2,innerHeight/2],nearSummit=dots.filter(d=>Math.hypot((d.x0+d.x1)/2-summit[0],(d.y0+d.y1)/2-summit[1])<24).length;const w=+(parseFloat(getComputedStyle(line).strokeWidth)*v.s).toFixed(2);return JSON.stringify({markers:btns.length,visible:vis,dotOverlaps:dd,pillOverlaps:yy,pillOnDot:yd,pillsInside:years.every(inside),dotsInside:dots.every(inside),atSummit:nearSummit,endIsPing:Math.hypot(ex-pc[0],ey-pc[1])<1.5,nowDotAtEnd:Math.hypot(ex-(nowDot.x0+nowDot.x1)/2,ey-(nowDot.y0+nowDot.y1)/2)<1.5,lineWidthPx:w,ok:btns.length===9&&vis&&dd===0&&yy===0&&yd===0&&years.every(inside)&&dots.every(inside)&&nearSummit===0&&Math.hypot(ex-pc[0],ey-pc[1])<1.5&&Math.abs(w-2)<0.05})`),
  label,
});

const motion = (label) => ({
  eval: run(`const line=document.querySelector('.route-line'),a=line.getAnimations().map(x=>x.effect.getTiming().duration),ring=document.querySelector('.now-ping-ring').getAnimations().map(x=>[x.effect.getTiming().duration,x.effect.getTiming().iterations]);return JSON.stringify({routeAnimationMs:a,pingRing:ring,dataRoute:${PAGE}.dataset.route,ok:a.includes(1600)&&ring.some(r=>r[0]===2400&&r[1]===Infinity)})`),
  label,
});

const placesOk = (label) => ({
  eval: run(`await settle();await sleep(500);const labels=[...document.querySelectorAll('.place-label')].map(R),dots=[...document.querySelectorAll('.place-dot')].map(R);let ov=0,onDot=0;for(let i=0;i<labels.length;i++){for(let j=i+1;j<labels.length;j++)if(hit(labels[i],labels[j]))ov++;for(let k=0;k<dots.length;k++)if(hit(labels[i],dots[k]))onDot++}const routeHidden=getComputedStyle(document.querySelector('.route')).opacity==='0',momentsHidden=getComputedStyle(document.querySelector('.map-pins-journey')).visibility==='hidden',names=[...document.querySelectorAll('.place-name')].map(n=>n.textContent),lines=[...document.querySelectorAll('.place-line')].map(n=>n.textContent.length>0&&getComputedStyle(n).display!=='none');return JSON.stringify({places:labels.length,names,labelOverlaps:ov,labelOnDot:onDot,labelsInside:labels.every(inside),dotsInside:dots.every(inside),routeHidden,momentsHidden,oneLineEach:innerWidth>=700?lines.every(Boolean):'name only on a phone (the line is in the sheet)',ok:labels.length===8&&ov===0&&onDot===0&&labels.every(inside)&&dots.every(inside)&&routeHidden&&momentsHidden})`),
  label,
});

// the title and the Journey / Places switch share no pixel, the switch is inside the screen, and the paragraph starts below it
const topRow = (label) => ({
  eval: run(`await settle();const t=document.querySelector('.map-title'),g=document.createRange();g.selectNodeContents(t);const tr=g.getBoundingClientRect(),title={x0:tr.left,y0:tr.top,x1:tr.right,y1:tr.bottom},sw=R(document.querySelector('.map-mode')),text=R(document.querySelector('.map-text'));return JSON.stringify({title:[title.x0,title.y0,title.x1,title.y1].map(Math.round),switch:[sw.x0,sw.y0,sw.x1,sw.y1].map(Math.round),text:[text.x0,text.y0,text.x1,text.y1].map(Math.round),titleOnSwitch:hit(title,sw),switchOnText:hit(sw,text),switchInside:inside(sw),ok:!hit(title,sw)&&!hit(sw,text)&&inside(sw)})`),
  label,
});

// explore, all cards: date, title and line (the line hidden only on a collapsed card), none on another card or on a dot, the active one in full
const cardsOk = (label) => ({
  eval: run(`await settle();await sleep(400);const all=[...document.querySelectorAll('.moment')].map(m=>({m,c:m.querySelector('.moment-card'),r:R(m.querySelector('.moment-card')),d:R(m.querySelector('.moment-dot'))})),on=all.filter(x=>getComputedStyle(x.c).visibility==='visible'&&x.r.x1>0&&x.r.x0<innerWidth&&x.r.y1>0&&x.r.y0<innerHeight);let overlaps=0,onDot=0;for(let i=0;i<on.length;i++){for(let j=i+1;j<on.length;j++)if(hit(on[i].r,on[j].r))overlaps++;for(const o of all)if(o!==on[i]&&hit(on[i].r,o.d))onDot++}const words=on.every(x=>x.c.querySelector('.moment-date').textContent&&x.c.querySelector('.moment-title').textContent&&x.c.querySelector('.moment-line').textContent),lineShown=on.every(x=>x.m.hasAttribute('data-compact')?getComputedStyle(x.c.querySelector('.moment-line')).display==='none':getComputedStyle(x.c.querySelector('.moment-line')).display!=='none'),compact=on.filter(x=>x.m.hasAttribute('data-compact')).length,activeFull=on.filter(x=>x.m.hasAttribute('data-active')&&x.m.hasAttribute('data-compact')).length===0,clickable=on.every(x=>getComputedStyle(x.c).pointerEvents==='auto');return JSON.stringify({cardsOnScreen:on.length,sides:on.map(x=>x.m.dataset.cardSide+(x.m.hasAttribute('data-compact')?'c':'')),collapsed:compact,overlaps,onDot,words,lineShown,activeFull,clickable,ok:on.length>=2&&overlaps===0&&onDot===0&&words&&lineShown&&activeFull&&clickable})`),
  label,
});

// R46.1 (M3), the smallest phones: the year pills and the dots clear of the caption and the zoom buttons, the mountain mostly
// uncovered, the zoom buttons clear of the caption, the dock row's current tab not cut at the right, the caption's other lines
// kept in the document (and shown by More, which opens them over the map on request: only then is a pill under the words allowed).
const tinyClear = (label, more) => ({
  eval: run(`await settle();await sleep(2300);const q=s=>document.querySelector(s),cap=R(q('.map-caption')),ctl=R(q('.map-controls')),head=R(q('.map-heading')),pills=[...document.querySelectorAll('.moment-year')].map(R),dots=[...document.querySelectorAll('.moment-dot')].map(R),ringR=0.78*Math.min(innerWidth,innerHeight)/2,ring={x0:innerWidth/2-ringR,y0:innerHeight/2-ringR,x1:innerWidth/2+ringR,y1:innerHeight/2+ringR},area=r=>Math.max(0,r.x1-r.x0)*Math.max(0,r.y1-r.y0),cut=(a,b)=>({x0:Math.max(a.x0,b.x0),y0:Math.max(a.y0,b.y0),x1:Math.min(a.x1,b.x1),y1:Math.min(a.y1,b.y1)}),covered=(area(cut(ring,cap))+area(cut(ring,ctl))+area(cut(ring,head)))/area(ring),scroller=q('.dock-row-clip > div'),tab=q('header[data-site-nav] [data-work-tab][aria-current="page"]'),sr=scroller&&scroller.getBoundingClientRect(),tr=tab&&tab.getBoundingClientRect(),vis=s=>{const e=q(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>8&&r.height>8&&c.visibility==='visible'},texts=['.map-caption-line','.map-caption-fact','.map-caption-credit'].map(s=>({s,inDom:!!q(s)&&q(s).textContent.length>0,shown:vis(s)}));const pillOnCaption=pills.filter(p=>hit(p,cap)).length,pillOnControls=pills.filter(p=>hit(p,ctl)).length,dotOnCaption=dots.filter(p=>hit(p,cap)).length,dotOnControls=dots.filter(p=>hit(p,ctl)).length,pillOnHeading=pills.filter(p=>hit(p,head)).length;return JSON.stringify({size:[innerWidth,innerHeight],caption:[cap.x0,cap.y0,cap.x1,cap.y1].map(Math.round),controls:[ctl.x0,ctl.y0,ctl.x1,ctl.y1].map(Math.round),captionInside:inside(cap),controlsInside:inside(ctl),captionOnControls:hit(cap,ctl),captionOnHeading:hit(cap,head),pillOnCaption,pillOnControls,dotOnCaption,dotOnControls,pillOnHeading,ringShareCovered:+covered.toFixed(3),tabRight:tr&&Math.round(tr.right),scrollerRight:sr&&Math.round(sr.right),tabCut:tr&&sr?tr.right>sr.right+1||tr.left<sr.left-1:'no tab',lines:texts,ok:${more ? "!hit(cap,head)&&" : "pillOnCaption===0&&pillOnControls===0&&dotOnCaption===0&&dotOnControls===0&&covered<0.25&&"}!hit(cap,ctl)&&inside(cap)&&inside(ctl)&&!!tr&&!!sr&&tr.right<=sr.right+1&&tr.left>=sr.left-1&&texts.every(t=>t.inDom)&&texts.every(t=>t.shown===${more ? "true" : "false"})})`),
  label,
});

const r453 = [
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/experience", wait: 2500 },
  markers("R45.3 desktop overview: nine markers visible and clear of each other, pills inside, nothing at the summit, the end is the ping, the line is 2 px"),
  motion("the route draws over 1.6 s and the ping rings every 2.4 s"),
  topRow("desktop: the title and the switch share no pixel"),
  { shot: "r45-experience-warm" },
  { shot: "r45-experience-desktop-overview" },
  // text behind the heading and caption: hide the words and sample the picture (grid 8 x 6: heading columns 0 to 1 rows 0 to 2, caption rows 4 to 5)
  { eval: `document.querySelectorAll('.map-heading,.map-caption').forEach(e=>e.style.visibility='hidden');new Promise(r=>setTimeout(()=>r(1),300))`, label: "words hidden for the sample" },
  { sample: { grid: [8, 6] }, label: "picture behind the heading (cols 0 to 1, rows 0 to 2) and caption (rows 4 to 5), 1440 x 900" },
  { eval: `document.querySelectorAll('.map-heading,.map-caption').forEach(e=>e.style.visibility='');1` },
  // a click flies to a moment: it ends at the centre of the screen, in explore, with its card and the line showing; the line up to it is solid
  { click: ctr(momentBtn(4)) },
  { eval: run(`const v=await settle(),b=document.querySelector('${momentBtn(4)}'),r=R(b),card=getComputedStyle(b.querySelector('.moment-card')),line=getComputedStyle(b.querySelector('.moment-line')),s=document.querySelector('.route-line').style;return JSON.stringify({mode:${PAGE}.dataset.mode,scaleOverFit:+(v.s/v.fit).toFixed(2),centreOff:[+((r.x0+r.x1)/2-innerWidth/2).toFixed(1),+((r.y0+r.y1)/2-innerHeight/2).toFixed(1)],cardVisible:card.visibility==='visible'&&card.opacity==='1',lineShown:line.display!=='none',current:b.getAttribute('aria-current'),ok:${PAGE}.dataset.mode==='explore'&&Math.abs((r.x0+r.x1)/2-innerWidth/2)<2&&Math.abs((r.y0+r.y1)/2-innerHeight/2)<2&&card.visibility==='visible'&&line.display!=='none'&&b.getAttribute('aria-current')==='true'})`), label: "a click flies to Jan 2022 (centred, explore, card with its line)" },
  { eval: run(`const l=document.querySelector('.route-line'),w=+(parseFloat(getComputedStyle(l).strokeWidth)*P().s).toFixed(2);return JSON.stringify({lineWidthPx:w,ahead:document.querySelector('.route-ahead').getAttribute('data-shown'),heading:getComputedStyle(document.querySelector('.map-heading')).opacity,ok:Math.abs(w-2)<0.05})`), label: "the line is 2 px in explore too; the part ahead is dashed; the words are gone" },
  { shot: "r45-experience-warm2" },
  { shot: "r45-experience-desktop-explore" },
  // ] and [ step through the moments
  { key: "]", vk: 221 },
  { eval: run(`await settle();const cur=[...document.querySelectorAll('.moment-button')].findIndex(b=>b.getAttribute('aria-current')==='true');return JSON.stringify({current:cur,ok:cur===4})`), label: "] goes to the next moment (Sep 2022)" },
  { key: "[", vk: 219 },
  { key: "[", vk: 219 },
  { eval: run(`await settle();const cur=[...document.querySelectorAll('.moment-button')].findIndex(b=>b.getAttribute('aria-current')==='true');return JSON.stringify({current:cur,ok:cur===2})`), label: "[ twice goes back two moments (Jun 2021)" },
  { eval: run(`const first=document.querySelector('.map-pins-journey .moment:nth-child(1) .moment-title');return JSON.stringify({struck:first.querySelector('s')?.textContent,title:first.textContent,ok:first.querySelector('s')?.textContent==='IIT'})`), label: "IIT is struck through (an <s>) in the first card" },
  // explore at 3 times the overview's zoom around Feb and Jun 2021: every card has its words; a click on a card's words picks it; a drag that starts on one pans
  cardsOk("explore (Jun 2021 active, about 3x): every card on screen shows its date, title and line, none on another card or a dot"),
  { shot: "r45-experience-3x-warm" },
  { shot: "r45-experience-3x-feb-jun-2021" },
  { click: ctr('.map-pins-journey .moment:nth-child(2) .moment-title') },
  { eval: run(`const v=await settle(),b=document.querySelector('${momentBtn(2)}'),r=R(b),cur=[...document.querySelectorAll('.moment-button')].findIndex(x=>x.getAttribute('aria-current')==='true');window.__v0=P();return JSON.stringify({current:cur,mode:${PAGE}.dataset.mode,centreOff:[+((r.x0+r.x1)/2-innerWidth/2).toFixed(1),+((r.y0+r.y1)/2-innerHeight/2).toFixed(1)],clampedAtRightEdge:Math.abs(v.cx-(8192-innerWidth/(2*v.s)))<1,ok:cur===1&&${PAGE}.dataset.mode==='explore'&&(Math.abs((r.x0+r.x1)/2-innerWidth/2)<2||Math.abs(v.cx-(8192-innerWidth/(2*v.s)))<1)&&Math.abs((r.y0+r.y1)/2-innerHeight/2)<2})`), label: "a click on the words of the Feb 2021 card picks it and flies to it (Feb 2021 is near the picture's right edge, so the view stops at the edge, not centred)" },
  { mdrag: `(()=>{const r=document.querySelector('.map-pins-journey .moment:nth-child(3) .moment-title').getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return [x,y,x+160,y+90,12]})()` },
  { eval: run(`const v=await settle(),a=window.__v0,cur=[...document.querySelectorAll('.moment-button')].findIndex(x=>x.getAttribute('aria-current')==='true');return JSON.stringify({moved:[+(v.cx-a.cx).toFixed(1),+(v.cy-a.cy).toFixed(1)],current:cur,ok:Math.abs(v.cx-a.cx)>20&&Math.abs(v.cy-a.cy)>10&&cur===1&&Math.abs(v.s-a.s)<1e-6})`), label: "a drag that starts on the Jun 2021 card pans the map and does not pick it (still Feb 2021)" },
  { eval: `document.querySelector('.map-page').dataset.mode`, label: "still explore" },
  { key: "Escape", vk: 27 },
  // Places
  { eval: `document.querySelector('.map-mode-button:nth-child(2)').click();1` },
  placesOk("Places: 8 labels clear of each other and of every dot, inside the screen, the route and the moments hidden"),
  { eval: run(`const rupes=document.querySelectorAll('.place')[4],x=+rupes.style.getPropertyValue('--x'),y=+rupes.style.getPropertyValue('--y');return JSON.stringify({rupes:rupes.querySelector('.place-name').textContent,at:[x,y],note:'checked against the cliff trace by places.test.ts and the content test'})`), label: "Olympus Rupes position (picture px)" },
  { shot: "r45-experience-warm3" },
  { shot: "r45-experience-desktop-places" },
  // reduced motion: the line is there without a draw, the ring is still, a click is instant
  { reduce: true, go: "{{BASE}}/experience?reduced453", wait: 2500 },
  { eval: run(`await settle();const l=document.querySelector('.route-line');return JSON.stringify({routeAnimations:l.getAnimations().length,ringAnimations:document.querySelector('.now-ping-ring').getAnimations().length,ringOpacity:getComputedStyle(document.querySelector('.now-ping-ring')).opacity,routeOpacity:getComputedStyle(document.querySelector('.route')).opacity,ok:l.getAnimations().length===0&&document.querySelector('.now-ping-ring').getAnimations().length===0&&+getComputedStyle(document.querySelector('.now-ping-ring')).opacity>0&&getComputedStyle(document.querySelector('.route')).opacity==='1'})`), label: "reduced motion: no draw, a still ring" },
  { click: ctr(momentBtn(4)) },
  { eval: run(`await sleep(100);const b=document.querySelector('${momentBtn(4)}'),r=R(b);return JSON.stringify({mode:${PAGE}.dataset.mode,centreOff:[+((r.x0+r.x1)/2-innerWidth/2).toFixed(1),+((r.y0+r.y1)/2-innerHeight/2).toFixed(1)],ok:Math.abs((r.x0+r.x1)/2-innerWidth/2)<2&&Math.abs((r.y0+r.y1)/2-innerHeight/2)<2})`), label: "reduced motion: the flight to a moment is instant (read 100 ms later, in the page)" },
  { reduce: false },
  // frame gaps while the route draws and the markers appear (1.6 s) on a fresh load
  { go: "{{BASE}}/experience?draw", wait: 0 },
  { eval: `(async()=>{const g=[];let l=performance.now(),run=true;const f=n=>{g.push(n-l);l=n;if(run)requestAnimationFrame(f)};requestAnimationFrame(f);await new Promise(r=>setTimeout(r,2400));run=false;g.splice(0,2);g.sort((a,b)=>a-b);return JSON.stringify({frames:g.length,p95:+g[Math.floor(g.length*.95)].toFixed(1),max:+g[g.length-1].toFixed(1),over20:g.filter(x=>x>20).length,drawing:${PAGE}.dataset.route,ok:g.filter(x=>x>34).length===0})})()`, label: "frame gaps over 2.4 s of a fresh load (the draw) at 1440 x 900" },
  // phone
  { size: [390, 844], dpr: 3, mobile: true, touch: true, go: "{{BASE}}/experience", wait: 2500 },
  markers("R45.3 phone overview: nine markers visible and clear of each other, pills inside, nothing at the summit, the end is the ping"),
  { eval: run(`const t=document.querySelector('.map-text'),lines=Math.round(t.clientHeight/parseFloat(getComputedStyle(t).lineHeight)),more=document.querySelector('.map-more'),h=document.querySelector('.map-heading');return JSON.stringify({visibleLines:lines,clamped:t.scrollHeight>t.clientHeight,moreShown:getComputedStyle(more).display!=='none',moreText:more.textContent,fullTextInDom:t.textContent.length>250,headingBottom:Math.round(h.getBoundingClientRect().bottom),ok:lines===2&&t.scrollHeight>t.clientHeight&&t.textContent.length>250})`), label: "phone heading: two lines, a More button, the whole paragraph in the DOM" },
  { shot: "r45-experience-warm4" },
  { shot: "r45-experience-phone-overview" },
  { click: ctr('.map-more') },
  { eval: run(`const t=document.querySelector('.map-text'),h=document.querySelector('.map-heading');return JSON.stringify({open:h.hasAttribute('data-open'),clamped:t.scrollHeight>t.clientHeight+1,moreText:document.querySelector('.map-more').textContent,expanded:document.querySelector('.map-more').getAttribute('aria-expanded'),ok:h.hasAttribute('data-open')&&t.scrollHeight<=t.clientHeight+1})`), label: "More opens the paragraph in place" },
  { click: ctr('.map-more') },
  { click: ctr(momentBtn(4)) },
  { eval: run(`const v=await settle(),sheet=document.querySelector('.map-sheet'),sr=R(sheet),dock=R(document.querySelector('header[data-site-nav]')),b=R(document.querySelector('${momentBtn(4)}')),ctl=R(document.querySelector('.map-controls'));return JSON.stringify({mode:${PAGE}.dataset.mode,sheetShown:getComputedStyle(sheet).visibility==='visible',sheetBottom:Math.round(sr.y1),dockTop:Math.round(dock.y0),pointY:Math.round((b.y0+b.y1)/2),sheetTop:Math.round(sr.y0),controlsBottom:Math.round(ctl.y1),cardHidden:getComputedStyle(document.querySelector('${momentBtn(4)} .moment-card')).display==='none',ok:${PAGE}.dataset.mode==='explore'&&getComputedStyle(sheet).visibility==='visible'&&sr.y1<=dock.y0&&(b.y0+b.y1)/2<sr.y0-20&&ctl.y1<=sr.y0-4})`), label: "phone: a tap on a moment opens the sheet above the dock; the point and the buttons stay clear of it" },
  { shot: "r45-experience-warm5" },
  { shot: "r45-experience-phone-explore" },
  { eval: `document.querySelector('.map-mode-button:nth-child(2)').click();document.querySelector('[aria-label="Show the whole mountain"]').click();1` },
  placesOk("phone Places: 8 names clear of each other and of every dot, inside the screen"),
  { shot: "r45-experience-warm6" },
  { shot: "r45-experience-phone-places" },
  // 360 x 740 and 320 x 568: the title and the switch never share a pixel (the switch goes under the title), nine markers clear, places clear
  { size: [360, 740], dpr: 2, mobile: true, touch: true, go: "{{BASE}}/experience", wait: 2500 },
  topRow("360 x 740: the title and the switch share no pixel"),
  markers("R45.3 360 x 740 overview: nine markers visible and clear of each other, pills inside, nothing at the summit"),
  { eval: `document.querySelector('.map-more').click();new Promise(r=>setTimeout(()=>r(1),200))` },
  topRow("360 x 740 with the paragraph open: the title and the switch share no pixel"),
  { eval: `document.querySelector('.map-more').click();document.querySelector('.map-mode-button:nth-child(2)').click();new Promise(r=>setTimeout(()=>r(1),600))` },
  placesOk("360 x 740 Places: 8 names clear of each other and of every dot, inside the screen"),
  { shot: "r45-experience-360x740-places-warm" },
  { shot: "r45-experience-360x740-places" },
  { eval: `document.querySelector('.map-mode-button:nth-child(1)').click();new Promise(r=>setTimeout(()=>r(1),600))` },
  { shot: "r45-experience-360x740-warm" },
  { shot: "r45-experience-360x740" },
  { size: [320, 568], dpr: 2, mobile: true, touch: true, go: "{{BASE}}/experience", wait: 2500 },
  topRow("320 x 568: the title and the switch share no pixel"),
  tinyClear("R46.1 320 x 568 overview: pills and dots clear of the caption and the zoom buttons, the mountain mostly uncovered, the dock tab not cut", false),
  { eval: `document.querySelector('.map-more').click();new Promise(r=>setTimeout(()=>r(1),600))` },
  tinyClear("R46.1 320 x 568 with More open: the caption's line, figures and credit show and stay inside the screen", true),
  { shot: "r46-experience-320x568-more-warm" },
  { shot: "r46-experience-320x568-more" },
  { eval: `document.querySelector('.map-more').click();new Promise(r=>setTimeout(()=>r(1),600))` },
  { shot: "r45-experience-320x568-warm" },
  { shot: "r45-experience-320x568" },
  { size: [1024, 768], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/experience", wait: 2500 },
  markers("R45.3 1024 x 768: nine markers visible and clear, pills inside"),
  { eval: run(`const r=q=>R(document.querySelector(q)),h=r('.map-heading'),c=r('.map-caption'),ringTop=innerHeight/2-0.78*Math.min(innerWidth,innerHeight)/2,ringLeft=innerWidth/2-0.78*Math.min(innerWidth,innerHeight)/2;return JSON.stringify({headingRight:Math.round(h.x1),captionRight:Math.round(c.x1),ringLeft:Math.round(ringLeft),headingBottom:Math.round(h.y1),captionTop:Math.round(c.y0),ok:h.x1<=ringLeft&&c.x1<=ringLeft&&h.y1<c.y0&&c.y1<=innerHeight})`), label: "1024 x 768: heading and caption stay left of the cliff ring (the mountain is clear), heading above caption" },
  { shot: "r45-experience-1024x768-warm" },
  { shot: "r45-experience-1024x768" },
  { eval: `document.querySelector('.map-mode-button:nth-child(2)').click();new Promise(r=>setTimeout(()=>r(1),600))` },
  placesOk("1024 x 768 Places: 8 labels clear of each other and of every dot, inside the screen"),
  { size: [1920, 1080], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/experience", wait: 2500 },
  markers("R45.3 1920 x 1080: nine markers visible and clear"),
  { shot: "r45-experience-1920x1080-warm" },
  { shot: "r45-experience-1920x1080" },
];

// I1 (R46.1): a client-side change into /experience never shows the no-map fallback list. The change is frozen mid-reveal with the
// debug hook (`__hold`, as make-glass-frames.mjs does) and the arriving page is read: the page is the map's, engine "pending", and
// there is no `.map-fallback-list`; after the change the engine is "on" and there still is none.
const HOLD_INIT = `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-change','1')}catch(e){}
window.__hold=(to,kind,t,ox,oy)=>new Promise(res=>{__ftChange(to,kind,ox!=null?{x:ox,y:oy}:undefined);const t0=performance.now();
 const iv=setInterval(()=>{const as=document.getAnimations();if(as.some(a=>a.animationName==='glass-p')||performance.now()-t0>4000){clearInterval(iv);
  setTimeout(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t*a.effect.getTiming().duration}res(document.getAnimations().length)},40)}},16)});
window.__release=()=>new Promise(res=>{for(const a of document.getAnimations())try{a.finish()}catch(e){}
 const iv=setInterval(()=>{if(!document.documentElement.dataset.changeKind){clearInterval(iv);setTimeout(()=>res(location.pathname),700)}},30);
 setTimeout(()=>{clearInterval(iv);res('timeout '+location.pathname)},6000)});`;
const arriving = (label) => ({
  eval: `(()=>{const p=document.querySelector('.map-page');return JSON.stringify({path:location.pathname,mapPage:!!p,engine:p&&p.dataset.engine,fallbackLists:document.querySelectorAll('.map-fallback-list').length,srList:document.querySelectorAll('.sr-only li').length,ok:!!p&&p.dataset.engine==='pending'&&document.querySelectorAll('.map-fallback-list').length===0})})()`,
  label,
});
const settledAfter = (label) => ({
  eval: `new Promise(r=>setTimeout(()=>{const p=document.querySelector('.map-page');r(JSON.stringify({engine:p&&p.dataset.engine,fallbackLists:document.querySelectorAll('.map-fallback-list').length,ok:!!p&&p.dataset.engine==='on'&&document.querySelectorAll('.map-fallback-list').length===0}))},800))`,
  label,
});
const heldIntoMap = (size, dpr, mobile, origin, tag) => [
  { size, dpr, mobile, touch: mobile, init: HOLD_INIT, go: "{{BASE}}/work", wait: 3000 },
  ...[0.1, 0.3, 0.6].flatMap((t) => [
    { eval: `__hold('/experience','radial',${t},${origin[0]},${origin[1]})`, label: `hold the change into /experience at t=${t} (${tag})` },
    arriving(`${tag}, t=${t}: the arriving map page shows no fallback list (engine pending)`),
    { wait: 120, shot: `r46-held-${tag}-${t}-warm` },
    { wait: 60, shot: `r46-held-${tag}-${t}` },
    { eval: "__release()", label: "release" },
    settledAfter(`${tag}, t=${t}: after the change the engine is on and there is still no fallback list`),
    { eval: "__ftChange('/work','fade').then(()=>__release())", label: "back to /work" },
  ]),
];

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
  // the heading and the caption sit on calm ground (spec 9.1): in the column layout both end 16 px or more short of the
  // cliff ring's left edge; stacked (phones, tablets, 4:3) both lie inside the screen with the ring clear of nothing to check,
  // and the heading is above the caption. Also the brightness behind them is read from a screenshot by hand (see the report).
  ...[[1280, 800], [1024, 768], [1366, 768], [1920, 1080], [2560, 1440]].flatMap(([w, h]) => [
    { size: [w, h], dpr: 1, mobile: false, touch: false, go: "{{BASE}}/experience", wait: 2500 },
    { eval: out(`const v=await settle(),ringLeft=v.vw/2-0.78*Math.min(v.vw,v.vh)/2,r=q=>document.querySelector(q).getBoundingClientRect(),hd=r('.map-heading'),cp=r('.map-caption'),col=getComputedStyle(${PAGE}).getPropertyValue('--map-text-w').trim()!=='';return JSON.stringify({layout:col?'column':'stacked',ringLeft:Math.round(ringLeft),headingRight:Math.round(hd.right),captionRight:Math.round(cp.right),ok:col?(hd.right<=ringLeft-16&&cp.right<=ringLeft-16&&hd.left>=0):(hd.right<=v.vw&&cp.right<=v.vw&&hd.bottom<cp.top)})`), label: `text on calm ground at ${w} x ${h}` },
    { shot: `r45-map-${w}x${h}-warm` },
    { shot: `r45-map-${w}x${h}` },
  ]),
  ...r453,
  ...heldIntoMap([1440, 900], 1, false, [676, 846], "desktop"),
  ...heldIntoMap([390, 844], 2, true, [200, 800], "phone"),
  // M1 (R46.1): no square box round the dock during a change: held at t=0.25 from home into /experience (over the bright map)
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, init: HOLD_INIT, go: "{{BASE}}/", wait: 3500 },
  { eval: `__hold('/experience','radial',0.25,676,846)`, label: "hold the change home to /experience at t=0.25" },
  { eval: `JSON.stringify({clip:getComputedStyle(document.documentElement,'::view-transition-group(site-dock)').clipPath,ok:/round/.test(getComputedStyle(document.documentElement,'::view-transition-group(site-dock)').clipPath)})`, label: "the dock's view-transition group is clipped to a pill" },
  { wait: 120, shot: "r46-held-dock-home-exp-0.25-warm" },
  { wait: 60, shot: "r46-held-dock-home-exp-0.25" },
  { eval: "__release()", label: "release" },
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
