// Turns item counts and the screen size into the rings to draw. Pure: no DOM, safe on the server.
import { RING, type RingId, itemWidth, ringRadius, slotAngle, splitRing, subRingRadius } from "./ring-math";

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
 * Every ring to draw for these item counts, inside to outside. A ring that does not fit at minimum
 * width is split in two; items neither holds are left out (they show only in a picked view). All of a
 * ring's sub-rings share the first one's item size so the ring reads as one.
 */
export function layoutRings(counts: Record<RingId, number>, vw: number, vh: number): SubRingSpec[] {
  const specs: SubRingSpec[] = [];

  RING_ORDER.forEach((id, order) => {
    const radius = ringRadius(id, vw, vh);
    const { rings } = splitRing(id, counts[id], radius);
    if (rings.length === 0) return;

    const width = itemWidth(id, rings[0], radius);
    const height = width / RING[id].aspect;
    let next = 0;

    rings.forEach((count, sub) => {
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
        order,
        radius: subRingRadius(radius, sub),
        period: RING[id].period,
        dir: sub % 2 === 1 ? (RING[id].dir === 1 ? -1 : 1) : RING[id].dir,
        width,
        height,
        slots,
      });
    });
  });

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
