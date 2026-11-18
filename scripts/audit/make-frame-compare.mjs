// Writes scripts/audit/frame-compare.json (R55.1, Task 24; the shelf's cases changed in R55.3j, Task 30): a scene drawn into a frame, on the production build.
// For each engine (the video wall, the reading shelf) at 1440 by 900 (dpr 1 and 2), with reduced motion so the picture holds still: the same
// frame's picture is drawn three ways and the first is compared with the third.
//   A: `setFrame(F)`: the canvas at F, drawn at F's size (the engine's own picture of the open page, scaled by max(F.w / W, F.h / H), centred);
//   B: `setFrame(null)`: the whole window, as before frames existed;
//   ref: B scaled by `gluedScale` and cut to F.
// A and ref differ in at most 2% of their pixels at dpr 2 (a pixel differs when a channel is 48 or more apart: the two are made by the GPU at
// two sizes and by a resample; at dpr 1 the 480 px picture's fine edges differ more, 0.4% to 6%, so the share is reported there, not gated;
// the threshold is 48 in any channel, and the share at 24 is reported beside it (`sharePct24`, never gated). For the shelf the ground and the dot field canvas (placed in the frame by the engine) are in both. The
// wall's picture includes its second pass (the edge blur, fringe and dark fade are part of the framed picture).
// Since Task 30 the shelf's frame is not the open page scaled to cover it: a box at rest shows the whole row on its ledge (box-framing.ts), so the shelf's
// A is compared with B moved to the framing the engine reports (the scale and place are read from both pictures' projected boxes: `projected()` gives the ledge's
// box in each; B carries no dots outside the window and A does, and the dots are too faint to reach the 48 threshold), and a second shelf case, `shelf-t1`, draws
// the frame of a move at its end (`setFrame(window, { move: { box, t: 1 } })`) and compares it with `setFrame(null)` directly: the open page's own picture (scale 1, nothing
// moved; 0.5%). The shelf's share bar at dpr 2 is 2.5% (the wall's stays 2%): the row is drawn at about a third of its size in a box, so its edges are a larger share of the pixels (1.7 to 2.0% measured; the difference sheets show outlines of spines and lettering only). Ruling RB11: 2.5% for the shelf's new comparison (the framed picture moved to the box framing, a resample at about a third of the scale; one frame measured 2.00%); RB1's 2% stays for the wall. The wall's cases are unchanged.
// Also read: `whenDrawn` resolves in the frame that draws the new frame (the picture is grabbed inside it), `setFrame` builds nothing
// (no program is created or compiled), the canvas stays the same element, a docked scene is out of the tab order, lets the pointer
// through and answers no key, a docked wall draws at most 30 times a second and a docked shelf draws nothing while still, and an
// undocked wall draws every frame. Docked and moving (setFrame on every frame for 2 s): the wall stays at its 30 draws a second, the shelf
// draws none and measures no header; the caller-placed frame (`place: false`) writes no position and switching it at the same size
// leaves the buffer and the picture alone; `setDocked(true, { maxDpr: 1 })` draws the buffer at one pixel per CSS pixel. Contact sheets (A, ref, difference) are saved as `local-r55-1-<engine>-<size>-<frame>.jpg`: they show
// thumbnails and covers, keep them under docs/redesign/compare/local/. Run: node scripts/audit/make-frame-compare.mjs
import { writeFileSync } from "node:fs";

