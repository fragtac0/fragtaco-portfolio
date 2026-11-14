// Writes scripts/audit/box-open.json (R55.2, Task 25): the home box holds the live scene and opening it is one move, on the production build.
// Run: node scripts/audit/make-box-open.mjs, then BASE=http://localhost:5181 node scripts/audit/cdp.mjs scripts/audit/box-open.json <outdir outside the repo>.
//
// For each box (the shelf and the wall) at 1440 by 900 (dpr 1) and 390 by 844 (phone, dpr 2, touch), a 60 fps film (a screencast: every frame the
// compositor makes) of opening by a click and of closing by Close, read frame by frame in the page against what the page recorded on its own
// animation frames (`window.__bo`: the scene's place and size, its corners, the chrome's opacity, and which element is on top inside the frame):
//   - `diffMaxFirst100msPct`: the share of the box's pixels (a channel 48 or more apart) that differ between the last frame before the move (the frame
//     before the first film frame whose recorder row is in the move) and each film frame in the first 100 ms of the move: under 1 (no swap, no fade: the
//     click changes nothing the eye can see); the two clocks (the film's wall clock, the recorder's performance clock) are matched and the offset logged;
//   - `emptyFrames`: frames in which the scene's frame shows a flat picture (a luma spread under 6 over its inner 70%): none;
//   - `onTopNotScene`: frames before the chrome starts in which something other than the scene is on top inside the frame (elementsFromPoint): none;
//   - `othersDrawn`: until the chrome starts, the things inside the scene that paint besides its canvases and texture (text, pictures, backgrounds,
//     taking opacity into account): none, so the scene's canvas is the only thing drawn in the frame;
//   - the same canvas element throughout, the corners from 14 px to square, the chrome 0 until 72% of the eased move, the move's length;
//   - `maxStepPx`: the biggest frame-to-frame change in the frame's place or size (the peak of a 1 s ease is about 5% of the distance a frame).
// Then the Review Focus cases 1 to 5 (a click before the scene is ready, a resize while open then close, a turn in the opening and in the closing,
// a box half off the screen, a tab really left in the background for 60 s, and a lost context), and the move's frame cost with the CPU 4 times slower at 1440 by 900
// (dpr 2) and on the phone profile (every frame gap from the click to the end of the move, opening and closing, both boxes).
// Contact sheets (12 frames of the opening and 12 of the closing per box) are made from the saved frames: `local-box-<size>-<box>-open-<ms>.jpg` and
// `-close-`: they show thumbnails and covers, keep them under docs/redesign/compare/local/r55-2/.
import { writeFileSync } from "node:fs";

import { BOX, OPEN_ATS, load, push, sizes, steps, toBlock, wait } from "./box-open-kit.mjs";
import { focusCases, focusCasesLate } from "./box-open-focus.mjs";


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

focusCases(); // Review Focus 1: a click before the scene is ready (and a give-up lasts one opening)

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

focusCasesLate(); // Review Focus 5 (a real background tab), the open scene across it, the wall's pan at the end of the move, reduced motion

// ---- the move's frame cost
const cost = [
  { name: "1440x900 dpr2 cpu4", size: [1440, 900], dpr: 2, mobile: false, touch: false },
  { name: "390x844 phone dpr3 cpu4", size: [390, 844], dpr: 3, mobile: true, touch: true },
];
for (const c of cost)
  for (const [name, b] of Object.entries(BOX)) {
    const gaps = (what, click, ms) =>
      `new Promise(r=>{const loaf=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())loaf.push(e)}).observe({type:'long-animation-frame'})}catch(e){}const g=[];let l=performance.now();const t0=l;${click};function f(n){g.push(n-l);l=n;if(n-t0<${ms})requestAnimationFrame(f);else{g.shift();const s=[...g].sort((a,b)=>a-b);r(JSON.stringify({what:'${what}',frames:g.length,avg:+(g.reduce((a,b)=>a+b,0)/g.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+s[s.length-1].toFixed(2),over20:g.filter(x=>x>20).length,over34:g.filter(x=>x>34).length,firstFramesMs:g.slice(0,4).map(x=>+x.toFixed(1)),over34At:g.map((x,i)=>x>34?[i,+x.toFixed(1)]:null).filter(Boolean),at:'${what}',loaf:loaf.filter(e=>e.duration>50).map(e=>({start:Math.round(e.startTime-t0),dur:Math.round(e.duration),render:Math.round(e.renderStart-e.startTime),styleLayout:Math.round(e.styleAndLayoutStart-e.startTime),scripts:e.scripts.map(s=>[s.invoker,Math.round(s.duration),Math.round(s.forcedStyleAndLayoutDuration)])}))}))}}requestAnimationFrame(f)})`;
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
