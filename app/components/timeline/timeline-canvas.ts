// The timeline's one 2D canvas: it owns the view (zoom and pan), the hover and focus cells, and the
// timing of every redraw. It redraws only when the view changes, the size changes, the hover or focus
// cell changes, or the pulse ticks (today's cell alone, at 30 fps, never under reduced motion), and
// every loop stops when the page is hidden. No React state is touched per frame: the page hears about
// the hover through `onHover`, and the current view is mirrored in `data-*` attributes on the canvas.
import type { SiteTimeline } from "../../types";
import { cellBox, drawFrame, drawRegion, makeGrain, type DrawState } from "./timeline-draw";
import { attachInput, type Controls } from "./timeline-input";
import { clampView, columnsFor, hitCell, zoomAt, type View } from "./timeline-math";
import { buildModel, type TimelineModel } from "./timeline-model";
import {
  easeOutCubic,
  EASE_MS,
  fitInsets,
  fitWithInsets,
  lerpView,
  MAX_SCALE,
  pulseAlpha,
  revealCell,
  sameView,
} from "./timeline-motion";

/** The day the tooltip is for and where its cell is on screen (CSS pixels from the canvas's top left). */
export interface HoverHit {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  source: "pointer" | "keyboard";
}

export interface TimelineOptions {
  reducedMotion: () => boolean;
  onHover: (hit: HoverHit | null) => void;
}

export interface Timeline {
  setView(view: View, animate: boolean): void;
  /** The view being drawn now (it lags the target while a zoom eases). */
  view(): View;
  fit(animate?: boolean): void;
  /** Call when the reduced-motion setting changes: redraws and restarts or stops the pulse. */
  refresh(): void;
  hit(px: number, py: number): number | null;
  zoomBy(factor: number, animate?: boolean): void;
  model(): TimelineModel;
  dispose(): void;
}

const PULSE_FRAME_MS = 33;

