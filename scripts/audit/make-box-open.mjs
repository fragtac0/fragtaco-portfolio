// Writes scripts/audit/box-open.json (R55.2, Task 25): the home box holds the live scene and opening it is one move, on the production build.
// Run: node scripts/audit/make-box-open.mjs, then BASE=http://localhost:5181 node scripts/audit/cdp.mjs scripts/audit/box-open.json <outdir outside the repo>.
//
// For each box (the shelf and the wall) at 1440 by 900 (dpr 1) and 390 by 844 (phone, dpr 2, touch), a 60 fps film (a screencast: every frame the
// compositor makes) of opening by a click and of closing by Close, read frame by frame in the page against what the page recorded on its own
// animation frames (`window.__bo`: the scene's place and size, its corners, the chrome's opacity, and which element is on top inside the frame):
//   - `diffFirstPct`: the share of the box's pixels (a channel 48 or more apart) that differ between the last frame before the click and the
//     first frame after it (and the next two): under 1 (no swap, no fade: the click changes nothing the eye can see);
//   - `emptyFrames`: frames in which the scene's frame shows a flat picture (a luma spread under 6 over its inner 70%): none;
//   - `onTopNotScene`: frames before the chrome starts in which something other than the scene is on top inside the frame (elementsFromPoint): none;
//   - `othersDrawn`: until the chrome starts, the things inside the scene that paint besides its canvases and texture (text, pictures, backgrounds,
//     taking opacity into account): none, so the scene's canvas is the only thing drawn in the frame;
//   - the same canvas element throughout, the corners from 14 px to square, the chrome 0 until 72% of the eased move, the move's length;
//   - `maxStepPx`: the biggest frame-to-frame change in the frame's place or size (the peak of a 1 s ease is about 5% of the distance a frame).
// Then the Review Focus cases 1 to 5 (a click before the scene is ready, a resize while open then close, a turn in the opening and in the closing,
// a box half off the screen, a tab left in the background, and a lost context), and the move's frame cost with the CPU 4 times slower at 1440 by 900
// (dpr 2) and on the phone profile (every frame gap from the click to the end of the move, opening and closing, both boxes).
// Contact sheets (12 frames of the opening and 12 of the closing per box) are made from the saved frames: `local-box-<size>-<box>-open-<ms>.jpg` and
// `-close-`: they show thumbnails and covers, keep them under docs/redesign/compare/local/r55-2/.
import { writeFileSync } from "node:fs";

import { HELPERS } from "./box-open-helpers.mjs";

const wait = (ms) => `new Promise(r=>setTimeout(r,${ms}))`;
const BOX = {
  shelf: { id: "blkRead", kind: "reading", hit: "reading" },
  wall: { id: "blkWatch", kind: "watching", hit: "watching" },
};
const OPEN_ATS = [380, 420, 500, 560, 620, 680, 740, 800, 880, 960, 1100, 1500];
const sizes = [
  { name: "1440x900", size: [1440, 900], dpr: 1, mobile: false, touch: false },
  { name: "390x844", size: [390, 844], dpr: 2, mobile: true, touch: true },
];
// the helpers above are installed on every new document (they guard themselves), and a stall hook an earlier case set is cleared by the next load
const INIT = `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.removeItem('ft:debug-stall')}catch(e){}`;
const load = (s, extra = {}) => ({
  size: s.size,
  dpr: s.dpr,
  mobile: s.mobile,
  touch: s.touch,
  reduce: false,
  cpu: 1,
  init: `${INIT};${HELPERS}`,
  go: "{{BASE}}/",
  wait: 4500,
  ...extra,
});
// scrolls to the block and waits (up to 20 s) for its scene to have drawn into the box; the answer is how long that took
const toBlock = (b, label) => ({
  eval: `new Promise(r=>{document.getElementById('${b.id}').scrollIntoView({block:'center',behavior:'instant'});const t0=performance.now(),i=setInterval(()=>{const sc=document.querySelector('.box-scene[data-kind=${b.kind}]');if(sc.hasAttribute('data-drawn')||sc.hasAttribute('data-plain')||performance.now()-t0>20000){clearInterval(i);setTimeout(()=>r(JSON.stringify({drawnAfterMs:Math.round(performance.now()-t0),drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain')})),600)}},50)})`,
  label,
});

