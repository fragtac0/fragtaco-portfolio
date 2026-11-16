// The reading box's framing (R55.3j, Task 30; second look spec 6), pushed into box-open-kit.mjs's `steps`:
//   framingCases()   at 1440 by 900, 1366 by 768 and 390 by 844 (Review Focus 4: a short wide box and a narrow tall one):
//     REST    the engine's own projected boxes (`__ftEngines.shelf.projected()`: each book's and the ledge's bounding box taken through the camera as it
//             draws them) are inside the box's frame: every book, the ledge's top edge and its front face; the tallest book's top is at least 6% of the box's
//             height below the top; the row is as large as fits (a padding of box-framing.ts is tight); the dot field covers the box down to the line the books stand on;
//     OPEN    a recorder on every animation frame (`__bf`: the scene's rect and the ledge's and the tallest book's size as drawn) reads the opening from the click:
//             the first frame of the move is the box's own picture (no step), the picture then only grows, with no step at the end of the move or after it, and
//             the end is the open page: the engine's boxes equal those of the same window opened by a deep link (the last frame is the open page);
//     CLOSE   the same backwards, ending in the box's picture as it was at rest;
//     RF5     a click while the scene is still fading in (the first frame after `data-drawn`): the picture at the click, at the first frame of the move and at
//             rest afterwards are one picture.
//   The pictures (a still of the box at rest) are saved as `local-rest-<size>.jpg` (they show covers: docs/redesign/compare/local/r55-4/).
import { HELPERS } from "./box-open-helpers.mjs";
import { INIT, push, wait } from "./box-open-kit.mjs";

export const FRAMING_SIZES = [
  { name: "1440x900", size: [1440, 900], dpr: 1, mobile: false, touch: false },
  { name: "1366x768", size: [1366, 768], dpr: 1, mobile: false, touch: false },
  { name: "390x844", size: [390, 844], dpr: 2, mobile: true, touch: true },
];

// the page-side recorder: the scene's rect and what the engine draws, on every animation frame
const BF = `(() => {
  if (window.__bfStart) return;
  const sc = () => document.querySelector('.box-scene[data-kind=reading]');
  window.__bfRead = () => {
    const p = window.__ftEngines.shelf.projected(); if (!p) return null;
    const r = sc().getBoundingClientRect();
    return { w: r.width, h: r.height, fw: p.frame.w, fh: p.frame.h, ledgeW: p.ledge.right - p.ledge.left, ledgeTop: p.ledge.top, ledgeBottom: p.ledge.bottom,
      tallPx: Math.max(...p.books.map((b) => b.bottom - b.top)), topShare: Math.min(...p.books.map((b) => b.top)) / p.frame.h, left: Math.min(...p.books.map((b) => b.left)), right: Math.max(...p.books.map((b) => b.right)),
      books: p.books.map((b) => [b.left, b.right, b.top, b.bottom]) };
  };
  window.__bfStart = () => {
    window.__bf = []; window.__bfStop = false;
    const rec = () => { const v = window.__bfRead(); if (v) window.__bf.push({ t: performance.now(), at: sc().dataset.at || 'box', ...v }); if (!window.__bfStop) requestAnimationFrame(rec); };
    rec();
  };
  // the opening or the closing as the recorder saw it: the picture's size (the ledge's width as drawn) frame by frame
  window.__bfVerdict = (dir, rest) => {
    const bf = window.__bf, mv = bf.filter((r) => r.at === 'move'), first = mv[0], last = mv.at(-1);
    const end = bf.find((r) => r.t > last.t && r.at === (dir === 'open' ? 'open' : 'box'));
    const v = mv.map((r) => r.ledgeW), up = dir === 'open' ? 1 : -1;
    let backwards = 0; for (let i = 1; i < v.length; i++) if (up * (v[i] - v[i - 1]) < -0.5) backwards++;
    const steps = []; for (let i = 1; i < v.length; i++) steps.push(Math.abs(v[i] - v[i - 1]));
    const way = Math.abs(v.at(-1) - v[0]);
    const startRef = dir === 'open' ? rest : null;
    const share = (a, b) => +(Math.abs(a - b) / Math.max(1, Math.abs(b)) * 100).toFixed(2);
    return { dir, moveFrames: mv.length, firstLedgeW: +first.ledgeW.toFixed(2), lastLedgeW: +last.ledgeW.toFixed(2), afterLedgeW: end ? +end.ledgeW.toFixed(2) : null, backwardsFrames: backwards,
      maxStepPctOfWay: +(Math.max(...steps) / way * 100).toFixed(2), firstStepPctOfWay: +(steps[0] / way * 100).toFixed(2), lastStepPctOfWay: +(steps.at(-1) / way * 100).toFixed(2),
      firstVsRestPct: startRef ? share(first.ledgeW, startRef.ledgeW) : null, firstVsRestTallPct: startRef ? share(first.tallPx, startRef.tallPx) : null,
      lastVsAfterPct: end ? share(last.ledgeW, end.ledgeW) : null, firstFrameRect: [first.w, first.h].map(Math.round), firstTopShare: +first.topShare.toFixed(4),
      inFrameAtFirst: first.left >= -0.5 && first.right <= first.fw + 0.5 };
  };
})()`;

