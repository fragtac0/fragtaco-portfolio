// The Review Focus cases of the box-open audit that are not films of the plain move (R55.2, fix round 1), pushed into box-open-kit.mjs's `steps`:
//   focusCases()     RF1: a click before the scene is ready waits at most 400 ms, then opens to the plain grid with the same move, and the frame
//                    is never empty (a film, with a contact sheet); closing puts the box's own live scene back (a give-up lasts one opening, not
//                    the page's life); a late scene (a stall of 6 s) is not swapped in while the grid shows, and the next opening is live.
//   focusCasesLate() RF5: the tab really in the background for 60 s (a second tab in front of it, through the browser's own connection, so rAF,
//                    timers and visibilitychange behave as for a visitor), draws in the first 500 ms after it comes back, the context kept;
//                    I1: an open book and an open video are still open after a real background spell; M4: the wall's pan across the end of
//                    the move; reduced motion: a dip through dark, never a scene carried while the page is lit.
import { HELPERS } from "./box-open-helpers.mjs";
import { BOX, INIT, load, push, sizes, toBlock, wait } from "./box-open-kit.mjs";

const SCENE = (b) => `document.querySelector('.box-scene[data-kind=${b.kind}]')`;
let n = 0; // a page whose address differs from the last one only in its hash is not reloaded: each deep link gets its own query
const deep = (hash) => `{{BASE}}/?bo=${++n}${hash}`;