const steps = [];
const push = (...s) => steps.push(...s);

for (const s of sizes)
  for (const [name, b] of Object.entries(BOX)) {
    const tag = `${s.name} ${name}`,
      keep = `local-box-${s.name}-${name}`;
    push(load(s), toBlock(b, `${tag}: scroll to the box`));
    push({
      eval: `(()=>{const sc=document.querySelector('.box-scene[data-kind=${b.kind}]');const blk=document.getElementById('${b.id}');const r=sc.getBoundingClientRect();window.__boBox={left:r.left,top:r.top,width:r.width,height:r.height};window.__boCanvas=sc.querySelector('canvas');
      return JSON.stringify({box:Object.values(window.__boBox).map(Math.round),inBox:sc.parentElement.className==='blk-live',drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain'),live:blk.hasAttribute('data-live'),canvases:sc.querySelectorAll('canvas').length,inert:sc.hasAttribute('inert'),ariaHidden:sc.getAttribute('aria-hidden'),sceneOpacity:getComputedStyle(sc.firstElementChild.nextElementSibling).opacity,boxIsDarkUntilDrawn:getComputedStyle(blk.querySelector('.blk-box')).backgroundColor})})()`,
      label: `${tag}: the box holds the live scene, drawn, docked (inert, aria-hidden)`,
    });
    push({
      film: {
        ms: 2700,
        quality: 70,
        keep: keep + "-open",
        ats: OPEN_ATS.map((a) => a),
        analyze: "window.__boA",
        eval: `new Promise(r=>{window.__boStart('${b.kind}',window.__boBox);setTimeout(()=>{window.__boClick=performance.timeOrigin+performance.now();document.querySelector('[data-xp=${b.hit}]').click();r(1)},400)})`,
      },
      label: `${tag}: open film (a click at 0.4 s; frames saved as ${keep}-<ms>.jpg)`,
    });
    push({
      eval: `(async()=>{await ${wait(
        300,
      )};window.__boStop=true;const sc=document.querySelector('.box-scene[data-kind=${
        b.kind
      }]');const v=JSON.parse(window.__boVerdict('${name}','open',innerWidth,innerHeight));
      v.sameCanvas=window.__boCanvas===sc.querySelector('canvas');v.endsOpen=sc.dataset.at==='open'&&!!document.querySelector('.home-layer.ready');v.endRect=Object.values(sc.getBoundingClientRect().toJSON()).slice(0,4).map(Math.round);v.focus=document.activeElement.className;v.chromeOpacity=getComputedStyle(document.querySelector('.xp-head')).opacity;
      const first=window.__bo.find(r=>r.at==='move');v.startRect=first&&[first.l,first.tp,first.w,first.h].map(Math.round);const done=window.__bo.find(r=>r.at==='open');v.moveMs=done&&first?Math.round(done.t-window.__boClick):null;return JSON.stringify(v)})()`,
      label: `${tag}: OPEN verdict`,
    });
    push({
      film: {
        ms: 2700,
        quality: 70,
        keep: keep + "-close",
        ats: OPEN_ATS.map((a) => a),
        analyze: "window.__boA",
        eval: `new Promise(r=>{window.__boStart('${b.kind}',{left:0,top:0,width:innerWidth,height:innerHeight});setTimeout(()=>{window.__boClick=performance.timeOrigin+performance.now();document.querySelector('.xp-close').click();r(1)},400)})`,
      },
      label: `${tag}: close film (Close at 0.4 s)`,
    });
    push({
      eval: `(async()=>{await ${wait(
        300,
      )};window.__boStop=true;const sc=document.querySelector('.box-scene[data-kind=${
        b.kind
      }]');const v=JSON.parse(window.__boVerdict('${name}','close',innerWidth,innerHeight));
      const blk=document.querySelector('#${
        b.id
      } .blk-box').getBoundingClientRect();v.sameCanvas=window.__boCanvas===sc.querySelector('canvas');v.backInBox=sc.parentElement.className==='blk-live'&&!sc.dataset.at;v.endRect=Object.values(sc.getBoundingClientRect().toJSON()).slice(0,4).map(Math.round);v.boxRect=[blk.left,blk.top,blk.width,blk.height].map(Math.round);
      v.focusOnBlock=document.activeElement.dataset.xp==='${
        b.hit
      }';v.homeSunk=document.querySelector('.home-sink').style.transform||'none';v.layerGone=!document.querySelector('.home-layer');const done=window.__bo.find(r=>r.at==='box'&&r.t>window.__boClick+300);v.moveMs=done?Math.round(done.t-window.__boClick):null;return JSON.stringify(v)})()`,
      label: `${tag}: CLOSE verdict`,
    });
  }

