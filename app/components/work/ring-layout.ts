// Turns item counts and the screen size into the rings to draw. Pure: no DOM, safe on the server.
import { ringPlan, slotAngle, type PlannedRing, type RingKind, type RingOrderMode } from "./ring-math";

export interface RingSlot {
  /** Position in that kind's item list (content order). */
  index: number;
  /** Degrees round the ring, slot 0 at the top. */
  angle: number;
}

export interface RingSpec extends PlannedRing {
  /** Which ring this is, centre out: sets the arrival delay. */
  order: number;
  slots: RingSlot[];
}

export interface RingLayout {
  L: number;
  rings: RingSpec[];
  hidden: { long: number; short: number };
}

/**
 * Every ring to draw, inside to outside, with the content-order slots each holds. A kind's items run
 * from its innermost ring outward in blocks, so the kept items are the first in content order. A ring
 * starts half a slot round from the one inside it so neighbouring rings do not line up spokes.
 */
export function layoutRings(
  counts: { stack: number; long: number; short: number },
  vw: number,
  vh: number,
  mode?: RingOrderMode,
): RingLayout {
  const plan = ringPlan(vw, vh, counts, mode);
  const next: Record<RingKind, number> = { stack: 0, long: 0, short: 0 };

  const rings = plan.rings.map((ring, order): RingSpec => {
    const phase = order % 2 === 1 ? 180 / ring.count : 0;
    const slots = Array.from({ length: ring.count }, (_, i) => ({
      index: next[ring.kind] + i,
      angle: slotAngle(i, ring.count) + phase,
    }));
    next[ring.kind] += ring.count;
    return { ...ring, order, slots };
  });

  return { L: plan.L, rings, hidden: plan.hidden };
}

/** Which side of an item its label goes: towards the middle of the screen, where there is room. */
export function labelSide(itemCentreX: number, vw: number): "left" | "right" {
  return itemCentreX < vw / 2 ? "right" : "left";
}

/** The intro's first clause, for a screen too narrow for the whole line: "Six years of cutting long videos, shorts and brand films" gives "Six years of cutting long videos". */
export function introLine(text: string): string {
  const clause = text.split(/[,;:.!?]/)[0].trim();
  return clause || text.trim();
}

/**
 * How many of a ring's `count` items are in the page when `shown` items are, counting the rings inside to outside and
 * `first` the items in the rings before this one (a page that comes in through a change builds its rings a few items at a time).
 */
export function mountedIn(shown: number, first: number, count: number): number {
  return Math.max(0, Math.min(count, shown - first));
}
