// What make-arrival.mjs runs inside the page (R56, round 7 change-arrival spec 5.4): expressions for Runtime.evaluate, as strings. Nothing here
// touches the app's code: it reads the page the way a visitor's browser would (animations, boxes, computed styles, performance marks).

// the parts of a page that are in resting motion once a change is over: their pixels are compared coarsely, their DOM is not compared
export const RESTING = [".work-rings", ".wall-canvas-host", ".paint-host"];

export const INIT = `try{sessionStorage.setItem('ft:intro-seen','1')}catch(e){}
window.__ls=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__ls.push({t:Math.round(e.startTime),v:+e.value.toFixed(5),input:e.hadRecentInput,src:(e.sources||[]).map(s=>s.node&&(s.node.nodeName+'.'+String(s.node.className).slice(0,30))).slice(0,3)})}).observe({type:'layout-shift',buffered:true})}catch(e){}`;

/** Clicks the link and freezes the change at 99% of its time (every animation paused); answers with the click's moment and the hold's marks. */
export const FREEZE = (link, freezeAt) => `(async () => {
  const a = ${link};
  if (!a) return { err: 'no link' };
  const html = document.documentElement;
  const isChange = (x) => String(x.effect?.pseudoElement ?? '').startsWith('::view-transition');
  const clickAt = performance.now();
  performance.clearMarks('arrival-hold'); performance.clearMarks('arrival-go');
  a.click();
  return await new Promise((resolve) => {
    const loop = () => {
      const anims = document.getAnimations();
      const g = anims.find((x) => x.animationName === 'glass-p');
      if (g && typeof g.currentTime === 'number' && g.currentTime >= ${freezeAt}) {
        for (const x of anims) { if (isChange(x)) { try { x.pause(); } catch {} } } // the change's own animations only: the page's (the rings held by data-still, the ground) run as they would
        resolve(read(clickAt, true, g.currentTime));
        return;
      }
      if (performance.now() - clickAt > 9000) { resolve({ err: 'timeout', kind: html.dataset.changeKind || '', hold: 'changeHold' in html.dataset, path: location.pathname }); return; }
      requestAnimationFrame(loop);
    };
    function read(clickAt, ok, at) {
      const m = (n) => performance.getEntriesByName(n).at(-1)?.startTime ?? null;
      return { ok, at: Math.round(at), clickAt, holdAt: m('arrival-hold'), goAt: m('arrival-go'), late: html.dataset.arrivalLate ?? '', path: location.pathname };
    }
    requestAnimationFrame(loop);
  });
})()`;

/** The dock's box: the live dock's rectangle, and (while the change is frozen) the dock's view-transition group, from its computed style. */
export const DOCK_BOX = `(() => {
  const g = document.querySelector('[data-dock-glass]');
  const r = g?.getBoundingClientRect();
  const live = r ? { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } : null;
  let group = null;
  try {
    const cs = getComputedStyle(document.documentElement, '::view-transition-group(site-dock)');
    if (cs.width && cs.width !== 'auto' && cs.width !== '') {
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? undefined : cs.transform);
      group = { x: +m.e.toFixed(1), y: +m.f.toFixed(1), w: +parseFloat(cs.width).toFixed(1), h: +parseFloat(cs.height).toFixed(1) };
    }
  } catch {}
  return { live, group, kind: document.documentElement.dataset.changeKind || '' };
})()`;

/** Ends the change (every animation finished), records the ring items' places for the frames after it, and answers when it was over. */
export const END = `(async () => {
  const html = document.documentElement;
  const raf = window.requestAnimationFrame.bind(window); // the audit's own loops use this one: the page's are stalled below
  window.__rest = { frames: [] };
  const items = () => [...document.querySelectorAll('.work-ring-group li.work-item')].map((li) => { const r = li.getBoundingClientRect(); return [r.x, r.y]; });
  let overAt = null, run = true;
  const tick = (now) => {
    if (overAt === null && !html.dataset.changeKind) overAt = now;
    window.__rest.frames.push({ t: now, over: overAt !== null, items: items() });
    if (run && window.__rest.frames.length < 60) raf(tick);
  };
  const t0 = performance.now();
  const beforeItems = items();
  for (const x of document.getAnimations()) { if (String(x.effect?.pseudoElement ?? '').startsWith('::view-transition')) { try { x.finish(); } catch {} } }
  let n = 0;
  while (html.dataset.changeKind && n++ < 120) await new Promise((r) => raf(r));
  window.__endAt = performance.now();
  raf(tick);
  for (let i = 0; i < 4; i++) await new Promise((r) => raf(r)); // the first frames after the end are sampled (the ring items' places) before anything is stopped
  // the photograph of the end (E) takes a few hundred ms at 2x: stop the page where it is (its own animations paused, its animation-frame loops queued) so E is the page as it was in the
  // first frames, and start them again for L
  for (const x of document.getAnimations()) { try { x.pause(); } catch {} }
  window.__queued = []; window.__rafWas = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb) => { window.__queued.push(cb); return 0; };
  const afterItems = items();
  let moved = 0; for (let i = 0; i < Math.min(beforeItems.length, afterItems.length); i++) moved = Math.max(moved, Math.hypot(beforeItems[i][0] - afterItems[i][0], beforeItems[i][1] - afterItems[i][1]));
  return { kind: html.dataset.changeKind || 'none', overMs: Math.round(window.__endAt - t0), ringItemsMovedFreezeToEndPx: +moved.toFixed(2), items: beforeItems.length };
})()`;