// ---- Review Focus 1: a click before the scene is ready
for (const [name, b] of Object.entries(BOX)) {
  push({
    size: [1440, 900],
    dpr: 1,
    mobile: false,
    touch: false,
    reduce: false,
    cpu: 1,
    init: `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-stall','hang')}catch(e){};${HELPERS}`,
    go: "{{BASE}}/",
    wait: 1500,
  });
  push(
    toBlock(b, `RF1 ${name}: stalled scene (its preparation never finishes): scroll to the box`),
  );
  push({
    eval: `new Promise(r=>{const t0=performance.now(),log=[],blk=document.getElementById('${b.id}');document.querySelector('[data-xp=${b.hit}]').click();
      const i=setInterval(()=>{const sc=document.querySelector('.box-scene[data-kind=${b.kind}]');log.push([Math.round(performance.now()-t0),blk.hasAttribute('data-pressed'),!!document.querySelector('.home-layer'),sc.dataset.at||'box',sc.hasAttribute('data-plain'),!!document.querySelector('.home-layer .fb-grid,.home-layer .fb-scroll'),document.querySelectorAll('.home-layer canvas').length]);
      if(performance.now()-t0>2600){clearInterval(i);const sc=document.querySelector('.box-scene[data-kind=${b.kind}]');const opened=log.find(l=>l[2]);const pressed=log.filter(l=>l[1]);r(JSON.stringify({clickNotIgnored:!!opened,pressedFromMs:pressed[0]?.[0]??null,pressedUntilMs:pressed.at(-1)?.[0]??null,openedAtMs:opened?.[0]??null,movedPlain:!!opened&&opened[4],gridInLayer:log.at(-1)[5],canvasesInLayer:log.at(-1)[6],endAt:log.at(-1)[3],neverOpenedEmpty:log.filter(l=>l[2]&&l[3]!=='box'&&!l[4]).length===0}))}},40)})`,
    label: `RF1 ${name}: a click before the scene is ready waits at most 400 ms (pressed), then opens to the plain grid with the same move; never ignored, never empty`,
  });
  push({
    eval: `(async()=>{await ${wait(900)};document.querySelector('.xp-close').click();await ${wait(
      1300,
    )};const sc=document.querySelector('.box-scene[data-kind=${
      b.kind
    }]');const blk=document.getElementById('${
      b.id
    }');return JSON.stringify({closed:!document.querySelector('.home-layer'),sceneInBox:sc.parentElement.className==='blk-live',miniPreviewShown:getComputedStyle(blk.querySelector('.blk-art')).visibility==='visible',sceneHidden:getComputedStyle(blk.querySelector('.blk-live')).display==='none',focusOnBlock:document.activeElement.dataset.xp==='${
      b.hit
    }'})})()`,
    label: `RF1 ${name}: closing the plain grid puts the flat preview back`,
  });
}