const SCENE = `document.querySelector('.box-scene[data-kind=reading]')`;

// the rest check, run on the box with the scene drawn
const REST = (name) => `(()=>{
  const p=window.__ftEngines.shelf.projected(),sc=${SCENE},r=sc.getBoundingClientRect(),W=p.frame.w,H=p.frame.h,e=0.5;
  const inside=(b)=>b.left>=-e&&b.right<=W+e&&b.top>=-e&&b.bottom<=H+e;
  const top=Math.min(...p.books.map(b=>b.top)),foot=H-p.ledge.bottom,side=Math.min(Math.min(...p.books.map(b=>b.left)),W-Math.max(...p.books.map(b=>b.right)),p.ledge.left,W-p.ledge.right);
  const dots=sc.querySelector('.dot-field'),d=dots&&dots.getBoundingClientRect(),cs=dots&&getComputedStyle(dots);
  const inset=cs&&/inset\\(([^)]*)\\)/.exec(cs.clipPath),v=inset?inset[1].split(' ').map(parseFloat):[0],cut=[v[0],v[1]??v[0],v[2]??v[0],v[3]??v[1]??v[0]],sc2=dots?d.width/dots.offsetWidth:1;
  const vis=d&&{left:d.left+cut[3]*sc2,right:d.right-cut[1]*sc2,top:d.top+cut[0]*sc2,bottom:d.bottom-cut[2]*sc2};
  const dotsCover=!!vis&&vis.left<=r.left+e&&vis.right>=r.right-e&&vis.top<=r.top+e&&vis.bottom>=r.top+Math.min(p.ledge.top,H)-e;
  const x=dots&&dots.getContext('2d').getImageData(0,0,Math.min(dots.width,300),Math.min(dots.height,300)).data;let a=0;if(x)for(let i=3;i<x.length;i+=4)a+=x[i];
  const ok=p.books.length===14&&p.books.every(inside)&&inside(p.ledge)&&top/H>=0.06&&Math.abs(r.width-W)<=e&&Math.abs(r.height-H)<=e&&dotsCover&&a>0;
  return JSON.stringify({ok,size:'${name}',box:[r.width,r.height].map(v=>+v.toFixed(1)),books:p.books.length,everyBookInside:p.books.every(inside),ledgeInside:inside(p.ledge),ledgeTopEdgePx:+p.ledge.top.toFixed(1),ledgeBottomPx:+p.ledge.bottom.toFixed(1),
    tallestTopShareOfBoxHeight:+(top/H).toFixed(4),tallestBookPx:+Math.max(...p.books.map(b=>b.bottom-b.top)).toFixed(1),
    marginsPx:{top:+top.toFixed(1),foot:+foot.toFixed(1),side:+side.toFixed(1)},asLargeAsFits:Math.abs(top/H-0.07)<0.002||Math.abs(foot/H-0.05)<0.002||Math.abs(side/W-0.03)<0.002,
    dotFieldCoversBox:dotsCover,dotsPainted:a>0,dotVisible:vis&&Object.fromEntries(Object.entries(vis).map(([k,v])=>[k,Math.round(v)]))})})()`;

