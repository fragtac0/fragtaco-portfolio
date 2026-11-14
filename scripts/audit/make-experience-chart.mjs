// The steps of Task 19 (R53.4) for experience.json, made by make-experience.mjs: the chart layer and the frame, the words, the
// phones, the keyboard and the screen-reader list after the clean-out, the focus ring and the label of a bead (Task 18's
// carry-overs), and the weight of a first load. Each eval prints a JSON line with `ok`.
//   words: the title, its description, the mountain's label and its line have the sizes, strengths and capitals of spec 9.6, and
//     the title block and the caption leave in My climb;
//   phones (390 x 844, 360 x 640, 320 x 568, 844 x 390, and 820 x 1180): the title block, the caption and the switch are inside the
//     screen and clear of the dock, the title is on one line on a phone, the switch is under it below 500 px, no bead is under the
//     words, every bead has a 44 px target, and in My climb the card is inside the screen and above the dock;
//   the chart: the frame's canvas has its four corner marks, the two edge squares and the readout in both states, and no ink under
//     the dock or under the words (the labels thin out), the overview's lettering (north) is there in the overview on a wide
//     screen and gone in My climb, the grid is on the trail's canvas in both, and the readout changes with the chosen milestone;
//   keyboard and screen reader (spec 9.7): Tab reaches both buttons of the switch and all nine beads, the list for a screen
//     reader is in the page with nine moments, and the page has its label;
//   carry-overs: the focus ring of a bead is about 2 px on the screen in the overview as in My climb, and a label shown while the camera
//     changes its side does not slide (it takes its place in one frame);
//   weight: what a first load of /experience transfers (same-origin bytes, 7 s, cache off) at 1440 x 900 and 390 x 844.
const sleep = `const sleep=ms=>new Promise(r=>setTimeout(r,ms));`;
const ready = `for(let i=0;i<40&&document.querySelector('.map-stage').dataset.terrain!=='ready';i++)await sleep(100);await sleep(500);`;
const R = `const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};const hit=(a,b,g=0)=>a.l<b.r+g&&b.l<a.r+g&&a.t<b.b+g&&b.t<a.b+g;`;
// ink on a canvas (alpha over 8) in a box of CSS pixels, with the zones in `skip` (boxes) left out
const INK = `const ink=(cv,l,t,r,b,skip=[])=>{const k=cv.width/cv.clientWidth,x0=Math.max(0,Math.floor(l*k)),y0=Math.max(0,Math.floor(t*k)),x1=Math.min(cv.width,Math.ceil(r*k)),y1=Math.min(cv.height,Math.ceil(b*k));if(x1<=x0||y1<=y0)return 0;
const d=cv.getContext('2d').getImageData(x0,y0,x1-x0,y1-y0).data;let n=0;for(let y=0;y<y1-y0;y++)for(let x=0;x<x1-x0;x++){if(d[(y*(x1-x0)+x)*4+3]<=8)continue;const cx=(x0+x)/k,cy=(y0+y)/k;if(skip.some(s=>cx>=s[0]&&cx<=s[2]&&cy>=s[1]&&cy<=s[3]))continue;n++}return n};`;
const Q = `const q=s=>document.querySelector(s);const qa=s=>[...document.querySelectorAll(s)];`;
const press = (name) => `[...document.querySelectorAll('.map-mode-button')].find(x=>x.textContent==='${name}').click()`;

