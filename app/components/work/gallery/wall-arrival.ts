/**
 * How a wall arrives (round 7 spec 7), pure: when the engine may draw its first frame, and where each tile is
 * in its arrival. Original work for this site.
 *
 * Nothing draws until the picture atlas has its first pictures, or has nothing more to wait for, or 1.2 s have
 * passed, whichever comes first (`canStart`). Then the tiles come in once, from the centre outward: each scales
 * from 0.86 to 1 and fades from 0 to 1 over 420 ms (an ease-out), 45 ms later per ring of distance from the
 * centre, the delay capped so the whole arrival is done within 900 ms. With reduced motion the tiles only fade,
 * all together, in a short 160 ms, with no scale.
 */

export const ARRIVAL = {
  /** One tile's own scale and fade. */
  tileMs: 420,
  /** Each ring of distance from the centre starts this much later than the one inside it. */
  ringMs: 45,
  /** Every tile is done by here, however many rings there are. */
  totalMs: 900,
  scaleFrom: 0.86,
  /** Reduced motion: a plain fade, no scale, no stagger. */
  reducedMs: 160,
} as const;

/** The longest the first draw waits for pictures. */
export const START_DEADLINE_MS = 1200;
/** Pictures in the atlas before the arrival begins (fewer if the wall has fewer tiles). */
export const FIRST_PICTURES = 6;

/** Where a tile is in its arrival: the factor on its size and its opacity, both 0 to 1 (scale from 0.86). */
export interface ArrivalPose {
  scale: number;
  alpha: number;
}

/**
 * The ring a tile is in: its distance from the middle of the grid, in tiles, counted from the nearest tile (so an
 * even grid, which has no middle tile, still starts at ring 0 with its middle four). `col` may be fractional: a short
 * last row is shifted to the middle.
 */
export function ringOf(col: number, row: number, cols: number, rows: number): number {
  const dc = col - (cols - 1) / 2;
  const dr = row - (rows - 1) / 2;
  const nearest = Math.hypot(cols % 2 === 0 ? 0.5 : 0, rows % 2 === 0 ? 0.5 : 0);
  return Math.max(0, Math.round(Math.hypot(dc, dr) - nearest));
}

/** When tile (`col`, `row`) starts its arrival, in ms from the first draw. Never later than `totalMs - tileMs`. */
export function arrivalDelay(col: number, row: number, cols: number, rows: number, reduced = false): number {
  if (reduced) return 0;
  return Math.min(ringOf(col, row, cols, rows) * ARRIVAL.ringMs, ARRIVAL.totalMs - ARRIVAL.tileMs);
}

/** How long the whole arrival takes: the last tile's delay plus its own time. */
export function arrivalEnd(cols: number, rows: number, reduced = false): number {
  if (reduced) return ARRIVAL.reducedMs;
  let last = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) last = Math.max(last, arrivalDelay(col, row, cols, rows));
  }
  return last + ARRIVAL.tileMs;
}

const easeOut = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);

/**
 * The pose of tile (`col`, `row`) in a grid of `cols` by `rows`, `t` ms after the first draw. Before its turn it is
 * not there (alpha 0); after its 420 ms it is whole (scale 1, alpha 1). With `reduced` it fades in over 160 ms at full
 * size. Always inside 0.86 to 1 for the scale and 0 to 1 for the alpha.
 */
export function arrival(col: number, row: number, cols: number, rows: number, t: number, reduced = false): ArrivalPose {
  if (reduced) return { scale: 1, alpha: Math.min(1, Math.max(0, t / ARRIVAL.reducedMs)) };
  const p = Math.min(1, Math.max(0, (t - arrivalDelay(col, row, cols, rows)) / ARRIVAL.tileMs));
  const e = easeOut(p);
  return { scale: ARRIVAL.scaleFrom + (1 - ARRIVAL.scaleFrom) * e, alpha: e };
}

/**
 * The tile indexes of a wall in the order they arrive (middle first, then outward; ties by index). The atlas loads
 * pictures in this order, so the first ones to come in are the first to be seen.
 */
export function arrivalOrder(cols: number, rows: number, count: number): number[] {
  const inLast = count - (rows - 1) * cols;
  const shift = inLast > 0 && inLast < cols ? (cols - inLast) / 2 : 0;
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = (i % cols) + (row === rows - 1 ? shift : 0);
    return { i, ring: ringOf(col, row, cols, rows) };
  })
    .sort((a, b) => a.ring - b.ring || a.i - b.i)
    .map((e) => e.i);
}

/** What the engine knows while it waits to draw. */
export interface StartFacts {
  /** Pictures uploaded to the atlas so far. */
  pictures: number;
  /** Tiles in the wall. */
  count: number;
  /** Every picture has either gone up or been given up on: there is nothing more to wait for. */
  settled: boolean;
  /** The local art under every tile is in the art texture. */
  artReady: boolean;
  /** ms since the engine was made. */
  elapsedMs: number;
}

/**
 * True when the first frame may be drawn: the 1.2 s deadline has passed, or the art is in and the atlas has its first
 * pictures (`FIRST_PICTURES`, or all of them for a small wall) or has nothing more to wait for (every picture failed,
 * or they are all in). A tile whose picture is not in yet shows its art, never an empty box.
 */
export function canStart(f: StartFacts): boolean {
  if (f.elapsedMs >= START_DEADLINE_MS) return true;
  if (!f.artReady) return false;
  return f.settled || f.pictures >= Math.min(FIRST_PICTURES, f.count);
}
