// The page-side helpers of box-open.json (R55.2), installed on every new document by make-box-open.mjs: the recorder of the scene's frame on
// every animation frame (`__boStart`), the per-frame reader of a film (`__boA`), the verdict (`__boVerdict`) and the counter of the engines' draws.
export const HELPERS = `(() => {
  if (window.__boStart) return;
  const others = (sc) => {
    const out = [];
    for (const el of sc.querySelectorAll('*')) {
      if (el.tagName === 'CANVAS' || el.closest('.tex') || el.closest('.sr-only')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let o = 1; for (let n = el; n && n !== sc; n = n.parentElement) o *= +getComputedStyle(n).opacity;
      if (o < 0.02) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const bg = cs.backgroundColor && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor);
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (el.tagName === 'IMG' || cs.backgroundImage !== 'none' || bg || text) out.push(el.className || el.tagName);
    }
    return out;
  };
  window.__boStart = (kind, region) => {
    window.__boOff = Date.now() - (performance.timeOrigin + performance.now()); window.__bo = []; window.__an = []; window.__boState = {}; window.__boStop = false; window.__boClick = 0; window.__boRegion = region || null;
    const sc = document.querySelector('.box-scene[data-kind=' + kind + ']');
    let n = 0;
    const rec = () => {
      const t = performance.timeOrigin + performance.now();
      const r = sc.getBoundingClientRect(), head = document.querySelector('.xp-head'), hs = head && getComputedStyle(head);
      const chrome = hs ? (hs.visibility === 'hidden' ? 0 : +hs.opacity) : 0;
      const pts = [[.5,.5],[.3,.3],[.7,.3],[.3,.7],[.7,.7]].map(([a,b]) => [r.left + r.width*a, r.top + r.height*b]).filter(([x,y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      const top = pts.map(([x,y]) => { const e = document.elementsFromPoint(x,y)[0]; return !!e && sc.contains(e); });
      const row = { t, at: sc.dataset.at || 'box', l: r.left, tp: r.top, w: r.width, h: r.height, rad: parseFloat(getComputedStyle(sc).borderTopLeftRadius) || 0, chrome, topInScene: top.every(Boolean), canvases: sc.querySelectorAll('canvas').length, grid: (() => { const g = sc.querySelector('.fb-scene') || sc.querySelector('.fb-scroll'); if (!g) return null; const gs = getComputedStyle(g); return [+gs.opacity, g.getBoundingClientRect().width | 0, sc.hasAttribute('data-plain')]; })() };
      if (n++ % 6 === 0 && chrome === 0) row.others = others(sc);
      window.__bo.push(row);
      if (!window.__boStop) requestAnimationFrame(rec);
    };
    rec();
  };
  // run on every film frame (cdp.mjs film.analyze): the picture in the scene's frame (inner 70%), and the picture in the compared region against the last frame before the click
  window.__boA = async (b64, meta) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob());
    const k = bmp.width / innerWidth, c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(bmp, 0, 0);
    const ts = meta.ts - (window.__boOff || 0);
    let rec = null; for (const q of window.__bo) { if (q.t <= ts + 4) rec = q; else break; }
    const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2];
    const out = { i: meta.i, ts, at: rec ? rec.at : null, chrome: rec ? rec.chrome : null };
    if (rec) {
      const clip = (v, hi) => Math.max(0, Math.min(hi, v));
      const x0 = clip(Math.round((rec.l + rec.w * .15) * k), bmp.width - 2), y0 = clip(Math.round((rec.tp + rec.h * .15) * k), bmp.height - 2);
      const w = Math.max(2, clip(Math.round(rec.w * .7 * k), bmp.width - x0)), h = Math.max(2, clip(Math.round(rec.h * .7 * k), bmp.height - y0));
      const d = x.getImageData(x0, y0, w, h).data; let s = 0, q = 0, m = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { const l = luma(d, i); s += l; q += l * l; }
      const mean = s / m; out.std = +Math.sqrt(Math.max(0, q / m - mean * mean)).toFixed(2); out.mean = +mean.toFixed(1);
    }
    const R = window.__boRegion;
    if (R) {
      const rx = Math.max(0, Math.round(R.left * k)), ry = Math.max(0, Math.round(R.top * k)), rw = Math.min(bmp.width - rx, Math.round(R.width * k)), rh = Math.min(bmp.height - ry, Math.round(R.height * k));
      const cur = x.getImageData(rx, ry, rw, rh).data, st = window.__boState;
      // "before": the frames up to the first frame the recorder row of which is in the move (the click may be handled a few ms before it shows); "after": from that
      // frame on, for its first 100 ms (a film frame's time is the wall clock, the recorder's is performance.timeOrigin + performance.now(): the offset of the two, read when the recorder starts, is taken off and logged as clockOffsetMs)
      const mv = window.__bo.find((q) => q.at === 'move');
      if (!mv || ts < mv.t) st.before = cur;
      else if (st.before && ts - mv.t <= 100) {
        let diff = 0; for (let i = 0; i < cur.length; i += 4) if (Math.abs(cur[i] - st.before[i]) >= 48 || Math.abs(cur[i+1] - st.before[i+1]) >= 48 || Math.abs(cur[i+2] - st.before[i+2]) >= 48) diff++;
        out.diffPct = +(diff / (cur.length / 4) * 100).toFixed(3); out.afterMs = +(ts - mv.t).toFixed(1);
      }
    }
    window.__an.push(out);
    return 1;
  };
  window.__boVerdict = (kind, dir, vw, vh) => {
    const bo = window.__bo, an = window.__an, d = an.filter((a) => a.diffPct != null);
    const moving = bo.filter((r) => r.at === 'move');
    const steps = []; for (let i = 1; i < bo.length; i++) { const a = bo[i-1], b = bo[i]; if (a.at === 'move' && b.at === 'move') steps.push(Math.max(Math.abs(a.l-b.l), Math.abs(a.tp-b.tp), Math.abs(a.w-b.w), Math.abs(a.h-b.h))); }
    const beforeChrome = bo.filter((r) => r.chrome === 0 && r.at !== 'box');
    const chromeAt = bo.find((r) => r.chrome > 0);
    const share = (r) => dir === 'open' ? (r.w - bo[0].w) / Math.max(1, vw - bo[0].w) : (r.w - bo[bo.length - 1].w) / Math.max(1, vw - bo[bo.length - 1].w);
    const empty = an.filter((a) => a.std != null && a.at !== 'box' && a.std < 6);
    const gaps = []; for (let i = 1; i < bo.length; i++) gaps.push(bo[i].t - bo[i-1].t);
    return JSON.stringify({
      kind, dir, filmFrames: an.length, recorderFrames: bo.length, movingFrames: moving.length,
      diffAfterMovePct: d.map((a) => a.diffPct), diffMaxFirst100msPct: d.length ? Math.max(...d.map((a) => a.diffPct)) : null, diffFrames: d.length, diffFirstAfterMs: d[0] ? d[0].afterMs : null, clockOffsetMs: +(window.__boOff || 0).toFixed(1),
      emptyFrames: empty.length, emptyAfter50ms: empty.filter((a) => { const m0 = bo.find((q) => q.at === 'move'); return m0 && a.ts - m0.t > 50; }).length, emptyAtMsAfterMove: empty.map((a) => { const m0 = bo.find((q) => q.at === 'move'); return m0 ? +(a.ts - m0.t).toFixed(1) : null; }), minStd: an.length ? Math.min(...an.filter((a) => a.std != null).map((a) => a.std)) : null,
      onTopNotScene: bo.filter((r) => r.chrome === 0 && r.at !== 'box' && !r.topInScene).length,
      othersDrawnBeforeChrome: [...new Set(beforeChrome.flatMap((r) => r.others || []))],
      samplesOthers: beforeChrome.filter((r) => r.others).length,
      canvasesMax: Math.max(...bo.map((r) => r.canvases)),
      radiusStart: (dir === 'open' ? bo.find((r) => r.at === 'move') : bo.filter((r) => r.at === 'move').at(-1)) ?.rad, radiusAtOpen: bo.filter((r) => r.at === 'open' || r.at === 'box').at(-1)?.rad,
      chromeStartsAtShare: chromeAt ? +share(chromeAt).toFixed(3) : null, maxStepPx: steps.length ? +Math.max(...steps).toFixed(1) : null,
      maxRecorderGapMs: gaps.length ? +Math.max(...gaps).toFixed(1) : null,
    });
  };
  // a counter of the engines' draws, by engine: frames with at least one draw call (the calls of one frame come within a few ms)
  if (!window.__draws) {
    window.__draws = { wall: 0, shelf: 0 };
    window.__lastDraw = { wall: -100, shelf: -100 };
    for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = P && P.prototype[f]; if (!o) continue;
      P.prototype[f] = function (...a) {
        const c = this.canvas && this.canvas.className, k = typeof c === 'string' ? (/wall-canvas/.test(c) ? 'wall' : /shelf-canvas/.test(c) ? 'shelf' : null) : null;
        if (k) { const t = performance.now(); if (t - window.__lastDraw[k] > 6) window.__draws[k]++; window.__lastDraw[k] = t; }
        return o.apply(this, a);
      };
    }
  }
  })()`;
