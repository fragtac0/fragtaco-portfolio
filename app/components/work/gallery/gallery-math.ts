/**
 * The pure geometry of the video wall's gallery (round 7 spec 7): the largest grid that keeps every
 * tile on screen, which tile is under a point, the slow drift, the nudge that settles back, and the
 * picture atlas layout. No DOM, no three.js: everything here has a vitest test.
 *
 * Coordinates are CSS pixels on the canvas, origin top left. There is no warp (round 6 had a barrel
 * distortion, ported from the ObsidianUI Art Gallery, MIT, see vendor/obsidianui/LICENSE; round 7
 * removed it): what the grid says is what is drawn and what the pointer hits, drift and nudge aside.
 */

export type Safe = { top: number; bottom: number; side: number };
export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type Grid = {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  originX: number;
  originY: number;
  /** How far the last row is moved right to centre it when it has fewer tiles than `cols`. */
  lastRowOffset: number;
  /** Extra to the brief's shape: tileAt and tileRect need them, so they travel with the grid. */
  gap: number;
  count: number;
};

/** The even gap between tiles (round 7 spec 7: small). */
export const GAP_PX = 8;
export const RADIUS_PX = 8;
export const HOVER_GROW = 0.04;
export const DRIFT_PERIOD_S = 50;
export const DRIFT_RADIUS_PX = 6;
export const NUDGE_MAX_PX = 28;
/** The grid is not pulled back until the last nudge is this old (ms), so a held drag stays put. */
export const NUDGE_HOLD_MS = 140;
const NUDGE_TAU_S = 0.45;
const MARGIN = 0.04;

/** The safe area of spec 6.5: a 4% margin, plus the heading's band above and the dock's band below (CSS px). */
export function safeInsets(vw: number, vh: number, topBand = 0, bottomBand = 0): Safe {
  return { top: MARGIN * vh + topBand, bottom: MARGIN * vh + bottomBand, side: MARGIN * vw };
}

export type GridFit = { cols: number; rows: number; tileW: number; tileH: number };

/**
 * The columns and rows that give the largest tile (of the given aspect, width over height) with every tile
 * inside the safe area and `gap` px between neighbours. Ties (the same tile size) go to the choice with fewer
 * empty slots, then the squarer grid (the first found, fewest columns). Never NaN: a safe area with no room gives
 * a tiny positive tile.
 */
export function largestGrid(
  count: number,
  vw: number,
  vh: number,
  tileAspect: number,
  gap: number,
  safe: Safe,
): GridFit {
  const n = Math.max(1, Math.floor(count));
  const aw = Math.max(1, vw - 2 * safe.side);
  const ah = Math.max(1, vh - safe.top - safe.bottom);
  let best = { cols: 1, rows: n, w: 0, empty: Infinity };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.max(
      1e-3,
      Math.min((aw - (cols - 1) * gap) / cols, ((ah - (rows - 1) * gap) / rows) * tileAspect),
    );
    const empty = cols * rows - n;
    if (w > best.w + 1e-9 || (Math.abs(w - best.w) <= 1e-9 && empty < best.empty)) {
      best = { cols, rows, w, empty };
    }
  }
  return { cols: best.cols, rows: best.rows, tileW: best.w, tileH: best.w / tileAspect };
}

/** `largestGrid` placed: centred in the safe area, a short last row centred too. */
export function fitGrid(
  count: number,
  vw: number,
  vh: number,
  aspect: number,
  safe: Safe,
  gap = GAP_PX,
): Grid {
  const n = Math.max(1, Math.floor(count));
  const { cols, rows, tileW, tileH } = largestGrid(n, vw, vh, aspect, gap, safe);
  const aw = Math.max(1, vw - 2 * safe.side);
  const ah = Math.max(1, vh - safe.top - safe.bottom);
  const gridW = cols * tileW + (cols - 1) * gap;
  const gridH = rows * tileH + (rows - 1) * gap;
  const inLast = n - (rows - 1) * cols;
  return {
    cols,
    rows,
    tileW,
    tileH,
    originX: safe.side + (aw - gridW) / 2,
    originY: safe.top + (ah - gridH) / 2,
    lastRowOffset: inLast < cols ? ((cols - inLast) * (tileW + gap)) / 2 : 0,
    gap,
    count: n,
  };
}

/** Where tile `i` is (no drift). */
export function tileRect(g: Grid, i: number): Rect {
  const row = Math.floor(i / g.cols);
  const col = i % g.cols;
  return {
    x: g.originX + col * (g.tileW + g.gap) + (row === g.rows - 1 ? g.lastRowOffset : 0),
    y: g.originY + row * (g.tileH + g.gap),
    w: g.tileW,
    h: g.tileH,
  };
}

