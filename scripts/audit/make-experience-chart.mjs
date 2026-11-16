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
//   weight: what a first load of /experience transfers (same-origin bytes, 7 s, cache off) at 1440 x 900 and 390 x 844; the picture for the screen (the smaller one
//     on a phone, R105) is the one shown and preloaded, the heights are not preloaded and start after the picture arrived.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The inks of the words are read from the tokens, so the contrast step measures what the page uses (rgb of the cream, and the strengths).
const tokens = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../app/styles/tokens.css"), "utf8");
const strength = (name) => Number(new RegExp(`${name}:\\s*rgb\\(var\\(--ink-rgb\\) / ([\\d.]+)\\)`).exec(tokens)?.[1] ?? 1);
const CREAM = [253, 252, 230];
const sleep = `const sleep=ms=>new Promise(r=>setTimeout(r,ms));`;
const ready = `for(let i=0;i<40&&document.querySelector('.map-stage').dataset.terrain!=='ready';i++)await sleep(100);await sleep(500);`;
const R = `const R=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};const hit=(a,b,g=0)=>a.l<b.r+g&&b.l<a.r+g&&a.t<b.b+g&&b.t<a.b+g;`;
// ink on a canvas (alpha over 8) in a box of CSS pixels, with the zones in `skip` (boxes) left out
const INK = `const ink=(cv,l,t,r,b,skip=[])=>{const k=cv.width/cv.clientWidth,x0=Math.max(0,Math.floor(l*k)),y0=Math.max(0,Math.floor(t*k)),x1=Math.min(cv.width,Math.ceil(r*k)),y1=Math.min(cv.height,Math.ceil(b*k));if(x1<=x0||y1<=y0)return 0;
const d=cv.getContext('2d').getImageData(x0,y0,x1-x0,y1-y0).data;let n=0;for(let y=0;y<y1-y0;y++)for(let x=0;x<x1-x0;x++){if(d[(y*(x1-x0)+x)*4+3]<=8)continue;const cx=(x0+x)/k,cy=(y0+y)/k;if(skip.some(s=>cx>=s[0]&&cx<=s[2]&&cy>=s[1]&&cy<=s[3]))continue;n++}return n};`;
const Q = `const q=s=>document.querySelector(s);const qa=s=>[...document.querySelectorAll(s)];`;
const press = (name) => `[...document.querySelectorAll('.map-mode-button')].find(x=>x.textContent==='${name}').click()`;