// ---- the words ----
const words = (w, h, dpr, mobile) => [
  { size: [w, h], dpr, mobile, touch: mobile, reduce: false, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3500 },
  {
    eval: `(async()=>{${sleep}${ready}${Q}const cs=e=>getComputedStyle(q(e));const num=s=>parseFloat(s);const a=s=>{const m=/rgba?\\(([^)]*)\\)/.exec(s)[1].split(/[ ,\\/]+/).map(Number);return {rgb:m.slice(0,3),a:m.length>3?m[3]:1}};
const t=cs('.map-title'),d=cs('.map-text'),l=cs('.map-caption-title'),n=cs('.map-caption-line');
const vw=innerWidth,want=Math.min(64,Math.max(34,vw*0.046));const tc=a(t.color),dc=a(d.color),nc=a(n.color),lc=a(l.color);
const info={title:{size:num(t.fontSize),want:+want.toFixed(2),transform:t.textTransform,alpha:tc.a,rgb:tc.rgb,tracking:t.letterSpacing},desc:{size:num(d.fontSize),alpha:+dc.a.toFixed(2)},label:{size:num(l.fontSize),rgb:lc.rgb,transform:l.textTransform,tracking:l.letterSpacing},line:{size:num(n.fontSize),alpha:+nc.a.toFixed(2)},
switch:qa('.map-mode-button').map(b=>b.textContent),h1:q('h1').textContent};
const ok=Math.abs(info.title.size-want)<0.1&&t.textTransform==='uppercase'&&tc.a===1&&tc.rgb.join()==='253,252,230'&&info.desc.size===12.5&&Math.abs(dc.a-0.7)<0.01&&info.label.size===13&&lc.rgb.join()==='255,201,163'&&l.textTransform==='uppercase'&&info.line.size===11&&Math.abs(nc.a-0.56)<0.01
&&tc.a>dc.a&&dc.a>nc.a&&info.switch.join('|')==='Overview|My climb'&&info.h1==='My experience';
return JSON.stringify({...info,ok})})()`,
    label: `the words at ${w} x ${h}: title 4.6vw between 34 and 64 px, in capitals and the cream, description 12.5 px at 70%, label 13 px in warm light orange, line 11 px at 56%; the switch reads Overview, My climb`,
  },
];
const wordsLeave = {
  eval: `(async()=>{${sleep}${Q}${press("My climb")};await sleep(1500);const o=['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity);${press("Overview")};await sleep(1800);const b=['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity);return JSON.stringify({inClimb:o,backInOverview:b,ok:o.every(x=>x<0.05)&&b.every(x=>x===1)})})()`,
  label: "the title block and the mountain's label leave in My climb and come back in the overview",
};

