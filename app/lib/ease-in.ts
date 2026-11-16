/**
 * Motion that belongs to a page at rest (the rings' turn, the wall's drift, the painting's slow zoom) starts from standstill and
 * reaches its speed over at least 800 ms (round 7 change-arrival spec 5.3), so nothing starts abruptly when a change ends.
 */

/** How long resting motion takes to reach its speed after a change: a little over the 800 ms the spec asks for. */
export const EASE_IN_MS = 1000;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The share of its speed that motion has `elapsedMs` after it began: 0 at the start, 1 from `ms` on, a smoothstep between (no jump in speed at either end). */
export function easeInRate(elapsedMs: number, ms: number = EASE_IN_MS): number {
  const t = clamp01(elapsedMs / ms);
  return t * t * (3 - 2 * t);
}

/**
 * How far motion that runs at `easeInRate` has got `elapsedMs` after it began, as the time it would have taken at full speed (an integral of
 * the rate): a drift whose phase follows this starts from standstill and has its own speed from `ms` on, with no jump in position or in speed.
 * (Scaling a drift's offset by the rate instead would slide the whole thing by the drift's radius while the rate climbs.)
 */
export function easeInTime(elapsedMs: number, ms: number = EASE_IN_MS): number {
  if (elapsedMs <= 0) return 0;
  const t = clamp01(elapsedMs / ms);
  return ms * (t * t * t - (t * t * t * t) / 2) + Math.max(0, elapsedMs - ms);
}
