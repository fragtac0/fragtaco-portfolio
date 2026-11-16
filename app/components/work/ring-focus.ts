// Keyboard focus and the dock (R56.4, spec 4 of the round 7 second look). Pure: no DOM, safe on the server.
//
// Video tiles pass under the dock's glass (the cut-out that hid them is gone). A tile that gets keyboard focus while it is more than half under
// the dock is brought clear: its ring is turned, eased in and out, until at most `CLEAR_AT` of the tile is under the dock, then left there
// (a focused ring is held still by work.css). A tile that is clear when it gets focus is not moved at all, so the ring never lurches.

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
/** Most the turn runs for, whatever happens (a tile that is never clear stops here). */
export const MAX_MS = 7000;

/** The share of `tile`'s area that is inside `dock`: 0 to 1, 0 for no dock or a tile of no size. */
export function underShare(tile: Box, dock: Box | null): number {
  if (!dock) return 0;
  const area = (tile.r - tile.l) * (tile.b - tile.t);
  if (!(area > 0)) return 0;
  const w = Math.min(tile.r, dock.r) - Math.max(tile.l, dock.l);
  const h = Math.min(tile.b, dock.b) - Math.max(tile.t, dock.t);
  return w > 0 && h > 0 ? (w * h) / area : 0;
}

/** True when more than half of the tile is under the dock: the focus must not rest there. */
export function needsClearing(tile: Box, dock: Box | null): boolean {
  return underShare(tile, dock) > MOST_UNDER;
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/**
 * How many times its own speed the ring turns, `ms` after the focus arrived with `share` of the tile under the dock: 1 (its own speed) at the
 * start and at `CLEAR_AT`, `PEAK_RATE` between, built up over `RAMP_MS` and eased off as the tile comes out (from 0.3 plus 0.4 of its area down
 * to 0.3), so the ring neither jumps nor stops dead.
 */
export function turnRate(ms: number, share: number): number {
  const up = smooth(ms / RAMP_MS);
  const out = smooth((share - CLEAR_AT) / 0.4);
  return 1 + (PEAK_RATE - 1) * up * out;
}

/** What a ring and its tile are, as far as the turn goes: where the tile is, where the dock is, and how to turn the ring by some time. */
export interface Turner {
  box(): Box;
  dock(): Box | null;
  /** Turn the ring (and its items' turn-back) on by `ms` of its own time. */
  advance(ms: number): void;
}

/** The browser's clock and frames, passed in so the loop can be run by a test. */
export interface Frames {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

/**
 * Brings the tile clear by turning its ring, frame by frame, if more than half of it is under the dock. Returns what stops it (called when focus
 * leaves, when the page goes away, or when the tab is hidden); it stops itself once the tile is clear or after `MAX_MS`. Nothing is turned when
 * the tile is already clear. `done` is called once, when it has stopped.
 */
export function clearFromDock(turner: Turner, frames: Frames, done?: () => void): () => void {
  if (!needsClearing(turner.box(), turner.dock())) return () => undefined;
  let id = 0;
  let stopped = false;
  let start = -1;
  let last = -1;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    frames.cancel(id);
    done?.();
  };
  const frame = (now: number) => {
    if (stopped) return;
    if (start < 0) {
      start = now;
      last = now;
    }
    const share = underShare(turner.box(), turner.dock());
    if (share <= CLEAR_AT || now - start > MAX_MS) return stop();
    const dt = Math.min(now - last, 50); // a long frame (a busy tab) never throws the ring on
    last = now;
    turner.advance(dt * turnRate(now - start, share));
    id = frames.request(frame);
  };
  id = frames.request(frame);
  return stop;
}

/**
 * The same, in one go, for a page that does not animate (reduced motion: the rings stand still, so there is nothing to ease): the ring is turned
 * on in steps of `stepMs` of its own time until the tile is clear, at most `maxSteps` steps. Returns the steps taken.
 */
export function clearAtOnce(turner: Turner, stepMs: number, maxSteps: number): number {
  let steps = 0;
  while (steps < maxSteps && underShare(turner.box(), turner.dock()) > CLEAR_AT) {
    turner.advance(stepMs);
    steps++;
  }
  return steps;
}