// ---- the phones ----
const layout = (tag, sizeName) => ({
  eval: `(async()=>{${sleep}${ready}${R}${INK}${Q}const W=innerWidth,H=innerHeight,dockEl=q('[data-dock-glass]'),dock=R(dockEl);
const heading=R(q('.map-heading')),cap=R(q('.map-caption')),sw=R(q('.map-mode')),title=q('.map-title'),tr=R(title);
const lines=e=>{const g=document.createRange();g.selectNodeContents(e);return [...g.getClientRects()].map(r=>({l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height})).filter(r=>r.w>2&&r.h>2)};
const texts=qa('.map-title,.map-text,.map-caption-title,.map-caption-line,.map-caption-fact,.map-caption-credit').filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2}).flatMap(lines);
const inside=r=>r.l>=0&&r.t>=0&&r.r<=W&&r.b<=H;
const beads=qa('.map-pin .map-bead').map(b=>{const r=R(b);return {x:r.l+r.w/2,y:r.t+r.h/2,rad:r.w/2}});
const under=beads.filter(b=>texts.some(t=>hit({l:b.x-b.rad,t:b.y-b.rad,r:b.x+b.rad,b:b.y+b.rad},t))).length;
const sizes=qa('.map-pin').map(p=>{const r=R(p);return [Math.round(r.w),Math.round(r.h)]});
const fs=parseFloat(getComputedStyle(title).fontSize);const phone=W<700;
const fr=q('.map-frame'),spans=dock.r-dock.l>=0.55*W,foot=spans?dock.t-6:H;
const corners=[[8,8,24,24],[W-24,8,W-8,24],[8,foot-24,24,foot-8],[W-24,foot-24,W-8,foot-8]].map(b=>ink(fr,...b));
const squares=[ink(fr,6,foot/2-3,14,foot/2+3),ink(fr,W-14,foot/2-3,W-6,foot/2+3)];
const zones=[[0,0,26,26],[W-26,0,W,26],[0,foot-26,26,foot],[W-26,foot-26,W,foot]];
const underDock=ink(fr,dock.l+2,dock.t+2,dock.r-2,dock.b-2);
const underWords=texts.map(t=>ink(fr,t.l,t.t,t.r,t.b,zones));
const readoutInk=ink(fr,W-24-130,foot-30,W-20,foot-14);
const trailInk=ink(q('.map-trail'),0,H*0.3,Math.min(120,W*0.25),H*0.6);
const o={size:[W,H],dock:[dock.l,dock.t,dock.r,dock.b].map(Math.round),heading:inside(heading),caption:inside(cap),switch:inside(sw),
clearOfDock:[heading,cap,sw].every(r=>!hit(r,dock)),titleLines:Math.round(tr.h/fs*10)/10,titleSize:fs,switchUnderTitle:W<500?sw.t>=tr.b-1:null,switchClearOfTitle:!hit(sw,tr),
beadsUnderWords:under,hitAreas:sizes.every(s=>s[0]>=44&&s[1]>=44),corners,squares,readoutInk,underDock,underWords:underWords.map(n=>n),gridInk:trailInk,foot:Math.round(foot),captionLines:qa('.map-caption-fact').length&&R(q('.map-caption-fact')).w>2?'full':'short'};
o.ok=o.heading&&o.caption&&o.switch&&o.clearOfDock&&(!phone||o.titleLines<=1.3)&&o.switchClearOfTitle&&(W>=500||o.switchUnderTitle)&&under===0&&o.hitAreas&&corners.every(n=>n>0)&&squares.every(n=>n>0)&&readoutInk>0&&underDock===0&&underWords.every(n=>n===0)&&trailInk>0;
return JSON.stringify(o)})()`,
  label: `${sizeName}, overview: the words inside the screen and clear of the dock, one line of title on a phone, no bead under a line of the words, 44 px targets, the frame's marks present and clear of the dock and the words (${tag})`,
});
const climbLayout = (sizeName) => ({
  eval: `(async()=>{${sleep}${R}${INK}${Q}${press("My climb")};await sleep(5200);const W=innerWidth,H=innerHeight,dock=R(q('[data-dock-glass]')),fr=q('.map-frame'),spans=dock.r-dock.l>=0.55*W,foot=spans?dock.t-6:H;
const card=R(q('.map-card')),op=+getComputedStyle(q('.map-card')).opacity,sw=R(q('.map-mode'));
const north=ink(fr,W/2-8,4,W/2+8,30),corners=[[8,8,24,24],[W-24,8,W-8,24],[8,foot-24,24,foot-8],[W-24,foot-24,W-8,foot-8]].map(b=>ink(fr,...b)),readoutInk=ink(fr,W-24-130,foot-30,W-20,foot-14);
const labelsInk=ink(fr,W-60,84,W-10,foot-80)+ink(fr,W*0.5,foot-22,W-250,foot-8);
const sizes=qa('.map-pin').map(p=>{const r=R(p);return [Math.round(r.w),Math.round(r.h)]});const trailInk=ink(q('.map-trail'),0,H*0.3,Math.min(120,W*0.25),H*0.6);
const o={size:[W,H],cardOpacity:op,card:[card.l,card.t,card.r,card.b].map(Math.round),cardInside:card.l>=0&&card.t>=0&&card.r<=W&&card.b<=H,cardAboveDock:card.b<=dock.t,cardClearOfSwitch:!hit(card,sw),north,corners,readoutInk,labelsInk,hitAreas:sizes.every(s=>s[0]>=44&&s[1]>=44),gridInk:trailInk,
planeOpacity:+getComputedStyle(q('.map-plane')).opacity};
o.ok=op===1&&o.cardInside&&o.cardAboveDock&&north===0&&corners.every(n=>n>0)&&readoutInk>0&&o.hitAreas&&trailInk>0&&o.planeOpacity===0;
return JSON.stringify(o)})()`,
  label: `${sizeName}, My climb: the card inside the screen and above the dock, no north or degree labels, the corner marks and the readout stay, the grid is on the trail's canvas, 44 px targets`,
});
const phoneRun = (w, h, dpr, mobile, name) => [
  { size: [w, h], dpr, mobile, touch: mobile, reduce: false, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3500 },
  layout(`${w} x ${h}`, name),
  { shot: `r53-4-${name}-overview-warm` },
  { shot: `r53-4-overview-${w}x${h}` },
  climbLayout(name),
  { shot: `r53-4-${name}-climb-warm` },
  { shot: `r53-4-climb-${w}x${h}` },
];

