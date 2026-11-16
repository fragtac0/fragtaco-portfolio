// Keyboard focus and the dock (R56.4, spec 4 of the round 7 second look). Pure: no DOM, safe on the server.
//
// Video tiles pass under the dock's glass (the cut-out that hid them is gone). A tile that gets keyboard focus while it is more than half under
// the dock is brought clear: its ring is turned, eased in and out, until at most `CLEAR_AT` of the tile is under the dock, then left there
// (a focused ring is held still by work.css). A tile that is clear when it gets focus, with its label clear too, is not moved at all, so the ring never lurches.
// The ring is turned the way that gets the tile out sooner when that is less than half the way on (a tile that has just entered the dock goes back
// the way it came); the label that opens beside a focused tile is part of the test, and the side it opens on follows the turn (focus-clear.ts).

/** A box on the screen, in pixels from its top left. */
export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** A tile is "more than half under the dock" when more than this share of its area is. */
export const MOST_UNDER = 0.5;
/** A tile that is being brought clear stops when no more than this share of it is under the dock (so it rests well inside the rule). */
export const CLEAR_AT = 0.3;
/** The ring turns this many times its own speed at most while it brings the tile clear (a ring's own turn is 150 s or more). */
export const PEAK_RATE = 28;
/** The speed builds over this long, and eases off over the last stretch of the tile's way out. */
export const RAMP_MS = 280;
/** Most the turn runs for, whatever happens (a tile that is never clear stops here): the sum of the frames' own (capped) times, not the wall clock. */
export const MAX_MS = 7000;
/** A frame longer than this counts as this long (a busy or hidden tab never throws the ring on, nor uses up the turn's time). */
export const MAX_FRAME_MS = 50;
/** The other way out is taken when it is no longer than this share of the ring's own way (the turn is then at most half as long). */
export const SHORTER_BY = 0.5;

const ZERO: Box = { l: 0, t: 0, r: 0, b: 0 };

/** The share of `tile`'s area that is inside `dock`: 0 to 1, 0 for no dock or a tile of no size. */
export function underShare(tile: Box, dock: Box | null): number {
  if (!dock) return 0;
  const area = (tile.r - tile.l) * (tile.b - tile.t);
  if (!(area > 0)) return 0;
  const w = Math.min(tile.r, dock.r) - Math.max(tile.l, dock.l);
  const h = Math.min(tile.b, dock.b) - Math.max(tile.t, dock.t);
  return w > 0 && h > 0 ? (w * h) / area : 0;
}

/**
 * True when the focus must not rest where the tile is: more than half of the tile is under the dock, or its label (a box beside the tile, drawn below
 * the dock's glass) is under the dock at all.
 */
