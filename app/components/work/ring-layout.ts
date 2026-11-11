// Turns item counts and the screen size into the rings to draw. Pure: no DOM, safe on the server.
import { RING, type RingId, fitScale, planRings, slotAngle, subRingRadius } from "./ring-math";

/** Inside to outside: the order the rings are drawn and tabbed through. */
export const RING_ORDER: readonly RingId[] = ["stack", "long", "short", "clients"];

export interface RingSlot {
  /** Position in that ring's item list. */
  index: number;
  /** Degrees round the ring, slot 0 at the top. */
  angle: number;
}

export interface SubRingSpec {
  id: RingId;
  /** 0 is the ring itself, 1 the second ring of a split ring. */
  sub: number;
  /** Which of the four rings this is, centre out: sets the enter delay. */
  order: number;
  radius: number;
  /** Seconds for one turn. */
  period: number;
  /** 1 turns clockwise, -1 anticlockwise. A sub-ring turns the other way to its ring. */
  dir: 1 | -1;
  width: number;
  height: number;
  slots: RingSlot[];
}

/**
 * Every ring to draw for these item counts, inside to outside (see `planRings` and `fitScale`: items
 * are drawn smaller on a phone so the first two rings fit its width, and rings are pushed out so none
 * touches the one inside it). A ring that does not fit at minimum size is split in two; items neither
 * holds are left out (they show only in a picked view). All of a ring's sub-rings share one item size.
 */
export function layoutRings(counts: Record<RingId, number>, vw: number, vh: number): SubRingSpec[] {
  const scale = fitScale(counts, vw, vh);
  const specs: SubRingSpec[] = [];

  for (const plan of planRings(counts, vw, vh, scale)) {
    const { id } = plan;
    let next = 0;

    plan.counts.forEach((count, sub) => {
      // The second ring sits half a slot round so its items fall between the first ring's.
      const phase = sub % 2 === 1 ? 180 / count : 0;
      const slots = Array.from({ length: count }, (_, i) => ({
        index: next + i,
        angle: slotAngle(i, count) + phase,
      }));
      next += count;
      specs.push({
        id,
        sub,
        order: RING_ORDER.indexOf(id),
        radius: subRingRadius(plan.radius, sub),
        period: RING[id].period,
        dir: sub % 2 === 1 ? (RING[id].dir === 1 ? -1 : 1) : RING[id].dir,
        width: plan.width,
        height: plan.height,
        slots,
      });
    });
  }

  return specs;
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
