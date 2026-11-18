/** Pure timing for the painting engine's reveal and sweep (paint-engine.ts). */

export const REDUCED_REVEAL_MS = 400;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * How long a reveal runs. A reveal of 0 ms means "at once" (the painting remembered from the last visit, or
 * the placeholder under a skipped loader) and stays at once under reduced motion too: only a reveal that is
 * meant to animate becomes the 400 ms fade. Anything else would start from black over the page's still frame.
 */
export function revealDuration(ms: number, reduced: boolean): number {
  if (ms <= 0) return 0;
  return reduced ? REDUCED_REVEAL_MS : ms;
}

/**
 * Progress 0..1 of a run that started at `t0` and takes `dur`, read at the frame time `now`. A run of no
 * length is already over: never 0 (the bare ground, the black frame on return, R49.1) and never NaN. The frame
 * time of a requestAnimationFrame can be earlier than a `performance.now()` read in the same frame, so
 * `now - t0` can be negative.
 */
export function runProgress(now: number, t0: number, dur: number): number {
  if (!(dur > 0)) return 1;
  return clamp((now - t0) / dur);
}
