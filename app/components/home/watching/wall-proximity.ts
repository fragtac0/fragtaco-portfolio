/**
 * How a tile answers the pointer (spec 7, hover): no lift, no dimming of the others. A tile within
 * 220 px of the pointer grows by up to 4% and eases away from it by up to 4 px. `dx` and `dy` are
 * the tile's centre minus the pointer. Pure.
 */

/** Distance from the pointer beyond which a tile does not react, px. */
export const PROXIMITY_REACH = 220;
/** The biggest growth, as a factor, and the biggest push, px. */
export const PROXIMITY_SCALE = 1.04;
export const PROXIMITY_PUSH = 4;
/** The push ramps in over this distance, so a tile under the pointer's exact centre does not jitter. */
const PUSH_RAMP = 40;

export function proximity(dx: number, dy: number): { scale: number; pushX: number; pushY: number } {
  const d = Math.hypot(dx, dy);
  if (!Number.isFinite(d) || d >= PROXIMITY_REACH) return { scale: 1, pushX: 0, pushY: 0 };
  const t = 1 - d / PROXIMITY_REACH;
  const e = t * t * (3 - 2 * t);
  const mag = PROXIMITY_PUSH * e * Math.min(1, d / PUSH_RAMP);
  return {
    scale: 1 + (PROXIMITY_SCALE - 1) * e,
    pushX: d > 0 ? (dx / d) * mag : 0,
    pushY: d > 0 ? (dy / d) * mag : 0,
  };
}