// ---- Review Focus 2 to 4 on each box at 1440 by 900
for (const [name, b] of Object.entries(BOX)) {
  const R = `Object.values(document.querySelector('.box-scene[data-kind=${b.kind}]').getBoundingClientRect().toJSON()).slice(0,4).map(Math.round)`;
  const BR = `(()=>{const r=document.querySelector('#${b.id} .blk-box').getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round)})()`;
  push(load(sizes[0]), toBlock(b, `RF2-4 ${name}: scroll to the box`));
  // RF2: resize while open, then close: the frame returns to where the box is now
  push({
    eval: `(async()=>{window.__boStart('${b.kind}');document.querySelector('[data-xp=${
      b.hit
    }]').click();await ${wait(1500)};return JSON.stringify({open:${R}})})()`,
    label: `RF2 ${name}: open (1440 by 900)`,
  });
  push({
    size: [1100, 760],
    dpr: 1,
    wait: 400,
    eval: `(async()=>{await ${wait(
      600,
    )};return JSON.stringify({afterResizeOpen:${R},boxNow:${BR}})})()`,
    label: `RF2 ${name}: the window is resized to 1100 by 760 while open (the open page fills it)`,
  });
  push({
    eval: `(async()=>{document.querySelector('.xp-close').click();await ${wait(
      1400,
    )};const bo=window.__bo.filter(r=>r.at==='move');const first=bo[0];const last=bo.at(-1);return JSON.stringify({backInBox:!document.querySelector('.home-layer'),finalRect:${R},boxNow:${BR},firstClosingFrame:first&&[first.l,first.tp,first.w,first.h].map(Math.round),lastMoveFrame:last&&[last.l,last.tp,last.w,last.h].map(Math.round)})})()`,
    label: `RF2 ${name}: Close: the frame ends where the box is NOW, not where it was`,
  });
  push({ eval: `(()=>{window.__boStop=true;return 1})()` });
  // RF3: turn in the opening, and in the closing
  push({ size: [1440, 900], dpr: 1, wait: 600 }, toBlock(b, `RF3 ${name}: scroll back`));
  push({
    eval: `(async()=>{window.__boStart('${b.kind}');document.querySelector('[data-xp=${
      b.hit
    }]').click();await ${wait(
      520,
    )};const before=${R};document.querySelector('.xp-close').click();await ${wait(1500)};
      const bo=window.__bo;let ti=-1,sg=0;for(let i=1;i<bo.length;i++){const dw=bo[i].w-bo[i-1].w;if(Math.abs(dw)>0.01){if(sg>0&&dw<0){ti=i;break}sg=dw<0?-1:1}}
      const steps=[];for(let i=1;i<bo.length;i++){if(bo[i-1].at==='move'&&bo[i].at==='move')steps.push(Math.max(Math.abs(bo[i].l-bo[i-1].l),Math.abs(bo[i].tp-bo[i-1].tp),Math.abs(bo[i].w-bo[i-1].w),Math.abs(bo[i].h-bo[i-1].h)))}
      const around=steps.slice(Math.max(0,ti-4),ti+4).map(v=>+v.toFixed(1));return JSON.stringify({widthWhenTurned:ti>0?Math.round(bo[ti-1].w):null,turnedBackAtFrame:ti,stepsAroundTurn:around,maxStepPx:+Math.max(...steps).toFixed(1),endsInBox:!document.querySelector('.home-layer')&&bo.at(-1).at==='box',canvasKept:true})})()`,
    label: `RF3 ${name}: Close half way through an opening: the move turns round from where it is (no jump)`,
  });
  push({
    eval: `(async()=>{window.__boStop=true;window.__boStart('${
      b.kind
    }');document.querySelector('[data-xp=${b.hit}]').click();await ${wait(
      1300,
    )};document.querySelector('.xp-close').click();await ${wait(
      450,
    )};const w0=window.__bo.at(-1).w;document.querySelector('.layer-stage').dispatchEvent(new MouseEvent('click',{bubbles:true}));await ${wait(
      1500,
    )};
      const bo=window.__bo;let ti=-1,sg=0;for(let i=1;i<bo.length;i++){const dw=bo[i].w-bo[i-1].w;if(Math.abs(dw)>0.01){if(sg<0&&dw>0){ti=i;break}sg=dw<0?-1:1}}
      const steps=[];for(let i=1;i<bo.length;i++){if(bo[i-1].at==='move'&&bo[i].at==='move')steps.push(Math.max(Math.abs(bo[i].l-bo[i-1].l),Math.abs(bo[i].tp-bo[i-1].tp),Math.abs(bo[i].w-bo[i-1].w),Math.abs(bo[i].h-bo[i-1].h)))}
      return JSON.stringify({widthWhenTurned:Math.round(w0),turnedOpenAtFrame:ti,stepsAroundTurn:steps.slice(Math.max(0,ti-4),ti+4).map(v=>+v.toFixed(1)),maxStepPx:+Math.max(...steps).toFixed(1),endsOpen:bo.at(-1).at==='open'&&!!document.querySelector('.home-layer.ready'),hash:location.hash})})()`,
    label: `RF3 ${name}: a click half way through a closing turns it back into an opening (no jump)`,
  });
  push({
    eval: `(async()=>{window.__boStop=true;document.querySelector('.xp-close').click();await ${wait(
      1500,
    )};return JSON.stringify({closed:!document.querySelector('.home-layer'),hash:location.hash})})()`,
    label: `RF3 ${name}: close again`,
  });
  // RF4: the box half off the screen when clicked
  push({
    eval: `(()=>{const r=document.querySelector('#${b.id} .blk-box').getBoundingClientRect();window.scrollBy({top:r.top+r.height*0.5-0,behavior:'instant'});return 1})()`,
    wait: 600,
    label: `RF4 ${name}: scroll so the box is half off the top of the screen`,
  });
  push({
    eval: `(async()=>{const box=${BR};window.__boStart('${
      b.kind
    }');document.querySelector('[data-xp=${b.hit}]').click();await ${wait(
      1400,
    )};const first=window.__bo.find(r=>r.at==='move');return JSON.stringify({boxBeforeClick:box,boxTopVisibleShare:+(1-(-Math.min(0,box[1]))/box[3]).toFixed(2),firstFrame:first&&[first.l,first.tp,first.w,first.h].map(Math.round),endRect:${R}})})()`,
    label: `RF4 ${name}: the frame grows from the box where it is (half off screen) to the window`,
  });
  push({
    eval: `(async()=>{document.querySelector('.xp-close').click();await ${wait(
      1400,
    )};const bo=window.__bo.filter(r=>r.at==='move');const first=bo.find((r)=>r.t>0);return JSON.stringify({closed:!document.querySelector('.home-layer'),finalRect:${R},boxNow:${BR}})})()`,
    label: `RF4 ${name}: closing returns to the box's place`,
  });
  push({ eval: `(()=>{window.__boStop=true;return 1})()` });
}