// ---- desktop: the chart in both states ----
const chart = [
  { size: [1440, 900], dpr: 2, reduce: false, go: "{{BASE}}/experience", wait: 3500 },
  {
    eval: `(async()=>{${sleep}${ready}${R}${INK}${Q}const W=innerWidth,H=innerHeight,fr=q('.map-frame');const north=ink(fr,W/2-8,4,W/2+8,30);
const read=()=>ink(fr,W-24-130,H-30,W-20,H-14);const lat=ink(fr,W-60,150,W-10,H-130);const foot=ink(fr,W*0.5,H-24,W-250,H-8);const scale=ink(fr,W-170,H-62,W-20,H-30);
const o={north,readout:read(),degreesRight:lat,degreesFoot:foot,scaleBar:scale,
gridInk:ink(q('.map-trail'),0,H*0.3,120,H*0.6)};o.ok=north>0&&o.readout>0&&lat>0&&foot>0&&scale>0&&o.gridInk>0;return JSON.stringify(o)})()`,
    label: "the overview at 1440 x 900: north, the degrees on the right and on the foot, the 200 km scale bar, the readout, and the grid are all drawn",
  },
  {
    eval: `(async()=>{${sleep}${R}${INK}${Q}const fr=q('.map-frame'),W=innerWidth,H=innerHeight,box=[W-24-130,H-30,W-20,H-14];const hash=()=>{const k=fr.width/fr.clientWidth,d=fr.getContext('2d').getImageData(Math.floor(box[0]*k),Math.floor(box[1]*k),Math.ceil((box[2]-box[0])*k),Math.ceil((box[3]-box[1])*k)).data;let h=0;for(let i=0;i<d.length;i+=4)h=(h*31+d[i+3])|0;return h};
const h0=hash();${press("My climb")};await sleep(5200);const h1=hash();const pins=qa('.map-pin');pins[1].click();await sleep(3000);const h2=hash();pins[7].click();await sleep(3000);const h3=hash();
const north=ink(fr,W/2-8,4,W/2+8,30);const o={summitReadout:h0,hikerReadout:h1,secondReadout:h2,eighthReadout:h3,north,ok:h0!==h1&&h1!==h2&&h2!==h3&&north===0};return JSON.stringify(o)})()`,
    label: "the readout tells the summit in the overview and a different place for each milestone chosen in My climb; north is gone",
  },
  { shot: "r53-4-chart-climb-warm" },
  { shot: "r53-4-chart-climb-1440x900" },
];

// ---- keyboard and screen reader (spec 9.7) ----
const reach = [
  { size: [1440, 900], dpr: 1, reduce: false, go: "{{BASE}}/experience", wait: 3500 },
  { eval: `(async()=>{${sleep}${ready}document.activeElement&&document.activeElement.blur();return 'ready'})()`, label: "ready for the Tab walk" },
  ...Array.from({ length: 16 }, () => ({ key: "Tab", vk: 9, eval: `(()=>{const e=document.activeElement;window.__tabs=(window.__tabs||[]);window.__tabs.push(e.classList.contains('map-pin')?'bead:'+e.textContent.slice(0,12):e.classList.contains('map-mode-button')?'switch:'+e.textContent:e.tagName+':'+(e.getAttribute('aria-label')||e.textContent||'').slice(0,12));return 'tab'})()`, label: "tab" })),
  {
    eval: `(()=>{const t=window.__tabs;const beads=t.filter(x=>x.startsWith('bead:')).length;const sw=t.filter(x=>x.startsWith('switch:'));const sr=document.querySelectorAll('.sr-only li').length,lab=document.querySelector('main').getAttribute('aria-label'),h=document.querySelectorAll('h1').length;
return JSON.stringify({tabs:t,beads,switch:sw,srList:sr,mainLabel:lab,h1s:h,ok:beads===9&&sw.length===2&&sr===9&&!!lab&&h===1})})()`,
    label: "Tab reaches the nine beads and both buttons of the switch; the list for a screen reader has the nine moments; the page has its label and one h1 (spec 9.7)",
  },
];