// ---- the words ----
// The WCAG contrast of each of the words over the picture behind it (the cdp `contrast` step hides the text and photographs the page; the inks come from the tokens):
// 4.5 to 1 is the aim for text this small. `glass` keeps the text's shadow in the picture (the colour only goes transparent), so the reading is what the page shows;
// the mean over each text's box is the reading that counts (a few sunlit specks of the picture sit under the description whatever the ink: the worst and the 1st percentile are printed too).
const contrastStep = (tag) => ({
  contrast: [
    { name: "title", selector: ".map-title", ink: [...CREAM, 1], glass: true },
    { name: "description (--map-ink-desc)", selector: ".map-text", ink: [...CREAM, strength("--map-ink-desc")], glass: true },
    { name: "label", selector: ".map-caption-title", ink: [255, 201, 163, 1], glass: true },
    { name: "line (--map-ink-line)", selector: ".map-caption-line", ink: [...CREAM, strength("--map-ink-line")], glass: true },
    { name: "fact (--map-ink-line)", selector: ".map-caption-fact", ink: [...CREAM, strength("--map-ink-line")], glass: true },
    { name: "credit (--map-ink-line)", selector: ".map-caption-credit", ink: [...CREAM, strength("--map-ink-line")], glass: true },
  ],
  label: `contrast of the description, the line, the fact and the credit over the picture at ${tag} (worst, p1 and mean; mean 4.5 to 1 wanted)`,
});
const words = (w, h, dpr, mobile, contrast = false) => [
  { size: [w, h], dpr, mobile, touch: mobile, reduce: false, init: "window.__expTrace=[]", go: "{{BASE}}/experience", wait: 3500 },
  {
    eval: `(async()=>{${sleep}${ready}${Q}const cs=e=>getComputedStyle(q(e));const num=s=>parseFloat(s);const a=s=>{const m=/rgba?\\(([^)]*)\\)/.exec(s)[1].split(/[ ,\\/]+/).map(Number);return {rgb:m.slice(0,3),a:m.length>3?m[3]:1}};
const t=cs('.map-title'),d=cs('.map-text'),l=cs('.map-caption-title'),n=cs('.map-caption-line');
const vw=innerWidth,want=Math.min(64,Math.max(34,vw*0.046));const tc=a(t.color),dc=a(d.color),nc=a(n.color),lc=a(l.color);
const info={title:{size:num(t.fontSize),want:+want.toFixed(2),transform:t.textTransform,alpha:tc.a,rgb:tc.rgb,tracking:t.letterSpacing},desc:{size:num(d.fontSize),alpha:+dc.a.toFixed(2)},label:{size:num(l.fontSize),rgb:lc.rgb,transform:l.textTransform,tracking:l.letterSpacing},line:{size:num(n.fontSize),alpha:+nc.a.toFixed(2)},
switch:qa('.map-mode-button').map(b=>b.textContent),h1:[...q('h1').querySelectorAll('.sr-only')].map(n=>n.textContent).join(''),h1Letters:q('h1').querySelector('[aria-hidden="true"]')?.getAttribute('aria-hidden')};
const ok=Math.abs(info.title.size-want)<0.1&&t.textTransform==='uppercase'&&tc.a===1&&tc.rgb.join()==='253,252,230'&&info.desc.size===12.5&&Math.abs(dc.a-0.7)<0.01&&info.label.size===13&&lc.rgb.join()==='255,201,163'&&l.textTransform==='uppercase'&&info.line.size===11&&Math.abs(nc.a-0.62)<0.01
&&tc.a>dc.a&&dc.a>nc.a&&info.switch.join('|')==='Overview|My climb'&&info.h1==='My experience'&&info.h1Letters==='true';
return JSON.stringify({...info,ok})})()`,
    label: `the words at ${w} x ${h}: title 4.6vw between 34 and 64 px, in capitals and the cream, description 12.5 px at 70%, label 13 px in warm light orange, line 11 px at 62%; the switch reads Overview, My climb`,
  },
  ...(contrast ? [contrastStep(`${w} x ${h}`)] : []),
];
// A page title too long for the line (the schema caps it, but the page must hold even so): it is cut at the page's edge and never wraps, so it does not run
// off the screen or into the switch.
const titleGuard = {
  eval: `(async()=>{${sleep}${R}${Q}const t=q('.map-title'),sw=R(q('.map-mode')),was=t.innerHTML;t.textContent='MY EXPERIENCE AND ALL THE REST OF IT';await sleep(150);
const r=R(t),fs=parseFloat(getComputedStyle(t).fontSize),o={rect:[r.l,r.t,r.r,r.b].map(Math.round),lines:+(r.h/fs).toFixed(2),cut:t.scrollWidth>t.clientWidth,overflowX:getComputedStyle(t).overflowX,switchClear:!hit(r,sw)};
t.innerHTML=was;o.ok=r.r<=innerWidth-16+1&&o.lines<=1.3&&o.cut&&o.switchClear;return JSON.stringify(o)})()`,
  label: "320 x 568: a very long page title stays on one line, inside the page's edge and clear of the switch (cut at the edge)",
};
const wordsLeave = {
  eval: `(async()=>{${sleep}${Q}${press("My climb")};await sleep(1500);const o=['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity);${press("Overview")};await sleep(1800);const b=['.map-heading','.map-caption'].map(s=>+getComputedStyle(q(s)).opacity);return JSON.stringify({inClimb:o,backInOverview:b,ok:o.every(x=>x<0.05)&&b.every(x=>x===1)})})()`,
  label: "the title block and the mountain's label leave in My climb and come back in the overview",
};

// ---- the phones ----
// Each bead's touch target (the button, 44 px): the share of it that is on the screen and outside the dock, and the share of it where a touch lands on the bead
// itself (a neighbour's target may lie over part of it: the beads are closer than 44 px on a small stage, and the one lower on the screen is on top). All nine must be
// whole on the screen outside the dock and own part of their target, and the visible centre of every bead must land on that bead (R108: the page cuts the overlapping
// targets by the nearest centre); the pairs whose targets overlap are counted and reported.
const REACH = `const area=a=>Math.max(0,a.r-a.l)*Math.max(0,a.b-a.t);const pinsEls=qa('.map-pin'),tg=pinsEls.map(R);
const own=pinsEls.map((p,i)=>{const r=tg[i],vis={l:Math.max(0,r.l),t:Math.max(0,r.t),r:Math.min(W,r.r),b:Math.min(H,r.b)},x={l:Math.max(vis.l,dock.l),t:Math.max(vis.t,dock.t),r:Math.min(vis.r,dock.r),b:Math.min(vis.b,dock.b)};
let hits=0,n=0;for(let a=0;a<11;a++)for(let b=0;b<11;b++){const px=r.l+(a+.5)*r.w/11,py=r.t+(b+.5)*r.h/11;n++;if(px<0||py<0||px>=W||py>=H)continue;const e=document.elementFromPoint(px,py);if(e&&p.contains(e))hits++}
const c=document.elementFromPoint(r.l+r.w/2,r.t+r.h/2);return {outside:(area(vis)-area(x))/(r.w*r.h),hit:hits/n,centre:!!c&&p.contains(c)}});
let pairs=0,worst=0;for(let i=0;i<tg.length;i++)for(let j=i+1;j<tg.length;j++){const a=area({l:Math.max(tg[i].l,tg[j].l),t:Math.max(tg[i].t,tg[j].t),r:Math.min(tg[i].r,tg[j].r),b:Math.min(tg[i].b,tg[j].b)});if(a>0){pairs++;worst=Math.max(worst,a/(tg[i].w*tg[i].h))}}
const reachInfo={beads:pinsEls.length,minOutsideShare:+Math.min(...own.map(o=>o.outside)).toFixed(3),minOwnShare:+Math.min(...own.map(o=>o.hit)).toFixed(2),centresOnOwnBead:own.filter(o=>o.centre).length,overlappingPairs:pairs,mostOverlapped:+worst.toFixed(2)};
reachInfo.ok=reachInfo.beads===9&&reachInfo.minOutsideShare>=0.995&&reachInfo.minOwnShare>=0.4&&reachInfo.centresOnOwnBead===9;`;