const HELPER = `window.__fc = window.__fc || (() => {
  const win = () => [document.documentElement.clientWidth, document.documentElement.clientHeight];
  const layer = () => document.querySelector('.home-layer');
  const canvasOf = (kind) => document.querySelector(kind === 'wall' ? '.wall-host canvas' : '.shelf-host canvas');
  // the picture the frame shows, one canvas at device pixels: the ground, the dot field (shelf), the engine's canvas; call inside the draw's frame
  const composite = (kind, F) => {
    const d = devicePixelRatio, [vw, vh] = win(), f = F ?? { left: 0, top: 0, width: vw, height: vh };
    const out = document.createElement('canvas'); out.width = Math.round(f.width * d); out.height = Math.round(f.height * d);
    const x = out.getContext('2d'); x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim(); x.fillRect(0, 0, out.width, out.height);
    if (kind === 'shelf') { const dots = document.querySelector('.home-layer .dot-field'), r = dots.getBoundingClientRect(); x.drawImage(dots, (r.left - f.left) * d, (r.top - f.top) * d, r.width * d, r.height * d); }
    x.drawImage(canvasOf(kind), 0, 0, out.width, out.height);
    return out;
  };
  const refOf = (B, F, A) => {
    const d = devicePixelRatio, [vw, vh] = win(), s = Math.max(F.width / vw, F.height / vh), w = vw * s * d, h = vh * s * d;
    const r = document.createElement('canvas'); r.width = A.width; r.height = A.height;
    const x = r.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(B, (A.width - w) / 2, (A.height - h) / 2, w, h);
    return { r, s };
  };
  const diffOf = (A, R, tol) => {
    const a = A.getContext('2d').getImageData(0, 0, A.width, A.height).data, b = R.getContext('2d').getImageData(0, 0, A.width, A.height).data;
    const m = document.createElement('canvas'); m.width = A.width; m.height = A.height; const mx = m.getContext('2d'), im = mx.createImageData(A.width, A.height);
    let n = 0, sum = 0;
    for (let i = 0; i < a.length; i += 4) {
      const e = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); sum += e;
      const bad = e >= tol; if (bad) n++;
      im.data[i] = bad ? 255 : 0; im.data[i + 1] = bad ? 60 : e * 4 > 255 ? 255 : e * 4; im.data[i + 2] = 0; im.data[i + 3] = 255;
    }
    mx.putImageData(im, 0, 0);
    return { n, share: n / (a.length / 4), mean: sum / (a.length / 4), mask: m };
  };
  const sheet = (parts) => {
    document.getElementById('fc-sheet')?.remove();
    const k = Math.min(1, (innerWidth - 40) / parts.reduce((s, p) => s + p.width / devicePixelRatio + 12, 0)), o = document.createElement('div');
    o.id = 'fc-sheet'; o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#222;display:flex;gap:12px;align-items:center;justify-content:center';
    for (const p of parts) { const c = document.createElement('canvas'); c.width = p.width; c.height = p.height; c.getContext('2d').drawImage(p, 0, 0); c.style.cssText = 'width:' + (p.width / devicePixelRatio * k) + 'px;height:' + (p.height / devicePixelRatio * k) + 'px;outline:1px solid #888'; o.appendChild(c); }
    document.body.appendChild(o);
  };
  const settle = (eng) => Promise.race([eng.whenDrawn(), new Promise((r) => setTimeout(() => r('timeout'), 4000))]);
  // counts the engine's draws until stop() (the wall: a bind of the screen's framebuffer; the shelf: a clear), and reads of the layer header's box
  const counter = (kind) => {
    const proto = (kind === 'wall' ? WebGLRenderingContext : WebGL2RenderingContext).prototype, name = kind === 'wall' ? 'bindFramebuffer' : 'clear', o = proto[name];
    const rect = Element.prototype.getBoundingClientRect, c = { draws: 0, headReads: 0 };
    proto[name] = function () { if (kind !== 'wall' || arguments[1] === null) c.draws++; return o.apply(this, arguments); };
    Element.prototype.getBoundingClientRect = function () { if (this.classList && this.classList.contains('xp-head')) c.headReads++; return rect.apply(this, arguments); };
    return { stop: () => { proto[name] = o; Element.prototype.getBoundingClientRect = rect; return c; } };
  };
  const frames = (n, each) => new Promise((r) => { let i = 0; const go = () => { each(i); if (++i >= n) r(); else requestAnimationFrame(go); }; requestAnimationFrame(go); });
  const hooks = { programs: 0 };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { const o = C.prototype.createProgram; C.prototype.createProgram = function () { hooks.programs++; return o.apply(this, arguments); }; }
  return { win, composite, refOf, diffOf, sheet, settle, hooks, canvasOf, counter, frames };
})();`;

