// Pure maths for the /work rings. No DOM, safe on the server.

export type RingId = "stack" | "long" | "short";

export const RING = {
  stack: { radius: 0.21, period: 90, dir: 1, min: 44, max: 56, aspect: 1 },
  long: { radius: 0.34, period: 150, dir: -1, min: 96, max: 176, aspect: 16 / 9 },
  short: { radius: 0.5, period: 200, dir: 1, min: 54, max: 96, aspect: 9 / 16 },
} as const;

/** Each item takes its extent along the ring plus 30% for the gap. */
const GAP = 1.3;
/** Each further sub-ring of a split ring sits this much further out than the one inside it. */
export const SUB_RING_FACTOR = 1.14;
const PHONE_WIDTH = 700;
/** Clear space kept round the intro: the stack ring's inner edge is never closer to the middle than this. */
export const CENTRE_CLEAR = 64;
/** Clear space kept between one ring's outer edge and the next ring's inner edge. */
export const BAND_GAP = 8;
/** On a phone the stack and long rings stay this far inside the screen's sides. */
export const FIT_MARGIN = 12;
/** Phones draw items at no less than this fraction of their normal size. */
export const MIN_SCALE = 0.3;

const circumference = (r: number) => (Number.isFinite(r) && r > 0 ? 2 * Math.PI * r : 0);
const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
const factor = (s: number) => (Number.isFinite(s) && s > 0 ? s : 1);

/** Radius of a ring's sub-ring: 0 is the ring itself, 1 the second ring of a split ring. */
export function subRingRadius(radius: number, index: number): number {
  return radius * SUB_RING_FACTOR ** Math.max(0, whole(index));
}

/** The ring's nominal radius: its fraction of the shorter side (see `planRings` for where it is pushed out). */
export function ringRadius(id: RingId, vw: number, vh: number): number {
  return RING[id].radius * Math.min(vw, vh);
}

/** The item's longest side for a given width: the width for wide and square items, the height for tall ones. */
export function itemExtent(id: RingId, width: number): number {
  return width * Math.max(1, 1 / RING[id].aspect);
}

/** Items per ring at their minimum size. `scale` shrinks the sizes (phones). */
export function ringCapacity(id: RingId, radius: number, scale = 1): number {
  return Math.floor(circumference(radius) / (itemExtent(id, RING[id].min * factor(scale)) * GAP));
}

/**
 * Item width: the ring's circumference shared out by the items' extent along the ring (their longest
 * side, so tall covers never overlap where the ring runs vertical), kept between min and max.
 */
export function itemWidth(id: RingId, count: number, radius: number, scale = 1): number {
  const s = factor(scale);
  const min = RING[id].min * s;
  const max = RING[id].max * s;
  const n = whole(count);
  if (n === 0) return max;
  const share = circumference(radius) / (n * GAP * Math.max(1, 1 / RING[id].aspect));
  return Math.min(max, Math.max(min, share));
}

/**
 * Item counts for the ring itself and, if the items do not fit at minimum
 * size, a second ring at `subRingRadius(radius, 1)`. Whatever neither holds is `hidden`
 * (left out). No items gives no rings.
 */
export function splitRing(
  id: RingId,
  count: number,
  radius: number,
  scale = 1,
): { rings: number[]; hidden: number } {
  const n = whole(count);
  if (n === 0) return { rings: [], hidden: 0 };
  const inner = ringCapacity(id, radius, scale);
  if (n <= inner) return { rings: [n], hidden: 0 };
  const first = Math.min(n, inner);
  const outer = Math.min(n - first, ringCapacity(id, subRingRadius(radius, 1), scale));
  const rings = [first, outer].filter((c) => c > 0);
  return { rings, hidden: n - first - outer };
}

export interface RingPlan {
  id: RingId;
  /** Items on the ring and, if split, on its sub-ring. */
  counts: number[];
  /** Radius of the ring itself, after being pushed out where it would touch the ring inside it. */
  radius: number;
  /** Radius of the outermost sub-ring. */
  outer: number;
  width: number;
  height: number;
  /** The item's longest side. */
  extent: number;
}

const ORDER: readonly RingId[] = ["stack", "long", "short"];

/**
 * Where each ring goes, inside to outside, with items drawn at `scale`. A ring starts at its
 * nominal radius; it is pushed out just far enough that its band (radius less half an item, to
 * the outermost sub-ring plus half an item) keeps BAND_GAP clear of the band inside it, and the
 * stack ring keeps CENTRE_CLEAR round the intro. Rings with no items are left out.
 */
export function planRings(
  counts: Record<RingId, number>,
  vw: number,
  vh: number,
  scale = 1,
): RingPlan[] {
  const plans: RingPlan[] = [];
  let edge = CENTRE_CLEAR - BAND_GAP; // the free edge the next ring must clear (plus the gap)

  for (const id of ORDER) {
    const nominal = ringRadius(id, vw, vh);
    const { rings } = splitRing(id, counts[id], nominal, scale);
    if (rings.length === 0) continue;

    const width = itemWidth(id, rings[0], nominal, scale);
    const extent = itemExtent(id, width);
    const radius = Math.max(nominal, edge + BAND_GAP + extent / 2);
    const outer = rings.length > 1 ? subRingRadius(radius, 1) : radius;
    edge = outer + extent / 2;
    plans.push({ id, counts: rings, radius, outer, width, height: width / RING[id].aspect, extent });
  }
  return plans;
}

/**
 * How big items are drawn: 1 everywhere except a phone, where it is the largest scale (in steps of
 * 0.01) at which the stack and long-form rings, a long sub-ring and half an item included, sit fully
 * inside the screen's width with FIT_MARGIN to spare. The outer ring runs off the edges.
 */
export function fitScale(counts: Record<RingId, number>, vw: number, vh: number): number {
  if (!(vw > 0) || vw >= PHONE_WIDTH) return 1;
  const limit = vw / 2 - FIT_MARGIN;
  const floor = Math.round(MIN_SCALE * 100);
  for (let step = 100; step > floor; step--) {
    const scale = step / 100;
    const fits = planRings(counts, vw, vh, scale)
      .filter((p) => p.id === "stack" || p.id === "long")
      .every((p) => p.outer + p.extent / 2 <= limit);
    if (fits) return scale;
  }
  return MIN_SCALE;
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
