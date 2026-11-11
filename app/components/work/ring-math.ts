// Pure maths for the /work rings. No DOM, safe on the server.

export type RingId = "stack" | "long" | "short" | "clients";

export const RING = {
  stack: { radius: 0.21, period: 90, dir: 1, min: 44, max: 56, aspect: 1 },
  long: { radius: 0.34, period: 150, dir: -1, min: 96, max: 176, aspect: 16 / 9 },
  short: { radius: 0.5, period: 200, dir: 1, min: 54, max: 96, aspect: 9 / 16 },
  clients: { radius: 0.68, period: 260, dir: -1, min: 44, max: 72, aspect: 1 },
} as const;

/** Each item takes its width plus 30% for the gap. */
const GAP = 1.3;
/** Each further sub-ring of a split ring sits this much further out than the one inside it. */
export const SUB_RING_FACTOR = 1.14;
const PHONE_WIDTH = 700;
const PHONE_BOOST = 1.25;

const circumference = (r: number) => (Number.isFinite(r) && r > 0 ? 2 * Math.PI * r : 0);
const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Radius of a ring's sub-ring: 0 is the ring itself, 1 the second ring of a split ring. */
export function subRingRadius(radius: number, index: number): number {
  return radius * SUB_RING_FACTOR ** Math.max(0, whole(index));
}

export function ringRadius(id: RingId, vw: number, vh: number): number {
  const base = RING[id].radius * Math.min(vw, vh);
  return vw < PHONE_WIDTH ? base * PHONE_BOOST : base;
}

/** Items per ring at their minimum width. */
export function ringCapacity(id: RingId, radius: number): number {
  return Math.floor(circumference(radius) / (RING[id].min * GAP));
}

/** Item width: the ring's circumference shared out, kept between min and max. */
export function itemWidth(id: RingId, count: number, radius: number): number {
  const { min, max } = RING[id];
  const n = whole(count);
  if (n === 0) return max;
  return Math.min(max, Math.max(min, circumference(radius) / (n * GAP)));
}

/**
 * Item counts for the ring itself and, if the items do not fit at minimum
 * width, a second ring at `subRingRadius(radius, 1)`. Whatever neither holds is `hidden`
 * (shown only in the picked view). No items gives no rings.
 */
export function splitRing(
  id: RingId,
  count: number,
  radius: number,
): { rings: number[]; hidden: number } {
  const n = whole(count);
  if (n === 0) return { rings: [], hidden: 0 };
  const inner = ringCapacity(id, radius);
  if (n <= inner) return { rings: [n], hidden: 0 };
  const first = Math.min(n, inner);
  const outer = Math.min(n - first, ringCapacity(id, subRingRadius(radius, 1)));
  const rings = [first, outer].filter((c) => c > 0);
  return { rings, hidden: n - first - outer };
}

/** Degrees round the ring, slot 0 at the top, clockwise. */
export function slotAngle(index: number, count: number): number {
  if (!(count > 0)) return -90;
  return (index * 360) / count - 90;
}

/** Centre of a slot: 0 degrees is right, 90 is down (screen coordinates). */
export function slotPosition(
  angleDeg: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}
