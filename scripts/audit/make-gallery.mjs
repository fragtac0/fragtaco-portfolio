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
//  - R56.2c: the hook `window.__wallTrace` (an array the engine writes [ms, x, y] to every frame it draws): the first frame's offset from the fit is under 0.5 px and the
//    offset stays within 6 px on both axes, so the 8 px gap holds with the canvas drifted (`__driftCheck`),
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
import { GREY_404, init } from "./gallery-init.mjs";

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
  // R56.2c: the wall as drawn (the engine's own offset, every frame since its first): the first frame is where the plain links were, and the drift stays within its 6 px of the fit on both axes, so the 8 px gap holds with the canvas drifted
  steps.push({ eval: "__driftCheck()", label: `${tag}: the drawn wall starts at the fit and drifts within 6 px of it` });
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
  // R56 (reversing R75 after a page change): the wall is there when the reveal starts, as the plain links with every picture in; the engine is made after the change ends and draws whole tiles (no arrival, nothing blank); the arrival (R51.2) stays for a first load
  { size: [1440, 900], dpr: 1, mobile: false, touch: false, reduce: false, go: "{{BASE}}/work?arrrec", wait: 1800 },
  { eval: "window.__chg={began:null,end:null};new MutationObserver(()=>{const k=document.documentElement.dataset.changeKind;if(k&&window.__chg.began===null)window.__chg.began=performance.now();if(!k&&window.__chg.began!==null&&window.__chg.end===null)window.__chg.end=performance.now()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-change-kind']});document.querySelector('[data-work-tab=\"/work/long-form\"]').click();setTimeout(()=>{window.__chg.linksShown=[...document.querySelectorAll('.wall-tile')].filter(a=>+getComputedStyle(a).opacity>0.05).length;window.__chg.canvases=document.querySelectorAll('.wall-canvas').length;window.__chg.tilesInPage=document.querySelectorAll('.wall-tile').length},1500);1", label: "reveal: click Long form from the rings" },
  { eval: "new Promise(r=>{const t0=performance.now();const f=()=>{const c=document.querySelector('.wall-canvas');if(c&&c.dataset.arrived!==undefined&&window.__chg.end!==null){const a=window.__arr,abs=a.frames.map(x=>a.canvasAt+x[0]);r(JSON.stringify({changeMs:Math.round(window.__chg.end-window.__chg.began),at1500ms:{tilesInPage:window.__chg.tilesInPage,linksShown:window.__chg.linksShown,canvases:window.__chg.canvases},firstDrawAfterChangeEndMs:Math.round(a.canvasAt-window.__chg.end),drawsBeforeChangeEnd:abs.filter(t=>t<window.__chg.end).length,draws:a.frames.length,startMs:+c.dataset.startMs,startPictures:+c.dataset.startPictures,tilesWholeAtEnd:a.frames.at(-1)[1],ok:window.__chg.tilesInPage===window.__chg.linksShown&&window.__chg.canvases===0&&abs.filter(t=>t<window.__chg.end).length===0&&a.frames.at(-1)[1]===window.__chg.tilesInPage&&+c.dataset.startPictures===window.__chg.tilesInPage}))}else if(performance.now()-t0>15000)r('timeout');else setTimeout(f,50)};f()})", label: "reveal: the wall is the plain links, whole, while the change runs; the engine draws it whole after the change ends (no arrival)" },
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