export const RING_ANIM = `(() => { const a = document.getAnimations().filter((x) => ['work-spin', 'work-unspin'].includes(x.animationName)); return { n: a.length, t: a.slice(0, 3).map((x) => [x.animationName, Math.round(x.currentTime ?? -1), x.playState, +x.playbackRate.toFixed(3)]) }; })()`;
export const PLAY = `(() => { for (const x of document.getAnimations()) { try { x.play(); } catch {} } window.requestAnimationFrame = window.__rafWas; for (const cb of window.__queued.splice(0)) window.requestAnimationFrame(cb); return 1; })()`;

export const REST_RESULT = `(() => {
  const f = (window.__rest?.frames ?? []).filter((x) => x.over);
  const step = (a, b) => { let m = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1])); return +m.toFixed(2); };
  const first3 = []; for (let i = 1; i < Math.min(f.length, 4); i++) first3.push(step(f[i - 1].items, f[i].items));
  return { frames: f.length, items: f[0]?.items.length ?? 0, firstFrameSteps: first3, maxFirstFramePx: first3.length ? Math.max(...first3) : null, driftOver700msPx: f.length > 2 ? step(f[0].items, f.at(-1).items) : null };
})()`;

/** Every element of the page outside the rings and the canvases, with the box, the opacity and (pictures) the source: compared between E and L. */
export const SNAP = `(() => {
  const out = {};
  // R56.6: My experience's words and beads come in on a clock after the reveal begins (round 7 second look spec 8), so they are left out here as in the pixels (ENTRANCE_BOXES)
  const skip = (el) => el.closest('.work-rings, .paint-host, canvas, svg, [data-glass-warm], script, style, noscript, head, .map-heading, .map-caption, .map-pins');
  const path = (el) => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) p.push(e.tagName[0] + [...e.parentElement.children].indexOf(e)); return p.reverse().join('/'); };
  for (const el of document.body.querySelectorAll('*')) {
    if (skip(el)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    out[path(el)] = { n: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0].slice(0, 28) : ''), x: r.x, y: r.y, w: r.width, h: r.height,
      op: +cs.opacity, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0, src: el.tagName === 'IMG' ? el.currentSrc || el.src : undefined };
  }
  // each ring picture: its source, whether it is marked in (cover-image.ts) and its opacity, and whether the window shows it: a cover that comes in or fades between E and L is a change in the page
  const items = [...document.querySelectorAll('.work-rings img')].map((i) => { const r = i.getBoundingClientRect(); return { src: i.currentSrc || i.src, ready: i.hasAttribute('data-ready'), op: +getComputedStyle(i).opacity, vis: r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight }; });
  const wall = [...document.querySelectorAll('.wall-tile img')].map((i) => (i.currentSrc || i.src) + (i.hasAttribute('data-ready') ? '' : ' (not in)'));
  return { els: out, ringPictures: items, wallPictures: wall, drawn: !!document.querySelector('.wall-stage[data-drawn]') };
})()`;

export const MASK_BOXES = `(() => { const out = []; for (const sel of ${JSON.stringify(RESTING)}) for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push({ sel, x: r.x, y: r.y, w: r.width, h: r.height }); } return out; })()`;

/**
 * R56.6 (round 7 second look spec 8, the one exception to "nothing appears after the reveal"): on My experience the words, the trail and the milestones come in
 * on a clock (the words from 0.7 of the reveal, the trail when it ends), so the arrival check leaves them out of its comparison: the boxes of the heading and of the
 * mountain's block, and one box round the trail, its beads, the way ahead to the summit and the radar (the beads' envelope and the summit, 24 px out). Everything
 * else on that page (the picture, the chart's frame, the grid, the dock and the switch) is compared as before.
 */
export const ENTRANCE_BOXES = `(() => {
  const out = [];
  const add = (sel, r) => { if (r.width > 0 && r.height > 0) out.push({ sel, x: r.x, y: r.y, w: r.width, h: r.height }); };
  for (const sel of ['.map-heading', '.map-caption']) for (const el of document.querySelectorAll(sel)) add(sel, el.getBoundingClientRect());
  const beads = [...document.querySelectorAll('.map-pin .map-bead')].map((b) => b.getBoundingClientRect());
  const plane = document.querySelector('.map-plane');
  if (beads.length && plane) {
    const m = new DOMMatrixReadOnly(getComputedStyle(plane).transform === 'none' ? undefined : getComputedStyle(plane).transform);
    const summit = m.transformPoint(new DOMPoint(500, 325));
    const pad = 24;
    const l = Math.min(summit.x, ...beads.map((r) => r.left)) - pad, t = Math.min(summit.y, ...beads.map((r) => r.top)) - pad;
    const r = Math.max(summit.x, ...beads.map((q) => q.right)) + pad, b = Math.max(summit.y, ...beads.map((q) => q.bottom)) + pad;
    out.push({ sel: '.map-trail (the trail, the beads, the way ahead, the radar)', x: l, y: t, w: r - l, h: b - t });
  }
  return out;
})()`;