export function createTimeline(canvas: HTMLCanvasElement, data: SiteTimeline, today: string, opts: TimelineOptions): Timeline {
  const ctx = canvas.getContext("2d");
  const model = buildModel(data, today);
  if (!ctx) {
    return { setView() {}, view: () => ({ scale: 1, x: 0, y: 0 }), fit() {}, refresh() {}, hit: () => null, zoomBy() {}, model: () => model, dispose() {} };
  }

  let vw = 0;
  let vh = 0;
  let dpr = 1;
  let cols = columnsFor(1440);
  let rows = 1;
  let fitted = true;
  let fitV: View = { scale: 1, x: 0, y: 0 };
  let current: View = fitV;
  let target: View = fitV;
  let anim: { from: View; to: View; t0: number } | null = null;
  let hover: number | null = null;
  let focus: number | null = null;
  let pointer: { x: number; y: number } | null = null;
  let touchPick: number | null = null;
  let raf = 0;
  let pulseRaf = 0;
  let lastPulse = 0;
  let pulse = 1;
  let disposed = false;
  const grain = makeGrain(ctx);

  const state = (): DrawState => ({ model, view: current, vw, vh, cols, rows, hover, focus, pulse, grain });
  const reduced = () => opts.reducedMotion();
  const todayIndex = model.total - 1;

  const limit = (v: View): View => {
    const scale = Math.min(MAX_SCALE, Math.max(fitV.scale, v.scale));
    if (scale <= fitV.scale * 1.0001) return fitV;

    return clampView({ ...v, scale }, cols, rows, vw, vh);
  };

  const mirror = () => {
    const d = canvas.dataset;
    d.scale = current.scale.toFixed(3);
    d.x = current.x.toFixed(1);
    d.y = current.y.toFixed(1);
    d.settled = anim ? "false" : "true";
  };

  let lastTip = "";
  const tip = () => {
    const index = hover ?? focus;
    canvas.dataset.hover = hover === null ? "" : String(hover);
    canvas.dataset.focus = focus === null ? "" : String(focus);
    const box = index === null ? null : cellBox(state(), index);
    const s = current.scale;
    const x = index === null ? 0 : current.x + (index % cols) * s;
    const y = index === null ? 0 : current.y + Math.floor(index / cols) * s;
    const key = index === null || !box ? "" : `${index}|${x.toFixed(1)}|${y.toFixed(1)}|${s.toFixed(2)}|${hover === null}`;
    if (key === lastTip) return;
    lastTip = key;
    opts.onHover(index === null || !box ? null : { index, x, y, w: s, h: s, source: hover === null ? "keyboard" : "pointer" });
  };

  const pulseWanted = () =>
    !disposed && !reduced() && !document.hidden && model.total > 0 && !anim && cellBox(state(), todayIndex) !== null;

  const tickPulse = (now: number) => {
    pulseRaf = 0;
    if (!pulseWanted()) {
      if (pulse !== 1) {
        pulse = 1;
        draw();
      }
      return;
    }
    if (now - lastPulse >= PULSE_FRAME_MS) {
      lastPulse = now;
      pulse = pulseAlpha(now);
      if (!raf) drawRegion(ctx, state(), todayIndex);
    }
    pulseRaf = requestAnimationFrame(tickPulse);
  };

  const syncPulse = () => {
    if (pulseWanted() && !pulseRaf) pulseRaf = requestAnimationFrame(tickPulse);
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed) return;
    if (anim) {
      const t = (now - anim.t0) / EASE_MS;
      if (t >= 1) {
        current = anim.to;
        anim = null;
      } else {
        current = lerpView(anim.from, anim.to, easeOutCubic(t));
      }
    }
    pulse = reduced() || document.hidden ? 1 : pulseAlpha(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(ctx, state());
    mirror();
    if (anim) {
      raf = requestAnimationFrame(frame);
    } else {
      refreshHover();
      syncPulse();
    }
  };

  const draw = () => {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  };

  /** Re-reads the cell under a resting pointer (the picture may have moved under it). */
  const refreshHover = () => {
    const next = pointer ? hitCell(current, pointer.x, pointer.y, cols, model.total) : touchPick;
    if (next === hover) {
      tip();
      return;
    }
    hover = next;
    tip();
    draw();
  };

  const setView = (view: View, animate: boolean) => {
    const next = limit(view);
    fitted = sameView(next, fitV);
    target = next;
    if (animate && !reduced()) {
      anim = { from: current, to: next, t0: performance.now() };
    } else {
      anim = null;
      current = next;
    }
    if (hover !== null && !anim) hover = null;
    touchPick = null;
    draw();
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextCols = columnsFor(w);
    const regrid = nextCols !== cols;
    vw = w;
    vh = h;
    cols = nextCols;
    rows = Math.max(1, Math.ceil(model.total / cols));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    fitV = fitWithInsets(cols, rows, vw, vh, fitInsets(vw));
    canvas.dataset.cols = String(cols);
    canvas.dataset.rows = String(rows);
    if (fitted || regrid) {
      current = target = fitV;
      fitted = true;
      anim = null;
    } else {
      current = target = limit(target);
    }
    draw();
  };

  const baseCell = (): number => {
    const centre = hitCell(current, vw / 2, vh / 2, cols, model.total);

    return centre ?? Math.max(0, todayIndex);
  };

  const controls: Controls = {
    zoomAt: (factor, px, py, animate) => setView(zoomAt(animate ? target : current, factor, px, py, fitV.scale, MAX_SCALE), animate),
    panBy: (dx, dy, animate) => {
      const from = animate ? target : current;
      setView({ scale: from.scale, x: from.x + dx, y: from.y + dy }, animate);
    },
    fit: (animate) => setView(fitV, animate),
    pointerAt: (px, py) => {
      pointer = px === null || py === null ? null : { x: px, y: py };
      if (pointer) touchPick = null;
      refreshHover();
    },
    tapAt: (px, py) => {
      const index = hitCell(current, px, py, cols, model.total);
      pointer = null;
      touchPick = index === touchPick ? null : index;
      refreshHover();
    },
    focusCell: (next) => {
      if (model.total === 0) return;
      focus = next(focus ?? baseCell());
      pointer = null;
      hover = null;
      const shown = revealCell(target, focus, cols, vw, vh, 24);
      if (shown !== target) setView(shown, true);
      tip();
      draw();
    },
    clearFocus: () => {
      if (focus === null) return;
      focus = null;
      tip();
      draw();
    },
    size: () => ({ vw, vh, cols, total: model.total }),
    reduced,
  };

  const detach = attachInput(canvas, controls);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(pulseRaf);
      pulseRaf = 0;
    } else {
      draw();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  void document.fonts?.ready.then(draw);
  // the mono face may arrive after the first picture: draw again so the numbers and months use it
  document.fonts?.addEventListener("loadingdone", draw);
  canvas.dataset.total = String(model.total);
  canvas.dataset.todayIndex = String(todayIndex);
  resize();

  return {
    setView,
    view: () => current,
    fit: (animate = true) => setView(fitV, animate),
    refresh: draw,
    hit: (px, py) => hitCell(current, px, py, cols, model.total),
    zoomBy: (factor, animate = true) => controls.zoomAt(factor, vw / 2, vh / 2, animate && !reduced()),
    model: () => model,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pulseRaf);
      observer.disconnect();
      detach();
      document.removeEventListener("visibilitychange", onVisibility);
      document.fonts?.removeEventListener("loadingdone", draw);
    },
  };
}