const layout = (tag, sizeName) => ({
  eval: `(async()=>{${sleep}${ready}${R}${INK}${Q}const W=innerWidth,H=innerHeight,dockEl=q('[data-dock-glass]'),dock=R(dockEl);
const heading=R(q('.map-heading')),cap=R(q('.map-caption')),sw=R(q('.map-mode')),title=q('.map-title'),tr=R(title);
const lines=e=>{const g=document.createRange();g.selectNodeContents(e);return [...g.getClientRects()].map(r=>({l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height})).filter(r=>r.w>2&&r.h>2)};
const texts=qa('.map-title,.map-text,.map-caption-title,.map-caption-line,.map-caption-fact,.map-caption-credit').filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2}).flatMap(lines);
const inside=r=>r.l>=0&&r.t>=0&&r.r<=W&&r.b<=H;
const beads=qa('.map-pin .map-bead').map(b=>{const r=R(b);return {x:r.l+r.w/2,y:r.t+r.h/2,rad:r.w/2}});
const under=beads.filter(b=>texts.some(t=>hit({l:b.x-b.rad,t:b.y-b.rad,r:b.x+b.rad,b:b.y+b.rad},t))).length;
const sizes=qa('.map-pin').map(p=>{const r=R(p);return [Math.round(r.w),Math.round(r.h)]});
${REACH}
const pl0=q('.map-plane'),pa=R(pl0),pin=pl0.style.cssText;pl0.style.cssText='';const pb=R(pl0);pl0.style.cssText=pin;const firstGlide=+Math.max(...[pa.l-pb.l,pa.t-pb.t,pa.r-pb.r,pa.b-pb.b].map(Math.abs)).toFixed(1);
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
beadsUnderWords:under,firstGlidePx:firstGlide,hitAreas:sizes.every(s=>s[0]>=44&&s[1]>=44),reach:reachInfo,corners,squares,readoutInk,underDock,underWords:underWords.map(n=>n),gridInk:trailInk,foot:Math.round(foot),captionLines:qa('.map-caption-fact').length&&R(q('.map-caption-fact')).w>2?'full':'short'};
o.ok=o.heading&&o.caption&&o.switch&&o.clearOfDock&&(!phone||o.titleLines<=1.3)&&o.switchClearOfTitle&&(W>=500||o.switchUnderTitle)&&under===0&&o.hitAreas&&reachInfo.ok&&corners.every(n=>n>0)&&squares.every(n=>n>0)&&readoutInk>0&&underDock===0&&underWords.every(n=>n===0)&&trailInk>0;
return JSON.stringify(o)})()`,
  label: `${sizeName}, overview: the words inside the screen and clear of the dock, one line of title on a phone, no bead under a line of the words, 44 px targets, all nine beads whole on the screen outside the dock and reachable, the frame's marks present and clear of the dock and the words (${tag})`,
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
// A real touch (or click) on the visible centre of each of the nine beads, in the overview, chooses that bead (R108): the page goes into My climb at it, and back.
const centreTaps = (w, h, dpr, mobile, name) => [
  { size: [w, h], dpr, mobile, touch: mobile, reduce: false, go: "{{BASE}}/experience", wait: 3500 },
  { eval: `(async()=>{${sleep}${ready}return 'ready'})()`, label: `${name}: ready for the taps` },
  ...Array.from({ length: 9 }, (_, i) => [
    { [mobile ? "tap" : "click"]: `(()=>{const b=document.querySelectorAll('.map-pin .map-bead')[${i}].getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()` },
    {
      eval: `(async()=>{${sleep}${Q}await sleep(300);const cur=qa('.map-pin').map((p,j)=>p.hasAttribute('data-current')?j:-1).filter(j=>j>=0);const o={tapped:${i},chosen:cur,mode:q('.map-page').dataset.mode};${press("Overview")};await sleep(3600);o.ok=cur.length===1&&cur[0]===${i}&&o.mode==='climb';return JSON.stringify(o)})()`,
      label: `${w} x ${h}: ${mobile ? "a touch" : "a click"} on the visible centre of bead ${i + 1} chooses bead ${i + 1}`,
    },
  ]).flat(),
];
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
const weightEval = (label, want) => ({
  eval: `(()=>{const n=performance.getEntriesByType('navigation')[0];const res=performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin));const kb=x=>+(x/1024).toFixed(1);const sum=a=>kb(a.reduce((s,r)=>s+(r.transferSize||0),0));const t=u=>res.filter(r=>u.test(r.name));
const img=document.querySelector('.map-plane img'),pre=[...document.querySelectorAll('link[rel=preload][as=image]')].filter(l=>!l.media||matchMedia(l.media).matches).map(l=>l.getAttribute('href'));
const relief=t(/\\/mars\\/relief/)[0],heights=t(/heights\\.png/)[0];
const o={document:kb(n.transferSize),js:sum(t(/\\.js(\\?|$)/)),css:sum(t(/\\.css(\\?|$)/)),images:sum(t(/\\.(webp|png|jpg)(\\?|$)/)),imageList:t(/\\.(webp|png|jpg)(\\?|$)/).map(r=>[r.name.replace(location.origin,''),kb(r.transferSize),Math.round(r.startTime),Math.round(r.responseEnd)]),totalSameOrigin:kb(n.transferSize+res.reduce((s,r)=>s+(r.transferSize||0),0)),requests:res.length+1,
pictureShown:img?img.currentSrc.replace(location.origin,''):null,preloadedForThisScreen:pre,reliefBytes:relief?kb(relief.transferSize):null,heightsBytes:heights?kb(heights.transferSize):null,heightsStartedAfterPicture:!!heights&&!!relief&&heights.startTime>=relief.responseEnd-1,
bytesBeforeHeights:kb(n.transferSize+res.filter(r=>!heights||r.startTime<heights.startTime).reduce((s,r)=>s+(r.transferSize||0),0))};
o.ok=o.pictureShown==='${want}'&&pre.length===1&&pre[0]==='${want}'&&!pre.some(h=>/heights/.test(h))&&o.heightsStartedAfterPicture;return JSON.stringify(o)})()`,
  label,
});
const weight = [
  { size: [1440, 900], dpr: 1, reduce: false, nocache: true, go: "{{BASE}}/experience", wait: 7000 },
  weightEval("first load of /experience at 1440 x 900 (7 s, cache off): same-origin bytes on the wire; the desktop picture is the one shown and preloaded, the heights are not preloaded and start after the picture", "/mars/relief.webp"),
  { size: [390, 844], dpr: 2, mobile: true, touch: true, nocache: true, go: "{{BASE}}/experience", wait: 7000 },
  weightEval("first load of /experience at 390 x 844 (7 s, cache off): same-origin bytes on the wire; the phone picture is the one shown and preloaded, the heights are not preloaded and start after the picture", "/mars/relief-phone.webp"),
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
  ...words(1440, 900, 1, false, true),
  wordsLeave,
  ...words(820, 1180, 1, false),
  ...words(390, 844, 2, true, true),
  ...words(320, 568, 2, true),
  titleGuard,
  ...chart,
  ...phoneRun(1440, 900, 1, false, "desktop"),
  ...phoneRun(820, 1180, 1, false, "tablet"),
  ...phoneRun(390, 844, 2, true, "phone"),
  ...phoneRun(360, 640, 2, true, "small"),
  ...phoneRun(320, 568, 2, true, "tiny"),
  ...phoneRun(844, 390, 2, true, "landscape"),
  ...centreTaps(1440, 900, 1, false, "desktop"),
  ...centreTaps(320, 568, 2, true, "tiny"),
  ...reach,
  ...carryOvers,
  ...reducedChart,
  ...weight,
];

/** Parts of the list, to run one at a time while working on them. */
export const chartParts = {
  tiny: phoneRun(320, 568, 2, true, "tiny"),
  taps: [...centreTaps(1440, 900, 1, false, "desktop"), ...centreTaps(320, 568, 2, true, "tiny")],
  keys: [...reach, ...carryOvers],
  reduced: reducedChart,
  weight,
};