const FRAMES = [
  { name: "box-16-10", F: { left: 100, top: 400, width: 480, height: 300 } },
  { name: "wide", F: { left: 60, top: 500, width: 600, height: 200 } },
  { name: "tall", F: { left: 900, top: 120, width: 260, height: 520 } },
];

const compare = (kind, f) => `(async()=>{
  ${HELPER}
  const fc = window.__fc, eng = window.__ftEngines.${kind}, c0 = fc.canvasOf('${kind}'), p0 = fc.hooks.programs, F = ${JSON.stringify(f.F)};
  const t0 = performance.now(); eng.setFrame(F); const how = await fc.settle(eng); const dt = Math.round(performance.now() - t0);
  const A = fc.composite('${kind}', F);
  const placed = (() => { const r = c0.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })();
  eng.setFrame(null); const back = await fc.settle(eng);
  const B = fc.composite('${kind}', null);
  const { r: R, s } = fc.refOf(B, F, A), d = fc.diffOf(A, R, 48), d24 = fc.diffOf(A, R, 24);
  fc.sheet([A, R, d.mask]);
  return { kind: '${kind}', frame: '${f.name}', dpr: devicePixelRatio, scale: +s.toFixed(4), pixels: A.width * A.height, differing: d.n, sharePct: +(d.share * 100).toFixed(3), sharePct24: +(d24.share * 100).toFixed(3), meanAbs: +d.mean.toFixed(2),
    gatesShare: devicePixelRatio >= 2, ok: (devicePixelRatio < 2 || d.share <= 0.02) && how === 'drawn' && back === 'drawn', drawnInFrame: how, backInFrame: back, drawnAfterMs: dt, placedAt: placed, canvasPlaced: placed.join(',') === [F.left, F.top, F.width, F.height].join(','),
    sameCanvas: fc.canvasOf('${kind}') === c0, programsCreated: fc.hooks.programs - p0 };
})()`;

// the shelf's A against B carried to A's framing: the scale and the place are those of the ledge's projected box in the two pictures
const compareShelf = (f) => `(async()=>{
  ${HELPER}
  const fc = window.__fc, eng = window.__ftEngines.shelf, c0 = fc.canvasOf('shelf'), p0 = fc.hooks.programs, F = ${JSON.stringify(f.F)};
  const t0 = performance.now(); eng.setFrame(F); const how = await fc.settle(eng); const dt = Math.round(performance.now() - t0);
  const A = fc.composite('shelf', F), PA = eng.projected();
  const placed = (() => { const r = c0.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })();
  eng.setFrame(null); const back = await fc.settle(eng);
  const B = fc.composite('shelf', null), PB = eng.projected(), d0 = devicePixelRatio;
  const k = (PA.ledge.right - PA.ledge.left) / (PB.ledge.right - PB.ledge.left), ox = PA.ledge.left - PB.ledge.left * k, oy = PA.ledge.top - PB.ledge.top * k;
  const R = document.createElement('canvas'); R.width = A.width; R.height = A.height;
  const x = R.getContext('2d'); x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim(); x.fillRect(0, 0, R.width, R.height); x.imageSmoothingQuality = 'high';
  x.drawImage(B, ox * d0, oy * d0, B.width * k, B.height * k);
  const d = fc.diffOf(A, R, 48), d24 = fc.diffOf(A, R, 24);
  fc.sheet([A, R, d.mask]);
  const insideFrame = PA.books.every((b) => b.left >= -0.5 && b.right <= F.width + 0.5 && b.top >= -0.5 && b.bottom <= F.height + 0.5) && PA.ledge.bottom <= F.height + 0.5;
  return { kind: 'shelf', frame: '${f.name}', dpr: devicePixelRatio, scale: +k.toFixed(4), pixels: A.width * A.height, differing: d.n, sharePct: +(d.share * 100).toFixed(3), sharePct24: +(d24.share * 100).toFixed(3), meanAbs: +d.mean.toFixed(2),
    gatesShare: devicePixelRatio >= 2, ok: (devicePixelRatio < 2 || d.share <= 0.025) && how === 'drawn' && back === 'drawn' && insideFrame, everyBookAndLedgeInsideFrame: insideFrame, drawnInFrame: how, backInFrame: back, drawnAfterMs: dt, placedAt: placed, canvasPlaced: placed.join(',') === [F.left, F.top, F.width, F.height].join(','),
    sameCanvas: fc.canvasOf('shelf') === c0, programsCreated: fc.hooks.programs - p0 };
})()`;