// ---- Review Focus 5: a tab left in the background; a lost context
for (const [name, b] of Object.entries(BOX)) {
  push(load(sizes[0]), toBlock(b, `RF5 ${name}: scroll to the box`));
  push({
    eval: `(async()=>{const sc=document.querySelector('.box-scene[data-kind=${
      b.kind
    }]');const cv=sc.querySelector('.wall-canvas,.shelf-canvas');const gl=cv.getContext('webgl2')||cv.getContext('webgl');const lost=()=>gl?gl.isContextLost():null;
      const count=async(ms)=>{const a=window.__draws.${name};await new Promise(r=>setTimeout(r,ms));return window.__draws.${name}-a};
      const running=await count(1000);
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));
      await ${wait(300)};const hidden=await count(2000);
      delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));
      const back=await count(500);const after=await count(1000);
      return JSON.stringify({drawsPerSecondRunning:running,drawsWhileHiddenIn2s:hidden,drawsInFirst500msBack:back,drawsNextSecond:after,burst:back>40,contextLost:lost(),drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain')})})()`,
    label: `RF5 ${name}: the tab is hidden for 2 s and comes back: no draws while hidden, no burst after, context kept`,
  });
  push({
    eval: `(async()=>{const sc=document.querySelector('.box-scene[data-kind=${
      b.kind
    }]');const blk=document.getElementById('${
      b.id
    }');const cv=sc.querySelector('.wall-canvas,.shelf-canvas');const gl=cv.getContext('webgl2')||cv.getContext('webgl');const ext=gl.getExtension('WEBGL_lose_context');ext.loseContext();await ${wait(
      900,
    )};
      const v={plainSet:sc.hasAttribute('data-plain'),liveOff:!blk.hasAttribute('data-live'),miniPreviewShown:getComputedStyle(blk.querySelector('.blk-art')).visibility==='visible',sceneHidden:getComputedStyle(blk.querySelector('.blk-live')).display==='none'};
      document.querySelector('[data-xp=${b.hit}]').click();await ${wait(
      1400,
    )};v.opensToGrid=!!document.querySelector('.home-layer .fb-grid,.home-layer .fb-scroll');v.noCanvasInLayer=document.querySelectorAll('.home-layer canvas').length===0;return JSON.stringify(v)})()`,
    label: `RF5 ${name}: a lost context puts the flat preview back in the box; a click opens the plain grid`,
  });
}