export function needsClearing(tile: Box, dock: Box | null, label: Box | null = null): boolean {
  return underShare(tile, dock) > MOST_UNDER || underShare(label ?? ZERO, dock) > 0;
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/**
 * How much the tile and its label need to move, as the share of the tile that would be under the dock for the same push: the tile's own share, or,
 * while any of the label is under the dock, `CLEAR_AT` plus 0.4 of the way up as the share of the label goes from 0 to a quarter (so the ring eases
 * off as the label comes out, and is no more than `CLEAR_AT` only when the label is wholly clear).
 */
export function pressure(tile: Box, dock: Box | null, label: Box | null = null): number {
  const own = underShare(tile, dock);
  const lab = underShare(label ?? ZERO, dock);
  return lab > 0 ? Math.max(own, CLEAR_AT + 0.4 * Math.min(1, lab * 4)) : own;
}

/**
 * How many times its own speed the ring turns, `ms` after the focus arrived with `share` (a `pressure`) of the tile under the dock: 1 (its own speed) at the
 * start and at `CLEAR_AT`, `PEAK_RATE` between, built up over `RAMP_MS` and eased off as the tile comes out (from 0.3 plus 0.4 of its area down
 * to 0.3), so the ring neither jumps nor stops dead.
 */
export function turnRate(ms: number, share: number): number {
  const up = smooth(ms / RAMP_MS);
  const out = smooth((share - CLEAR_AT) / 0.4);
  return 1 + (PEAK_RATE - 1) * up * out;
}

/** What a ring and its tile are, as far as the turn goes: where the tile is, where its label is, where the dock is, and how to turn the ring by some time. */
export interface Turner {
  box(): Box;
  /** The box of the label that opens beside the tile (where it would be, shown or not), or null where there is none. */
  label?(): Box | null;
  dock(): Box | null;
  /** Turn the ring (and its items' turn-back) on by `ms` of its own time; a negative `ms` turns it back. */
  advance(ms: number): void;
}

/** The browser's clock and frames, passed in so the loop can be run by a test. */
export interface Frames {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

/** How a way out is tried: the ring is turned in steps of `stepMs` of its own time, at most `maxSteps` of them, each way, and put back. */
export interface Probe {
  stepMs: number;
  maxSteps: number;
}

/** The way chosen: `sign` is +1 (the ring's own way) or -1; `label` is whether the label's box counts (it does not where no turn can clear it). */
export interface Way {
  sign: 1 | -1;
  label: boolean;
}

const measure = (t: Turner, withLabel: boolean) => pressure(t.box(), t.dock(), withLabel ? (t.label?.() ?? null) : null);

/** The steps it takes to get clear by turning `sign` ways, or Infinity; the ring is put back where it was. */
function stepsOut(t: Turner, sign: 1 | -1, withLabel: boolean, probe: Probe): number {
  let n = 0;
  while (n < probe.maxSteps && measure(t, withLabel) > CLEAR_AT) {
    t.advance(sign * probe.stepMs);
    n++;
  }
  const clear = measure(t, withLabel) <= CLEAR_AT;
  if (n > 0) t.advance(-sign * n * probe.stepMs);
  return clear ? n : Number.POSITIVE_INFINITY;
}

/**
 * Which way to turn, or null when nothing needs to move (the tile is not more than half under the dock and its label is clear of it). The ring's own way,
 * unless the other way is out in at most `SHORTER_BY` of the steps. Where the label cannot be got clear either way, only the tile counts (and a tile
 * that is no more than half under the dock is then left alone). The ring is left as it was found.
 */
export function chooseWay(t: Turner, probe: Probe): Way | null {
  if (!needsClearing(t.box(), t.dock(), t.label?.() ?? null)) return null;
  for (const label of t.label ? [true, false] : [false]) {
    if (!label && underShare(t.box(), t.dock()) <= MOST_UNDER) return null;
    const fwd = stepsOut(t, 1, label, probe);
    const back = stepsOut(t, -1, label, probe);
    if (fwd === Number.POSITIVE_INFINITY && back === Number.POSITIVE_INFINITY) continue;
    return { sign: back <= fwd * SHORTER_BY ? -1 : 1, label };
  }
  return { sign: 1, label: false }; // nothing clears it: turn on, and give up at MAX_MS
}

/**
 * Brings the tile clear by turning its ring, frame by frame, if more than half of it (or any of its label) is under the dock. Returns what stops it (called
 * when focus leaves, when the page goes away, or when the tab is hidden); it stops itself once the tile is clear or after `MAX_MS` of frames. Nothing is
 * turned when the tile and its label are already clear. `done` is called once, when it has stopped.
 */
export function clearFromDock(turner: Turner, frames: Frames, done?: () => void, probe: Probe = { stepMs: 400, maxSteps: 400 }): () => void {
  const way = chooseWay(turner, probe);
  if (!way) return () => undefined;
  let id = 0;
  let stopped = false;
  let first = true;
  let last = 0;
  let elapsed = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    frames.cancel(id);
    done?.();
  };
  const frame = (now: number) => {
    if (stopped) return;
    const dt = first ? 0 : Math.min(now - last, MAX_FRAME_MS);
    first = false;
    last = now;
    elapsed += dt;
    const share = measure(turner, way.label);
    if (share <= CLEAR_AT || elapsed > MAX_MS) return stop();
    turner.advance(way.sign * dt * turnRate(elapsed, share));
    id = frames.request(frame);
  };
  id = frames.request(frame);
  return stop;
}

/**
 * The same, in one go, for a page that does not animate (reduced motion: the rings stand still, so there is nothing to ease): the ring is turned
 * on in steps of `stepMs` of its own time until the tile is clear, at most `maxSteps` steps, the shorter way. Returns the steps taken; 0 for a tile that
 * needs nothing.
 */
export function clearAtOnce(turner: Turner, stepMs: number, maxSteps: number): number {
  const way = chooseWay(turner, { stepMs, maxSteps });
  if (!way) return 0;
  let steps = 0;
  while (steps < maxSteps && measure(turner, way.label) > CLEAR_AT) {
    turner.advance(way.sign * stepMs);
    steps++;
  }
  return steps;
}