export function focusCases() {
  for (const [name, b] of Object.entries(BOX)) {
    // ---- a stalled scene (its preparation never finishes): the click waits 400 ms, then opens to the plain grid
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
    push({
      eval: `(()=>{document.getElementById('${b.id}').scrollIntoView({block:'center',behavior:'instant'});return 1})()`,
    });
    push({
      wait: 700,
      eval: `(()=>{const sc=${SCENE(b)};const r=sc.getBoundingClientRect();window.__boBox={left:r.left,top:r.top,width:r.width,height:r.height};return JSON.stringify({box:Object.values(window.__boBox).map(Math.round),drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain'),live:document.getElementById('${b.id}').hasAttribute('data-live')})})()`,
      label: `RF1 ${name}: stalled scene (its preparation never finishes): the box is live and not drawn yet`,
    });
    push({
      film: {
        ms: 3300,
        quality: 70,
        keep: `local-box-plain-${name}-open`,
        ats: [0, 380, 700, 800, 815, 830, 845, 860, 880, 960, 1040, 1120, 1300, 1500, 2000],
        analyze: "window.__boA",
        eval: `new Promise(r=>{window.__boStart('${b.kind}',window.__boBox);window.__rf1=[];const t0=performance.now();const blk=document.getElementById('${b.id}');
          const iv=setInterval(()=>{const sc=${SCENE(b)};window.__rf1.push([Math.round(performance.now()-t0),blk.hasAttribute('data-pressed'),!!document.querySelector('.home-layer'),sc.dataset.at||'box',sc.hasAttribute('data-plain'),!!document.querySelector('.home-layer .fb-grid,.home-layer .fb-scroll'),document.querySelectorAll('.home-layer canvas').length])},16);
          window.__rf1Stop=()=>clearInterval(iv);setTimeout(()=>{window.__boClick=performance.timeOrigin+performance.now();document.querySelector('[data-xp=${b.hit}]').click();r(1)},400)})`,
      },
      label: `RF1 ${name}: film of a click before the scene is ready (frames saved as local-box-plain-${name}-open-<ms>.jpg)`,
    });
    push({
      eval: `(async()=>{await ${wait(300)};window.__boStop=true;window.__rf1Stop();const v=JSON.parse(window.__boVerdict('${name}','open',innerWidth,innerHeight));
        const log=window.__rf1,opened=log.find(l=>l[2]),pressed=log.filter(l=>l[1]),last=log.at(-1),mv=window.__bo.filter(r=>r.at==='move');
        return JSON.stringify({clickNotIgnored:!!opened,pressedFromMs:pressed[0]?pressed[0][0]-400:null,pressedUntilMs:pressed.at(-1)?pressed.at(-1)[0]-400:null,openedAtMs:opened?opened[0]-400:null,movedPlain:!!opened&&opened[4],gridInLayer:last[5],canvasesInLayer:last[6],
          movingFrames:v.movingFrames,emptyFrames:v.emptyFrames,emptyAtMsAfterMove:v.emptyAtMsAfterMove,emptyAfter50ms:v.emptyAfter50ms,minStd:v.minStd,onTopNotScene:v.onTopNotScene,maxStepPx:v.maxStepPx,filmFrames:v.filmFrames,firstMoveRect:mv[0]&&[mv[0].l,mv[0].tp,mv[0].w,mv[0].h].map(Math.round),gridInFirstMoveRows:mv.slice(0,4).map(r=>r.grid),radiusStart:v.radiusStart,headClear:(()=>{const hd=document.querySelector('.home-layer .xp-head'),sc=document.querySelector('.home-layer .fb-scroll'),first=document.querySelector('.home-layer .fb-grid li');if(!hd||!first)return null;const hb=Math.round(hd.getBoundingClientRect().bottom),ft=Math.round(first.getBoundingClientRect().top);return {at:sc.closest('.box-scene')?.dataset.at||null,fbTop:sc.style.getPropertyValue('--fb-top'),scrollTop:sc.scrollTop,headBottom:hb,firstRowTop:ft,clearsHead:ft>=hb}})()})})()`,
      label: `RF1 ${name}: pressed from 0 to at most 400 ms, opened to the plain grid with the move (never ignored); the open plain grid clears the heading (I1, Task 20: headClear.clearsHead is true, the first row at or below the header's bottom); no frame of the move is empty after its first 50 ms (the grid is glued to the frame from its first frame; the first two film frames show the box's ground while the new layer rasters: the DOM has the grid at opacity 1 from the first row, see gridInFirstMoveRows)`,
    });
    push({
      eval: `(async()=>{document.querySelector('.xp-close').click();await ${wait(1500)};const sc=${SCENE(b)};const blk=document.getElementById('${b.id}');
        return JSON.stringify({closed:!document.querySelector('.home-layer'),sceneInBox:sc.parentElement.className==='blk-live',plainFlagGone:!sc.hasAttribute('data-plain'),blockLive:blk.hasAttribute('data-live'),miniPreviewHidden:!blk.querySelector('.blk-art'),sceneShown:getComputedStyle(blk.querySelector('.blk-live')).display!=='none',focusOnBlock:document.activeElement.dataset.xp==='${b.hit}',dotField:(()=>{const d=sc.querySelector('.dot-field');if(!d)return null;const x=d.getContext('2d').getImageData(0,0,Math.min(d.width,200),Math.min(d.height,200)).data;let a=0;for(let i=3;i<x.length;i+=4)a+=x[i];return {w:d.width,h:d.height,painted:a>0}})()})})()`,
      label: `RF1 ${name}: closing a give-up puts the box's own scene back (not the flat preview: only a failed scene or a lost context keeps that); the reading box's dot field, a new canvas element after the plain grid, is sized and painted (dotField {w,h,painted: true}; the wall has none: null)`,
    });

    // ---- a scene that is only late (a stall of 6 s): it is not swapped in while the grid shows, and once it is ready the box holds it again
    push({
      ...load(sizes[0], { wait: 1200 }),
      init: `${INIT};try{sessionStorage.setItem('ft:debug-stall','6000')}catch(e){};${HELPERS}`,
    });
    push({
      eval: `(()=>{document.getElementById('${b.id}').scrollIntoView({block:'center',behavior:'instant'});return 1})()`,
    });
    push({
      wait: 600,
      eval: `(async()=>{const log=[];const t0=performance.now();document.querySelector('[data-xp=${b.hit}]').click();
        const iv=setInterval(()=>{const sc=${SCENE(b)};log.push([Math.round(performance.now()-t0),!!document.querySelector('.home-layer'),document.querySelectorAll('.home-layer canvas').length,!!document.querySelector('.home-layer .fb-grid,.home-layer .fb-scroll'),sc.hasAttribute('data-drawn')])},100);
        await ${wait(11000)};clearInterval(iv);const opened=log.find(l=>l[1]);
        return JSON.stringify({openedAtMs:opened?opened[0]:null,gridAtEnd:log.at(-1)[3],canvasInLayerEver:log.some(l=>l[2]>0),drawnWhileOpen:log.some(l=>l[4]),layerReady:!!document.querySelector('.home-layer.ready')})})()`,
      label: `LATE ${name}: a late scene (stall 6 s): the click opens the plain grid, and for as long as this opening lasts no 3D scene is swapped in`,
    });
    push({
      eval: `(async()=>{document.querySelector('.xp-close').click();await ${wait(1500)};const t0=performance.now();const sc=${SCENE(b)};const blk=document.getElementById('${b.id}');
        await new Promise(r=>{const i=setInterval(()=>{if(sc.hasAttribute('data-drawn')||performance.now()-t0>25000){clearInterval(i);r(1)}},100)});
        const cv=sc.querySelector('canvas');const d0=window.__draws['${name}'];await ${wait(1000)};
        return JSON.stringify({closed:!document.querySelector('.home-layer'),drawnAfterMs:Math.round(performance.now()-t0)-1000,plainFlag:sc.hasAttribute('data-plain'),blockLive:blk.hasAttribute('data-live'),miniPreviewHidden:!blk.querySelector('.blk-art'),canvasInBox:!!cv&&sc.parentElement.className==='blk-live',draws1s:window.__draws['${name}']-d0})})()`,
      label: `LATE ${name}: after the close the scene gets ready and the box holds it again (a give-up lasts one opening); it draws`,
    });
    push({
      eval: `(async()=>{document.querySelector('[data-xp=${b.hit}]').click();await ${wait(1500)};const v={opensLive:document.querySelectorAll('.home-layer canvas').length>=1,noGrid:!document.querySelector('.home-layer .fb-grid,.home-layer .fb-scroll'),ready:!!document.querySelector('.home-layer.ready')};
        document.querySelector('.xp-close').click();await ${wait(1400)};v.closed=!document.querySelector('.home-layer');return JSON.stringify(v)})()`,
      label: `LATE ${name}: the next opening is the live scene (a canvas in the layer, no grid)`,
    });
  }
}