// ---- the carry-overs: the focus ring in the overview, the label that does not slide ----
// A real Tab key makes the focus a keyboard one (`:focus-visible`), as the ring and the label of a focused bead need; the arrow keys then
// move the focus with the selection (R103).
const bead = `const e=document.activeElement,b=e.querySelector('.map-bead'),cs=getComputedStyle(b),m=new DOMMatrix(cs.transform).a,w=parseFloat(cs.outlineWidth),off=parseFloat(cs.outlineOffset);`;
const carryOvers = [
  { size: [1440, 900], dpr: 2, reduce: false, go: "{{BASE}}/experience", wait: 3500 },
  { eval: `(async()=>{${sleep}${ready}document.activeElement&&document.activeElement.blur();return 'ready'})()`, label: "ready for the keys" },
  { key: "Tab", vk: 9 }, { key: "Tab", vk: 9 }, { key: "Tab", vk: 9 },
  {
    eval: `(async()=>{${sleep}${Q}await sleep(700);const idx=qa('.map-pin').indexOf(document.activeElement);${bead}
const o={bead:idx+1,focusVisible:e.matches(':focus-visible'),scale:+m.toFixed(3),outlineWidth:+w.toFixed(2),outlineOffset:+off.toFixed(2),onScreenWidth:+(w*m).toFixed(2),onScreenOffset:+(off*m).toFixed(2),style:cs.outlineStyle};
o.ok=idx===2&&o.focusVisible&&o.style==='solid'&&Math.abs(o.onScreenWidth-2)<0.75&&Math.abs(o.onScreenOffset-3)<0.6;return JSON.stringify(o)})()`,
    label: "the focus ring of the third bead in the overview is about 2 px wide (1.3 to 2.8) and 3 px out on the screen (the bead is half size: the ring is divided by its scale and rounded to a whole pixel)",
  },
  { shot: "r53-4-bead-focus-overview-warm" },
  { shot: "r53-4-bead-focus-overview" },
  { eval: `(async()=>{${sleep}${Q}${press("My climb")};await sleep(5200);return 'in'})()`, label: "into My climb" },
  { key: "ArrowLeft", vk: 37 },
  {
    eval: `(async()=>{${sleep}${Q}await sleep(900);const idx=qa('.map-pin').indexOf(document.activeElement);${bead}
const o={bead:idx+1,focusVisible:e.matches(':focus-visible'),scale:+m.toFixed(3),outlineWidth:+w.toFixed(2),onScreenWidth:+(w*m).toFixed(2),ok:idx===7&&e.matches(':focus-visible')&&Math.abs(w*m-2)<0.75};return JSON.stringify(o)})()`,
    label: "the same ring in My climb (the eighth bead, reached with the arrow key) is about 2 px on the screen too",
  },
  {
    eval: `(async()=>{${sleep}${Q}${R}const p=document.activeElement,tip=p.querySelector('.map-pin-tip');await sleep(400);const x0=R(tip).l,op0=+getComputedStyle(tip).opacity;const seen=[];let run=true;const f=()=>{seen.push(Math.round(R(tip).l*10)/10);if(run)requestAnimationFrame(f)};requestAnimationFrame(f);await sleep(80);
p.style.setProperty('--flip',p.style.getPropertyValue('--flip')==='1'?'0':'1');await sleep(500);run=false;const distinct=[...new Set(seen)];const settled=seen[seen.length-1];
return JSON.stringify({before:x0,after:settled,distinctPlaces:distinct,opacityBefore:op0,opacityAfter:+getComputedStyle(tip).opacity,ok:distinct.length===2&&Math.abs(settled-x0)>20&&op0===1&&+getComputedStyle(tip).opacity===1})})()`,
    label: "a label that is shown while its side changes takes its place at once (two places in all, no frame in between), and stays shown",
  },
];