/**
 * The tile under a point, or null in a gap, a margin or an empty slot. `drift` is drift plus nudge.
 * `grown` is the hovered tile and how far it has grown (0.04 at full): its grown box, which covers part of
 * the gap, is tested first, so the visible fringe of a grown tile still hits it.
 */
export function tileAt(
  x: number,
  y: number,
  g: Grid,
  drift: Pt,
  grown?: { i: number; grow: number } | null,
): number | null {
  if (grown && grown.i >= 0 && grown.i < g.count && grown.grow > 0) {
    const r = tileRect(g, grown.i);
    const hw = (r.w * (1 + grown.grow)) / 2;
    const hh = (r.h * (1 + grown.grow)) / 2;
    if (Math.abs(x - drift.x - (r.x + r.w / 2)) <= hw && Math.abs(y - drift.y - (r.y + r.h / 2)) <= hh) {
      return grown.i;
    }
  }
  const ly = y - drift.y - g.originY;
  const pitchY = g.tileH + g.gap;
  const row = Math.floor(ly / pitchY);
  if (row < 0 || row >= g.rows || ly - row * pitchY > g.tileH) return null;
  const lx = x - drift.x - g.originX - (row === g.rows - 1 ? g.lastRowOffset : 0);
  const pitchX = g.tileW + g.gap;
  const col = Math.floor(lx / pitchX);
  if (col < 0 || col >= g.cols || lx - col * pitchX > g.tileW) return null;
  const i = row * g.cols + col;
  return i < g.count ? i : null;
}

/** The slow path of the whole grid: a closed loop (a 1 to 2 Lissajous), within 6 px, one lap in 50 s. */
export function driftAt(tSeconds: number): Pt {
  const a = (2 * Math.PI * tSeconds) / DRIFT_PERIOD_S;
  return { x: DRIFT_RADIUS_PX * Math.sin(a), y: DRIFT_RADIUS_PX * Math.sin(2 * a + Math.PI / 2) };
}

/** A soft limit: follows the pull for small ones and never passes `max`. */
export function rubberBand(p: Pt, max: number): Pt {
  const m = Math.hypot(p.x, p.y);
  if (m < 1e-9) return { x: 0, y: 0 };
  const s = (max * Math.tanh(m / max)) / m;
  return { x: p.x * s, y: p.y * s };
}

/** One step of the settle back after a nudge: exponential, snapping to zero under a tenth of a pixel. */
export function settleNudge(p: Pt, dt: number): Pt {
  const f = Math.exp(-dt / NUDGE_TAU_S);
  const x = p.x * f;
  const y = p.y * f;
  return Math.hypot(x, y) < 0.1 ? { x: 0, y: 0 } : { x, y };
}

/** Eases `v` toward `target` (rate per second, frame rate independent), snapping when within 0.002. */
export function approach(v: number, target: number, dt: number, rate: number): number {
  const n = target + (v - target) * Math.exp(-rate * dt);
  return Math.abs(n - target) < 0.002 ? target : n;
}

export type AtlasLayout = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
};

/**
 * The picture atlas: `count` cells of the tile aspect, the long side `longPx` (shrunk by a quarter at a
 * time until the atlas fits `maxSize`), in the cols by rows that make the squarest atlas (a tall strip
 * is slow to sample and hits limits first).
 */
export function atlasLayout(count: number, aspect: number, longPx: number, maxSize: number): AtlasLayout {
  const n = Math.max(1, Math.floor(count));
  let long = Math.max(16, Math.floor(longPx));
  for (;;) {
    const cellW = aspect >= 1 ? long : Math.max(1, Math.round(long * aspect));
    const cellH = aspect >= 1 ? Math.max(1, Math.round(long / aspect)) : long;
    let best: AtlasLayout | null = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const width = cols * cellW;
      const height = rows * cellH;
      if (width > maxSize || height > maxSize) continue;
      // the squarest atlas (smallest longer side), then the least texture
      const longer = Math.max(width, height);
      const bestLonger = best ? Math.max(best.width, best.height) : Infinity;
      if (longer < bestLonger || (longer === bestLonger && best && width * height < best.width * best.height)) {
        best = { cols, rows, cellW, cellH, width, height };
      }
    }
    if (best || long <= 16) return best ?? { cols: n, rows: 1, cellW, cellH, width: n * cellW, height: cellH };
    long = Math.max(16, Math.floor(long * 0.75));
  }
}

/** The part of a picture (sw by sh) that fills a dw by dh tile without stretching: object-fit cover, centred. */
export function coverRect(sw: number, sh: number, dw: number, dh: number) {
  const k = Math.max(dw / sw, dh / sh);
  const w = dw / k;
  const h = dh / k;
  return { sx: (sw - w) / 2, sy: (sh - h) / 2, sw: w, sh: h };
}