export function focusCasesLate() {
  // ---- Review Focus 5: a tab really in the background for 60 s
  for (const [name, b] of Object.entries(BOX)) {
    push(load(sizes[0]), toBlock(b, `RF5 ${name}: scroll to the box`));
    push({
      eval: `(async()=>{const sc=${SCENE(b)};const cv=sc.querySelector('.wall-canvas,.shelf-canvas');const gl=cv.getContext('webgl2')||cv.getContext('webgl');const d=()=>window.__draws['${name}'];
        window.__bg={log:[]};
        document.addEventListener('visibilitychange',()=>{const row={s:document.visibilityState,t:Math.round(performance.now()),draws:d(),lost:gl?gl.isContextLost():null};window.__bg.log.push(row);
          if(row.s==='visible'){setTimeout(()=>{window.__bg.at500={draws:d(),lost:gl.isContextLost()}},500);setTimeout(()=>{window.__bg.at1500={draws:d()}},1500)}});
        const a=d();await ${wait(1000)};return JSON.stringify({drawsPerSecondRunning:d()-a,visibility:document.visibilityState,drawn:sc.hasAttribute('data-drawn')})})()`,
      label: `RF5 ${name}: armed (the box draws; the tab is visible)`,
    });
    push({ background: 60000 });
    push({
      wait: 2200,
      eval: `(()=>{const bg=window.__bg,h=bg.log.find(r=>r.s==='hidden'),v=bg.log.find(r=>r.s==='visible'),sc=${SCENE(b)};
        return JSON.stringify({wentHidden:!!h,hiddenForMs:h&&v?v.t-h.t:null,drawsWhileHidden:h&&v?v.draws-h.draws:null,drawsInFirst500msBack:bg.at500?bg.at500.draws-v.draws:null,drawsNextSecond:bg.at1500&&bg.at500?bg.at1500.draws-bg.at500.draws:null,
          contextLostAtReturn:v?v.lost:null,contextLostAt500:bg.at500?bg.at500.lost:null,burst:bg.at500&&v?bg.at500.draws-v.draws>40:null,drawn:sc.hasAttribute('data-drawn'),plain:sc.hasAttribute('data-plain')})})()`,
      label: `RF5 ${name}: the tab was in the background for 60 s: no draws while hidden, none in a burst after, the context kept`,
    });
    push({
      eval: `(async()=>{const sc=${SCENE(b)};const blk=document.getElementById('${b.id}');const cv=sc.querySelector('.wall-canvas,.shelf-canvas');const gl=cv.getContext('webgl2')||cv.getContext('webgl');const ext=gl.getExtension('WEBGL_lose_context');ext.loseContext();await ${wait(900)};
        const v={plainSet:sc.hasAttribute('data-plain'),liveOff:!blk.hasAttribute('data-live'),miniPreviewShown:getComputedStyle(blk.querySelector('.blk-art')).visibility==='visible',sceneHidden:getComputedStyle(blk.querySelector('.blk-live')).display==='none'};
        document.querySelector('[data-xp=${b.hit}]').click();await ${wait(1400)};v.opensToGrid=!!document.querySelector('.home-layer .fb-grid,.home-layer .fb-scroll');v.noCanvasInLayer=document.querySelectorAll('.home-layer canvas').length===0;return JSON.stringify(v)})()`,
      label: `RF5 ${name}: a lost context puts the flat preview back in the box; a click opens the plain grid`,
    });
  }

  // ---- I1: what is open stays open across a real background spell (the open scene is not stopped and started again)
  const engines = `try{sessionStorage.setItem('ft:intro-seen','1');sessionStorage.setItem('ft:debug-engines','1')}catch(e){}`;
  const sizeOf = sizes[0];
  push({
    size: sizeOf.size,
    dpr: 1,
    mobile: false,
    touch: false,
    reduce: false,
    cpu: 1,
    init: `${engines};${HELPERS}`,
    go: deep("#reading"),
    wait: 5200,
  });
  push({ click: [720, 660] });
  push({
    wait: 1500,
    eval: `(()=>JSON.stringify({infoOn:document.querySelector('.book-info').classList.contains('on'),title:document.querySelector('.book-info h3').textContent.length,hasOpen:window.__ftEngines.shelf.hasOpen(),layerReady:!!document.querySelector('.home-layer.ready')}))()`,
    label: "I1 shelf: a book is opened in the open layer",
  });
  push({ eval: `(()=>{window.__vis=[];document.addEventListener('visibilitychange',()=>window.__vis.push(document.visibilityState));return 1})()` });
  push({ background: 2500 });
  push({
    wait: 1500,
    eval: `(()=>JSON.stringify({visibilityLog:window.__vis,infoOn:document.querySelector('.book-info').classList.contains('on'),hasOpen:window.__ftEngines.shelf.hasOpen()}))()`,
    label: "I1 shelf: the tab was in the background for 2.5 s and is back: the book is still open",
  });
  push({
    size: sizeOf.size,
    dpr: 1,
    init: `${engines};${HELPERS}`,
    go: deep("#watching"),
    wait: 5200,
  });
  push({ move: [1300, 800] });
  push({ wait: 700, click: [1300, 800] });
  push({
    wait: 900,
    eval: `(()=>JSON.stringify({chosen:document.querySelector('.wall-host canvas').dataset.chosen||'',detailShown:getComputedStyle(document.querySelector('.vov')).display!=='none',layerReady:!!document.querySelector('.home-layer.ready')}))()`,
    label: "I1 wall: a video is opened in the open layer",
  });
  push({ eval: `(()=>{window.__vis=[];document.addEventListener('visibilitychange',()=>window.__vis.push(document.visibilityState));window.__chosen=document.querySelector('.wall-host canvas').dataset.chosen;return 1})()` });
  push({ background: 2500 });
  push({
    wait: 1500,
    eval: `(()=>JSON.stringify({visibilityLog:window.__vis,chosenBefore:window.__chosen,chosen:document.querySelector('.wall-host canvas').dataset.chosen||'',sameVideo:(document.querySelector('.wall-host canvas').dataset.chosen||'')===window.__chosen&&!!window.__chosen,detailShown:getComputedStyle(document.querySelector('.vov')).display!=='none'}))()`,
    label: "I1 wall: the tab was in the background for 2.5 s and is back: the video is still open",
  });

  // ---- M4: the wall's pan eases from the drift across the end of the move (the largest per-frame step of the wall's view)
  const wall = BOX.wall;
  push(load(sizes[0]), toBlock(wall, "M4 wall: scroll to the box"));
  push({
    eval: `(async()=>{const sc=${SCENE(wall)};const cv=sc.querySelector('.wall-canvas');cv.dataset.watchView='1';await ${wait(300)};
      const rows=[];const t0=performance.now();let opened=0;const f=()=>{const v=(cv.dataset.view||'').split(',').map(Number);rows.push([Math.round(performance.now()-t0),v[0],v[1],sc.dataset.at||'box']);if(performance.now()-t0<3600)requestAnimationFrame(f)};requestAnimationFrame(f);
      await ${wait(500)};document.querySelector('[data-xp=watching]').click();
      const i=setInterval(()=>{if(sc.dataset.at==='open'&&!opened){opened=performance.now()-t0;const r=cv.getBoundingClientRect();for(let k=0;k<6;k++)cv.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*0.5+k*4,clientY:r.top+r.height*0.5,pointerType:'mouse'}))}},16);
      await ${wait(3200)};clearInterval(i);
      let before=0,across=0,after=0;const big=[];for(let k=1;k<rows.length;k++){const a=rows[k-1],b=rows[k];if(isNaN(a[1])||isNaN(b[1]))continue;const s=Math.max(Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2]));const t=b[0];
        if(!opened||t<opened-300)before=Math.max(before,s);else if(t<=opened+700){across=Math.max(across,s);if(s>3)big.push([t,s])}else after=Math.max(after,s)}
      return JSON.stringify({openedAtMs:Math.round(opened),samples:rows.length,withView:rows.filter(r=>!isNaN(r[1])).length,maxStepBeforePx:before,maxStepAcrossEndPx:across,maxStepAfterPx:after,over3Across:big})})()`,
    label: "M4 wall: the pointer comes in at the end of the move: the view steps (largest per frame) from 300 ms before the end to 700 ms after",
  });

  // ---- reduced motion: a dip through dark (the black rises over the page with the scene in its box, then the open page fades in): never a scene carried while the page is lit
  for (const [name, b] of Object.entries(BOX)) {
    push(load(sizes[0], { reduce: true }), toBlock(b, `reduced ${name}: scroll to the box`));
    push({
      eval: `(async()=>{const sc=${SCENE(b)};const rows=[];const t0=performance.now();
        const run=(until)=>new Promise(r=>{const f=()=>{const sh=document.querySelector('.layer-shade');rows.push([Math.round(performance.now()-t0),sh?+getComputedStyle(sh).opacity:null,sc.dataset.at||'box',+getComputedStyle(sc).opacity,!!document.querySelector('.home-layer')]);performance.now()-t0>until?r():requestAnimationFrame(f)};f()});
        document.querySelector('[data-xp=${b.hit}]').click();await run(700);
        const open=rows.slice();const lit=(r)=>r[4]&&r[1]!==null&&r[1]<0.9;
        const o={openCarriedWhileLit:open.filter(r=>r[2]!=='box'&&lit(r)).length,openLitRows:open.filter(r=>r[2]!=='box'&&lit(r)).slice(0,3),openMaxShade:Math.max(...open.map(r=>r[1]??0)),openGrowingFrame:open.some(r=>r[2]==='move'),openEndAt:sc.dataset.at,openFirstRow:open[0],openTotalMs:(()=>{const a=open.find(r=>r[1]>0.02),z=open.find(r=>r[2]==='open'&&r[3]>=0.999);return a&&z?z[0]-a[0]:null})(),sceneOpacityWhenCarried:open.find(r=>r[2]==='open')?.[3]};
        rows.length=0;const t1=performance.now();document.querySelector('.xp-close').click();await run(t1-t0+700);
        o.closeCarriedWhileLit=rows.filter(r=>r[2]!=='box'&&lit(r)).length;o.closeLitRows=rows.filter(r=>r[2]!=='box'&&lit(r)).slice(0,3);o.closeGrowingFrame=rows.some(r=>r[2]==='move');o.closeBack=sc.parentElement.className==='blk-live';o.closed=!document.querySelector('.home-layer');
        o.closeTotalMs=(()=>{const a=rows.find(r=>r[1]<0.999||r[3]<0.999),z=rows.find(r=>r[2]==='box'&&!r[4]);return a&&z?z[0]-a[0]:null})();return JSON.stringify(o)})()`,
      label: `reduced ${name}: a dip through dark: the scene is never carried while the page is lit (no empty box beside a lit page), no growing frame, about 200 ms each way`,
    });
    // the same dip as frames: the click at 150 ms, then the Close at 150 ms (a contact sheet each way; the 0.01 ms transition the reduced-motion stylesheet gives everything lags a computed style by a frame, hence the 0.9)
    const ats = [0, 120, 160, 180, 200, 220, 240, 260, 280, 300, 340, 420];
    push({
      film: {
        ms: 900,
        quality: 70,
        keep: `local-box-reduced-${name}-open`,
        ats,
        eval: `new Promise(r=>{setTimeout(()=>{document.querySelector('[data-xp=${b.hit}]').click();r(1)},150)})`,
      },
      label: `reduced ${name}: film of the opening (a click at 150 ms; frames saved as local-box-reduced-${name}-open-<ms>.jpg)`,
    });
    push({
      film: {
        ms: 900,
        quality: 70,
        keep: `local-box-reduced-${name}-close`,
        ats,
        eval: `new Promise(r=>{setTimeout(()=>{document.querySelector('.xp-close').click();r(1)},150)})`,
      },
      label: `reduced ${name}: film of the closing (Close at 150 ms; frames saved as local-box-reduced-${name}-close-<ms>.jpg)`,
    });
  }
}
