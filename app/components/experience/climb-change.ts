// The change between the two states (spec 9.2): one number, k, eased over 3.6 s going in and 3.2 s coming out,
// carries the whole camera move. These are the numbers and the timing, with no DOM. Reduced motion has no camera
// travel: the same number then only drives a short crossfade (the engine keeps the picture flat and the night
// map in its My climb pose while it fades).
import { clamp, ease } from "./map-math";

export type Mode = "overview" | "climb";

/** How long the whole change takes, going in and coming out (milliseconds), and the crossfade of reduced motion. */
export const IN_MS = 3600;
export const OUT_MS = 3200;
export const FADE_MS = 700;

/** A change under way: k goes from `from` to `to` (0 overview, 1 My climb) from time `t0` for `ms`. */
export type Change = { from: number; to: number; t0: number; ms: number };

/** The k of a mode. */
export const kOf = (mode: Mode): number => (mode === "climb" ? 1 : 0);

/**
 * A change from where k is now to a mode, starting at `now`. A full change takes the full time; one that starts part
 * of the way (the visitor changed their mind mid-move) takes that share of it, so the speed stays the same.
 * Nothing to do (k already there) gives null.
 */
export function startChange(k: number, mode: Mode, now: number, reduced: boolean): Change | null {
  const to = kOf(mode);
  const share = Math.abs(to - k);

  if (share < 1e-6) return null;

  const full = reduced ? FADE_MS : mode === "climb" ? IN_MS : OUT_MS;

  return { from: k, to, t0: now, ms: full * share };
}

/** Where k is at `now`, and whether the change is over. The ease is the cubic in and out of the preview. */
export function changeAt(c: Change, now: number): { k: number; done: boolean } {
  const t = clamp((now - c.t0) / c.ms);

  return { k: c.from + (c.to - c.from) * ease(t), done: t >= 1 };
}