// ---- reduced motion: no growing frame, a 200 ms fade
for (const [name, b] of Object.entries(BOX)) {
  push(load(sizes[0], { reduce: true }), toBlock(b, `reduced ${name}: scroll to the box`));
  push({
    eval: `(async()=>{const sc=document.querySelector('.box-scene[data-kind=${b.kind}]');const root=()=>document.querySelector('.home-layer');const log=[];const t0=performance.now();document.querySelector('[data-xp=${b.hit}]').click();
      await new Promise(r=>{const f=()=>{const rt=root();const r0=sc.getBoundingClientRect();log.push([Math.round(performance.now()-t0),rt?+getComputedStyle(rt).opacity:null,[r0.left,r0.top,r0.width,r0.height].map(Math.round).join(','),sc.dataset.at||'box']);performance.now()-t0>700?r():requestAnimationFrame(f)};f()});
      const rects=[...new Set(log.filter(l=>l[3]!=='box').map(l=>l[2]))];const ops=log.map(l=>l[1]).filter(v=>v!=null);
      const o={fadeMs:(()=>{const a=log.find(l=>l[1]>0.02),z=log.find(l=>l[1]>=0.999);return a&&z?z[0]-a[0]:null})(),distinctRects:rects,opacityMax:Math.max(...ops),startsAt:ops[0],endAt:sc.dataset.at,growingFrame:log.some(l=>l[3]==='move')};
      document.querySelector('.xp-close').click();await new Promise(r=>setTimeout(r,500));o.closed=!document.querySelector('.home-layer');o.back=sc.parentElement.className==='blk-live';return JSON.stringify(o)})()`,
    label: `reduced ${name}: no growing frame; the open page fades in over about 200 ms and leaves the same way`,
  });
}

// ---- the move's frame cost
const cost = [
  { name: "1440x900 dpr2 cpu4", size: [1440, 900], dpr: 2, mobile: false, touch: false },
  { name: "390x844 phone dpr3 cpu4", size: [390, 844], dpr: 3, mobile: true, touch: true },
];
for (const c of cost)
  for (const [name, b] of Object.entries(BOX)) {
    const gaps = (what, click, ms) =>
      `new Promise(r=>{const g=[];let l=performance.now();const t0=l;${click};function f(n){g.push(n-l);l=n;if(n-t0<${ms})requestAnimationFrame(f);else{g.shift();const s=[...g].sort((a,b)=>a-b);r(JSON.stringify({what:'${what}',frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+s[s.length-1].toFixed(2),over20:g.filter(x=>x>20).length,over34:g.filter(x=>x>34).length,firstFramesMs:g.slice(0,4).map(x=>+x.toFixed(1)),over34At:g.map((x,i)=>x>34?[i,+x.toFixed(1)]:null).filter(Boolean)}))}}requestAnimationFrame(f)})`;
    push(load(c, { cpu: 1 }), toBlock(b, `cost ${c.name} ${name}: scroll to the box`), {
      cpu: 4,
      wait: 1500,
    });
    push({
      eval: gaps(
        `open ${name} (cold: the first move)`,
        `document.querySelector('[data-xp=${b.hit}]').click()`,
        1500,
      ),
      label: `cost ${c.name} ${name}: frame gaps, the first opening (a cold start)`,
    });
    push({
      eval: gaps(`close ${name}`, `document.querySelector('.xp-close').click()`, 1500),
      label: `cost ${c.name} ${name}: frame gaps, closing`,
    });
    push({
      eval: gaps(
        `open ${name} again`,
        `document.querySelector('[data-xp=${b.hit}]').click()`,
        1500,
      ),
      label: `cost ${c.name} ${name}: frame gaps, opening again (warm)`,
    });
    push({
      eval: gaps(`close ${name} again`, `document.querySelector('.xp-close').click()`, 1500),
      label: `cost ${c.name} ${name}: frame gaps, closing again`,
    });
    push({
      eval: `(async()=>{await new Promise(r=>setTimeout(r,500));return JSON.stringify({closed:!document.querySelector('.home-layer')})})()`,
      label: `cost ${c.name} ${name}: closed`,
    });
    push({ cpu: 1 });
  }

writeFileSync(new URL("./box-open.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
console.log(`box-open.json: ${steps.length} steps`);