// the shelf's frame at the end of a move (the window, t = 1): the open page's own picture, compared with setFrame(null) directly
const shelfAtOne = (f) => `(async()=>{
  ${HELPER}
  const fc = window.__fc, eng = window.__ftEngines.shelf, c0 = fc.canvasOf('shelf'), p0 = fc.hooks.programs, [vw, vh] = fc.win(), F = ${JSON.stringify(f.F)};
  const W = { left: 0, top: 0, width: vw, height: vh };
  eng.setFrame(W, { move: { box: { width: F.width, height: F.height }, t: 1 } }); const how = await fc.settle(eng);
  const A = fc.composite('shelf', W), PA = eng.projected();
  eng.setFrame(null); const back = await fc.settle(eng);
  const B = fc.composite('shelf', null), PB = eng.projected();
  const d = fc.diffOf(A, B, 48), d24 = fc.diffOf(A, B, 24);
  fc.sheet([A, B, d.mask]);
  const maxBox = Math.max(...PA.books.flatMap((b, i) => ['left', 'right', 'top', 'bottom'].map((k) => Math.abs(b[k] - PB.books[i][k]))), Math.abs(PA.ledge.right - PB.ledge.right), Math.abs(PA.ledge.top - PB.ledge.top));
  return { kind: 'shelf', frame: 't1-from-${f.name}', dpr: devicePixelRatio, pixels: A.width * A.height, differing: d.n, sharePct: +(d.share * 100).toFixed(3), sharePct24: +(d24.share * 100).toFixed(3), meanAbs: +d.mean.toFixed(2), maxProjectedBoxDiffPx: +maxBox.toFixed(3),
    ok: d.share <= 0.005 && maxBox <= 0.5 && how === 'drawn' && back === 'drawn', drawnInFrame: how, backInFrame: back, sameCanvas: fc.canvasOf('shelf') === c0, programsCreated: fc.hooks.programs - p0 };
})()`;

const docked = (kind) => `(async()=>{
  ${HELPER}
  const fc = window.__fc, eng = window.__ftEngines.${kind}, c = fc.canvasOf('${kind}');
  const countDraws = (ms) => new Promise((r) => {
    const proto = ${kind === "wall" ? "WebGLRenderingContext" : "WebGL2RenderingContext"}.prototype, name = ${kind === "wall" ? "'bindFramebuffer'" : "'clear'"}, o = proto[name]; let n = 0;
    proto[name] = function (a) { if (${kind === "wall" ? "arguments[1] === null" : "true"}) n++; return o.apply(this, arguments); };
    setTimeout(() => { proto[name] = o; r(n); }, ms);
  });
  const F = { left: 100, top: 400, width: 480, height: 300 };
  eng.setFrame(F); await fc.settle(eng);
  const undocked = await countDraws(2000);
  eng.setDocked(true);
  const keys = () => { for (const k of ['ArrowRight', 'ArrowDown', 'Enter']) window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
  keys(); await new Promise((r) => setTimeout(r, 300));
  const draws = await countDraws(2000);
  const out = { kind: '${kind}', undockedDrawsIn2s: undocked, dockedDrawsIn2s: draws, tabIndex: c.tabIndex, pointerEvents: getComputedStyle(c).pointerEvents, ariaHidden: c.getAttribute('aria-hidden'),
    focusOnCanvas: document.activeElement === c, kbd: c.dataset.kbd ?? null, bookOpen: !!c.dataset.openBox };
  eng.setDocked(false); eng.setFrame(null); await fc.settle(eng);
  out.afterTabIndex = c.tabIndex; out.afterPointerEvents = getComputedStyle(c).pointerEvents;
  out.ok = out.tabIndex === -1 && out.pointerEvents === 'none' && out.ariaHidden === 'true' && !out.focusOnCanvas && !out.kbd && !out.bookOpen && out.afterTabIndex === 0 &&
    ${kind === "wall" ? "out.dockedDrawsIn2s <= 62 && out.dockedDrawsIn2s >= 20 && out.undockedDrawsIn2s >= 90" : "out.dockedDrawsIn2s === 0"};
  return out;
})()`;

