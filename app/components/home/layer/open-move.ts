/**
 * The one move of opening and closing a home box (round 7 follow-ups, spec 6.2 and 6.3; numbers from the tenth preview's open.js).
 * The frame goes from the box to the whole window over `OPEN_MS`; the home page behind sinks and dims over the same move; the
 * open page's own heading and Close button fade in over its last 28%. Closing is the move backwards. A move is a position `t`
 * from 0 (the box) to 1 (the window) that changes at a constant speed (one whole way takes `OPEN_MS`) and is shown through the
 * site's ease, so turning a move round part way has no jump and takes only the way already gone. Pure: the layer's DOM work is
 * move-driver.ts.
 */

/** One whole way, box to window or back. */
export const OPEN_MS = 1000;
/** The chrome (heading, Close, count) starts to show at this share of the eased move and is whole at its end. */
export const CHROME_FROM = 0.72;
/** The home page behind: scaled to this and dimmed to this brightness at the end of the move. */
export const SINK = { scale: 0.95, dim: 0.45 } as const;
/** The box's corner radius in CSS pixels; the frame's corners go from it to square. */
export const BOX_RADIUS = 14;
/** Reduced motion: no growing frame; the open page fades in over this long (and out the same way). */
export const REDUCED_FADE_MS = 200;

/** A move: from where it starts (0 to 1) to 0 (the box) or 1 (the window), and when. */
export type Move = { from: number; to: 0 | 1; startedAt: number };

/** The site's ease, in and out (cubic); the input is clamped to 0 to 1. */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** How long a move takes: the distance it has to go, at the constant speed of one whole way per `OPEN_MS`. */
function lengthOf(m: Move, ms: number): number {
  return Math.abs(m.to - m.from) * ms;
}

/** Where the move is before the ease, 0 to 1. */
export function linearAt(now: number, m: Move, ms: number = OPEN_MS): number {
  const len = lengthOf(m, ms);
  if (len <= 0) return m.to;
  const k = Math.min(1, Math.max(0, (now - m.startedAt) / len));
  return m.from + (m.to - m.from) * k;
}

/** The eased progress at `now` (0 the box, 1 the window) and whether the move has reached its end. */
export function moveAt(now: number, m: Move, ms: number = OPEN_MS): { e: number; done: boolean } {
  const len = lengthOf(m, ms);
  return { e: ease(linearAt(now, m, ms)), done: len <= 0 || now - m.startedAt >= len };
}

/** The same move turned round from where it is: it starts at the value it was turned at and goes back the way it came. */
export function turn(now: number, m: Move, ms: number = OPEN_MS): Move {
  return { from: linearAt(now, m, ms), to: m.to === 1 ? 0 : 1, startedAt: now };
}

/**
 * The move for a new target: a fresh one when none is running (or the last one is over), the running one when it already goes
 * there, and the running one turned round when it goes the other way.
 */
export function retarget(now: number, m: Move | null, to: 0 | 1, ms: number = OPEN_MS): Move {
  if (m && !moveAt(now, m, ms).done) return m.to === to ? m : turn(now, m, ms);
  return { from: to === 1 ? 0 : 1, to, startedAt: now };
}

/** The chrome's opacity: 0 until `CHROME_FROM`, then up to 1 in a straight line. */
export function chromeAlpha(e: number): number {
  return Math.min(1, Math.max(0, (e - CHROME_FROM) / (1 - CHROME_FROM)));
}

/** The frame's corner radius at `e`. */
export function radiusAt(e: number): number {
  return BOX_RADIUS * (1 - e);
}

/** How far the home page behind has sunk at `e`: its scale, and the share of black laid over it (`1 - dim` at the end). */
export function sinkAt(e: number): { scale: number; shade: number } {
  return { scale: 1 - (1 - SINK.scale) * e, shade: (1 - SINK.dim) * e };
}

/**
 * A rect read from a page that is scaled by `scale` about (`ox`, `oy`) (in the same space as the rect), turned back into where
 * it is when the page is not sunk: where the box is now, whatever the page is doing.
 */
export function unsunkRect(
  r: { left: number; top: number; width: number; height: number },
  scale: number,
  ox: number,
  oy: number,
): { left: number; top: number; width: number; height: number } {
  if (scale === 1) return { left: r.left, top: r.top, width: r.width, height: r.height };
  return {
    left: ox + (r.left - ox) / scale,
    top: oy + (r.top - oy) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}