export function framingCases() {
  let n = 0;
  const load = (s, hash) => ({
    size: s.size,
    dpr: s.dpr,
    mobile: s.mobile,
    touch: s.touch,
    reduce: false,
    cpu: 1,
    init: `${INIT};try{sessionStorage.setItem('ft:debug-engines','1')}catch(e){};${HELPERS};${BF}`,
    go: `{{BASE}}/?bf=${++n}${hash ?? ""}`,
    wait: 4500,
  });
  // scrolls to the reading block and waits for the scene to have drawn
  const toBox = (label) => ({
    eval: `new Promise(r=>{document.getElementById('blkRead').scrollIntoView({block:'center',behavior:'instant'});const t0=performance.now(),i=setInterval(()=>{const sc=${SCENE};if(sc.hasAttribute('data-drawn')||sc.hasAttribute('data-plain')||performance.now()-t0>20000){clearInterval(i);setTimeout(()=>r(JSON.stringify({drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain')})),900)}},50)})`,
    label,
  });

  for (const s of FRAMING_SIZES) {
    const tag = `FRAMING ${s.name}`;
    push(load(s), toBox(`${tag}: scroll to the reading box`));
    push({ eval: REST(s.name), label: `${tag} REST (Review Focus 4): every book and the ledge's top edge and front face inside the box, the tallest book at least 6% below its top, as large as fits, the dot field round it (ok must be true)` });
    push({ shot: `local-rest-${s.name}`, label: `${tag}: still of the box at rest` });
    // OPEN: read the rest picture, run the recorder, click at 300 ms; after the move save the open page's boxes for the deep-link comparison
    push({
      eval: `(async()=>{window.__rest=window.__bfRead();window.__bfStart();await ${wait(300)};document.querySelector('[data-xp=reading]').click();await ${wait(1700)};window.__bfStop=true;await ${wait(100)};
        const v=window.__bfVerdict('open',window.__rest);const open=window.__bfRead();sessionStorage.setItem('bf-open','${s.name}|'+JSON.stringify(open.books)+'|'+JSON.stringify([open.ledgeW,open.ledgeTop,open.ledgeBottom]));
        v.endsOpen=${SCENE}.dataset.at==='open'&&!!document.querySelector('.home-layer.ready');
        v.ok=v.endsOpen&&v.firstVsRestPct<=1&&v.firstVsRestTallPct<=1&&v.backwardsFrames===0&&v.lastVsAfterPct<=1&&v.maxStepPctOfWay<=15&&v.inFrameAtFirst&&Math.abs(v.firstFrameRect[0]-window.__rest.w)<=8;return JSON.stringify(v)})()`,
      label: `${tag} OPEN: the first frame of the move is the box's own picture (firstVsRestPct under 1), the picture only grows (backwardsFrames 0), no step at the end of the move (lastVsAfterPct under 1, lastStepPctOfWay no larger than maxStepPctOfWay)`,
    });
    // CLOSE: the same backwards, back to the picture the box had at rest
    push({
      eval: `(async()=>{window.__bfStart();await ${wait(300)};document.querySelector('.xp-close').click();await ${wait(1700)};window.__bfStop=true;await ${wait(100)};
        const v=window.__bfVerdict('close',null);const rest=window.__bfRead();const was=window.__rest;
        v.backInBox=!document.querySelector('.home-layer')&&!${SCENE}.dataset.at;v.restAgainDiffPx=Math.max(...rest.books.flatMap((b,i)=>b.map((x,k)=>Math.abs(x-was.books[i][k]))),Math.abs(rest.ledgeW-was.ledgeW));
        v.ok=v.backInBox&&v.backwardsFrames===0&&v.lastVsAfterPct<=1&&v.restAgainDiffPx<=0.5&&v.maxStepPctOfWay<=15;return JSON.stringify(v)})()`,
      label: `${tag} CLOSE: the same backwards: ends in the box's own picture (restAgainDiffPx at most 0.5), the picture only shrinks`,
    });
    // the open page opened by a deep link at this window size: the boxes at the end of the move are these (the last frame of the move is the open page)
    push(load(s, "#reading"), {
      eval: `new Promise(r=>{const t0=performance.now(),i=setInterval(()=>{const sc=${SCENE};if((document.querySelector('.home-layer.ready')&&sc&&sc.dataset.at==='open'&&sc.hasAttribute('data-drawn'))||performance.now()-t0>15000){clearInterval(i);setTimeout(()=>{const open=window.__bfRead(),was=sessionStorage.getItem('bf-open').split('|');const books=JSON.parse(was[1]),led=JSON.parse(was[2]);
          const d=Math.max(...open.books.flatMap((b,i)=>b.map((x,k)=>Math.abs(x-books[i][k]))),Math.abs(open.ledgeW-led[0]),Math.abs(open.ledgeTop-led[1]),Math.abs(open.ledgeBottom-led[2]));
          r(JSON.stringify({ok:was[0]==='${s.name}'&&d<=1,maxDiffPx:+d.toFixed(2),size:'${s.name}',openedByDeepLink:!!document.querySelector('.home-layer.ready'),frameIsWindow:[open.fw,open.fh]}))},900)}},100)})`,
      label: `${tag} LAST FRAME: the engine's boxes at the end of the move equal those of the same window opened by a deep link (maxDiffPx at most 1)`,
    });
  }

  // RF5: a click while the scene is still fading in
  for (const s of FRAMING_SIZES) {
    const tag = `RF5 ${s.name}`;
    push(load(s));
    push({
      eval: `new Promise(r=>{const sc=${SCENE};document.getElementById('blkRead').scrollIntoView({block:'center',behavior:'instant'});
        const i=setInterval(()=>{if(!sc.hasAttribute('data-drawn')&&!sc.hasAttribute('data-plain'))return;clearInterval(i);
          const atClick=window.__bfRead(),op=getComputedStyle([...sc.children].find((c)=>!c.classList.contains('tex'))).opacity;window.__bfStart();
          document.querySelector('[data-xp=reading]').click();
          setTimeout(()=>{window.__bfStop=true;r(JSON.stringify({atClick:{ledgeW:atClick&&atClick.ledgeW,tallPx:atClick&&atClick.tallPx,topShare:atClick&&atClick.topShare},sceneOpacityAtClick:+op,fading:+op<1}))},1700)},10)})`,
      label: `${tag}: the click comes in the first frames after the scene has drawn (its fade-in); the recorder runs from the click`,
    });
    push({
      eval: `(async()=>{await ${wait(100)};const bf=window.__bf,first=bf.find(r=>r.at==='move');document.querySelector('.xp-close').click();await ${wait(1600)};const rest=window.__bfRead();
        const cmp=(a,b)=>+(Math.abs(a-b)/Math.max(1,b)*100).toFixed(2);
        const v={firstMoveFrame:{ledgeW:+first.ledgeW.toFixed(2),tallPx:+first.tallPx.toFixed(2),topShare:+first.topShare.toFixed(4)},atRest:{ledgeW:+rest.ledgeW.toFixed(2),tallPx:+rest.tallPx.toFixed(2),topShare:+rest.topShare.toFixed(4)},firstVsRestPct:cmp(first.ledgeW,rest.ledgeW),firstVsRestTallPct:cmp(first.tallPx,rest.tallPx),firstRectIsBox:Math.abs(first.w-rest.w)<=1&&Math.abs(first.h-rest.h)<=1,closed:!document.querySelector('.home-layer')};
        v.ok=v.firstVsRestPct<=1&&v.firstVsRestTallPct<=1&&v.firstRectIsBox&&v.closed;return JSON.stringify(v)})()`,
      label: `${tag}: the first frame of the move has the picture the box has at rest (firstVsRestPct under 1), though the scene was still fading in at the click`,
    });
  }
}