// a docked scene whose frame moves every frame for 2 s (the scene scrolls past while docked): the wall stays at its 30 draws a second, the shelf draws none
const dockedMove = (kind) => `(async()=>{
  ${HELPER}
  const fc = window.__fc, eng = window.__ftEngines.${kind}, c = fc.canvasOf('${kind}');
  const F = { left: 100, top: 400, width: 480, height: 300 };
  eng.setFrame(F); await fc.settle(eng); eng.setDocked(true); await new Promise((r) => setTimeout(r, 300));
  const k = fc.counter('${kind}');
  await new Promise((r) => { const t0 = performance.now(); const go = () => { const i = Math.round((performance.now() - t0) / 16); eng.setFrame({ ...F, left: 100 + (i % 200), top: 400 - (i % 50) }); if (performance.now() - t0 < 2000) requestAnimationFrame(go); else r(); }; go(); });
  const moved = k.stop();
  const out = { kind: '${kind}', movedDrawsIn2s: moved.draws, headReads: moved.headReads, left: c.style.left };
  // a frame that grows every frame (the opening move): the shelf does not measure the header again while the window is the same
  const k2 = fc.counter('${kind}');
  await fc.frames(40, (i) => eng.setFrame({ ...F, width: 480 + i * 6, height: 300 + i * 4 }));
  const grown = k2.stop();
  out.grownDraws = grown.draws; out.grownHeadReads = grown.headReads;
  eng.setDocked(false); eng.setFrame(null); await fc.settle(eng);
  out.ok = ${kind === "wall" ? "out.movedDrawsIn2s <= 62 && out.movedDrawsIn2s >= 20 && out.grownDraws >= 20" : "out.movedDrawsIn2s === 0 && out.headReads === 0 && out.grownHeadReads === 0"} && out.left !== '';
  return out;
})()`;