// ---- the weight of a first load ----
const weightEval = (label) => ({
  eval: `(()=>{const n=performance.getEntriesByType('navigation')[0];const res=performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin));const kb=x=>+(x/1024).toFixed(1);const sum=a=>kb(a.reduce((s,r)=>s+(r.transferSize||0),0));const t=u=>res.filter(r=>u.test(r.name));
return JSON.stringify({document:kb(n.transferSize),js:sum(t(/\\.js(\\?|$)/)),css:sum(t(/\\.css(\\?|$)/)),images:sum(t(/\\.(webp|png|jpg)(\\?|$)/)),imageList:t(/\\.(webp|png|jpg)(\\?|$)/).map(r=>[r.name.replace(location.origin,''),kb(r.transferSize)]),totalSameOrigin:kb(n.transferSize+res.reduce((s,r)=>s+(r.transferSize||0),0)),requests:res.length+1,ok:true})})()`,
  label,
});
const weight = [
  { size: [1440, 900], dpr: 1, reduce: false, nocache: true, go: "{{BASE}}/experience", wait: 7000 },
  weightEval("first load of /experience at 1440 x 900 (7 s, cache off): same-origin bytes on the wire"),
  { size: [390, 844], dpr: 2, mobile: true, touch: true, nocache: true, go: "{{BASE}}/experience", wait: 7000 },
  weightEval("first load of /experience at 390 x 844 (7 s, cache off): same-origin bytes on the wire"),
  { nocache: false },
];

// ---- reduced motion: the chart ----
const reducedChart = [
  { size: [1440, 900], dpr: 1, reduce: true, go: "{{BASE}}/experience", wait: 3500 },
  {
    eval: `(async()=>{${sleep}${ready}${R}${INK}${Q}const fr=q('.map-frame'),W=innerWidth,H=innerHeight;const north=ink(fr,W/2-8,4,W/2+8,30);${press("My climb")};await sleep(1600);const northIn=ink(fr,W/2-8,4,W/2+8,30);const corners=ink(fr,8,8,24,24);const readoutInk=ink(fr,W-24-130,H-30,W-20,H-14);
return JSON.stringify({northInOverview:north,northInClimb:northIn,corners,readoutInk,ok:north>0&&northIn===0&&corners>0&&readoutInk>0})})()`,
    label: "reduced motion: the frame's marks and readout stay, the overview's north is gone in My climb (the lettering fades with the picture, no travel)",
  },
  { shot: "r53-4-chart-climb-reduced-warm" },
  { shot: "r53-4-chart-climb-reduced" },
  { reduce: false },
];

export const chartSteps = [
  ...words(1440, 900, 1, false),
  wordsLeave,
  ...words(820, 1180, 1, false),
  ...words(390, 844, 2, true),
  ...words(320, 568, 2, true),
  ...chart,
  ...phoneRun(1440, 900, 1, false, "desktop"),
  ...phoneRun(820, 1180, 1, false, "tablet"),
  ...phoneRun(390, 844, 2, true, "phone"),
  ...phoneRun(360, 640, 2, true, "small"),
  ...phoneRun(320, 568, 2, true, "tiny"),
  ...phoneRun(844, 390, 2, true, "landscape"),
  ...reach,
  ...carryOvers,
  ...reducedChart,
  ...weight,
];

/** Parts of the list, to run one at a time while working on them. */
export const chartParts = {
  tiny: phoneRun(320, 568, 2, true, "tiny"),
  keys: [...reach, ...carryOvers],
  reduced: reducedChart,
  weight,
};