// the caller owns the canvas's place (place: false), and the docked pixel-ratio cap
const placeCase = (kind) => `(async()=>{
  ${HELPER}
  const fc = window.__fc, eng = window.__ftEngines.${kind}, c = fc.canvasOf('${kind}');
  const F = { left: 100, top: 400, width: 480, height: 300 }, dims = () => [c.width, c.height].join('x');
  eng.setDocked(true);
  eng.setFrame(F, { place: false }); const a = await fc.settle(eng);
  const unplaced = { drawn: a, position: c.style.position, left: c.style.left, top: c.style.top, dims: dims() };
  const k = fc.counter('${kind}');
  eng.setFrame({ ...F, left: 700, top: 20 }, { place: false }); const moved = await fc.settle(eng);
  await new Promise((r) => setTimeout(r, 300));
  unplaced.afterMove = { drawn: moved, left: c.style.left, dims: dims() };
  // the open move starts: the window placement takes over at the same size
  eng.setFrame(F); const b = await fc.settle(eng); await new Promise((r) => setTimeout(r, 300));
  const r1 = c.getBoundingClientRect(), placed = { drawn: b, position: c.style.position, rect: [r1.left, r1.top, r1.width, r1.height].map(Math.round), dims: dims() };
  eng.setFrame(F, { place: false }); const d = await fc.settle(eng); await new Promise((r) => setTimeout(r, 300));
  const back = { drawn: d, position: c.style.position, left: c.style.left, dims: dims() };
  const switchDraws = k.stop().draws;
  // the docked pixel-ratio cap: the buffer is the frame at 1 device pixel per CSS pixel, and back to the screen's ratio
  eng.setDocked(true, { maxDpr: 1 }); await new Promise((r) => setTimeout(r, 400));
  const capped = dims();
  eng.setDocked(true); await new Promise((r) => setTimeout(r, 400));
  const uncapped = dims();
  eng.setDocked(false); eng.setFrame(null); await fc.settle(eng);
  const out = { kind: '${kind}', unplaced, placed, back, switchDraws, capped, uncapped };
  const ratio = Math.min(devicePixelRatio, ${kind === "wall" ? 2 : 1.75}), full = Math.round(F.width * ratio) + 'x' + Math.round(F.height * ratio);
  out.ok = unplaced.drawn === 'drawn' && unplaced.position === '' && unplaced.left === '' && unplaced.top === '' && unplaced.afterMove.left === '' && unplaced.afterMove.dims === unplaced.dims &&
    unplaced.afterMove.drawn === 'drawn' && placed.position === 'fixed' && placed.rect.join(',') === [F.left, F.top, F.width, F.height].join(',') && placed.dims === unplaced.dims && placed.drawn === 'drawn' &&
    back.position === '' && back.left === '' && back.dims === unplaced.dims && back.drawn === 'drawn' && unplaced.dims === full &&
    capped === F.width + 'x' + F.height && uncapped === full ${kind === "shelf" ? "&& switchDraws === 0" : ""};
  return out;
})()`;

const steps = [];
for (const kind of ["wall", "shelf"]) {
  const hash = kind === "wall" ? "#watching" : "#reading";
  for (const dpr of [1, 2]) {
    steps.push({ go: "about:blank", wait: 300 });
    steps.push({
      size: [1440, 900], dpr, mobile: false, reduce: true, cpu: 1,
      init: `try{sessionStorage.setItem('ft:debug-engines','1')}catch(e){}`,
      go: `{{BASE}}/${hash}`, wait: 6000,
      eval: `({engines:Object.keys(window.__ftEngines??{}),canvas:!!document.querySelector('.${kind === "wall" ? "wall" : "shelf"}-host canvas'),dpr:devicePixelRatio})`,
      label: `${kind}-${dpr}x-ready`,
    });
    for (const f of FRAMES) {
      steps.push({ eval: kind === "shelf" ? compareShelf(f) : compare(kind, f), label: `${kind}-${dpr}x-${f.name}`, wait: 400 });
      steps.push({ wait: 300, shot: `local-r55-1-${kind}-${dpr}x-${f.name}` });
      steps.push({ eval: `document.getElementById('fc-sheet')?.remove(), 0`, wait: 200 });
      if (kind === "shelf") {
        steps.push({ eval: shelfAtOne(f), label: `${kind}-${dpr}x-${f.name}-t1`, wait: 400 });
        steps.push({ wait: 300, shot: `local-r55-1-${kind}-${dpr}x-${f.name}-t1` });
        steps.push({ eval: `document.getElementById('fc-sheet')?.remove(), 0`, wait: 200 });
      }
    }
    if (dpr === 2) {
      steps.push({ eval: docked(kind), label: `${kind}-docked`, wait: 200 });
      steps.push({ eval: dockedMove(kind), label: `${kind}-docked-move`, wait: 200 });
      steps.push({ eval: placeCase(kind), label: `${kind}-place-false`, wait: 200 });
    }
  }
}
writeFileSync(new URL("./frame-compare.json", import.meta.url), JSON.stringify(steps, null, 1) + "\n");
console.log(`frame-compare.json: ${steps.length} steps`);
