import { describe, expect, it } from "vitest";
import {
  RING,
  type RingId,
  itemWidth,
  ringCapacity,
  ringRadius,
  SUB_RING_FACTOR,
  subRingRadius,
  slotAngle,
  slotPosition,
  splitRing,
} from "./ring-math";

const IDS: RingId[] = ["stack", "long", "short", "clients"];
const COUNTS = [0, 1, 8, 40, 120];

describe("ringRadius", () => {
  it("is the ring's fraction of the shorter side", () => {
    expect(ringRadius("stack", 1440, 900)).toBe(189);
    expect(ringRadius("clients", 900, 1440)).toBeCloseTo(0.68 * 900);
  });

  it("grows by a quarter under 700px wide, and not at 700", () => {
    expect(ringRadius("stack", 390, 844)).toBeCloseTo(0.21 * 390 * 1.25);
    expect(ringRadius("stack", 700, 844)).toBeCloseTo(0.21 * 700);
  });
});

describe("itemWidth", () => {
  it("clamps up to the minimum", () => {
    expect(itemWidth("long", 16, 306)).toBe(96);
  });

  it("clamps down to the maximum", () => {
    expect(itemWidth("long", 8, 306)).toBe(176);
  });

  it("follows the circumference between the bounds", () => {
    const w = itemWidth("short", 30, 450);
    expect(w).toBeCloseTo((2 * Math.PI * 450) / (30 * 1.3));
    expect(w).toBeGreaterThan(RING.short.min);
    expect(w).toBeLessThan(RING.short.max);
  });

  it.each(IDS.flatMap((id) => COUNTS.map((c) => [id, c] as const)))(
    "%s with %i items stays finite and within bounds",
    (id, count) => {
      for (const r of [0, 50, 306, 1000]) {
        const w = itemWidth(id, count, r);
        expect(Number.isFinite(w)).toBe(true);
        expect(w).toBeGreaterThanOrEqual(RING[id].min);
        expect(w).toBeLessThanOrEqual(RING[id].max);
      }
    },
  );

  it("gives a ring of none the maximum rather than dividing by zero", () => {
    expect(itemWidth("clients", 0, 300)).toBe(72);
  });
});

describe("ringCapacity", () => {
  it("is how many minimum-width items fit with their gap", () => {
    expect(ringCapacity("short", 450)).toBe(40);
  });

  it("is zero for a ring with no radius", () => {
    expect(ringCapacity("short", 0)).toBe(0);
    expect(ringCapacity("short", -5)).toBe(0);
    expect(ringCapacity("short", Number.NaN)).toBe(0);
  });
});

describe("splitRing", () => {
  it("keeps one ring when the items fit", () => {
    expect(splitRing("short", 24, 450)).toEqual({ rings: [24], hidden: 0 });
    expect(splitRing("stack", 1, 189)).toEqual({ rings: [1], hidden: 0 });
  });

  it("keeps one ring at exactly its capacity", () => {
    expect(splitRing("short", 40, 450)).toEqual({ rings: [40], hidden: 0 });
  });

  it("fills the inner ring, then puts the rest on the outer one", () => {
    expect(splitRing("short", 60, 450)).toEqual({ rings: [40, 20], hidden: 0 });
    expect(splitRing("short", 41, 450)).toEqual({ rings: [40, 1], hidden: 0 });
  });

  it("hides what neither ring can hold", () => {
    expect(splitRing("short", 120, 450)).toEqual({ rings: [40, 45], hidden: 35 });
    expect(splitRing("short", 85, 450)).toEqual({ rings: [40, 45], hidden: 0 });
    expect(splitRing("short", 86, 450)).toEqual({ rings: [40, 45], hidden: 1 });
  });

  it("returns no rings for no items", () => {
    expect(splitRing("long", 0, 306)).toEqual({ rings: [], hidden: 0 });
    expect(splitRing("long", -3, 306)).toEqual({ rings: [], hidden: 0 });
  });

  it.each(IDS.flatMap((id) => COUNTS.map((c) => [id, c] as const)))(
    "%s with %i items places every item once, or hides it",
    (id, count) => {
      for (const r of [0, 120, 306, 700]) {
        const { rings, hidden } = splitRing(id, count, r);
        expect(rings.reduce((a, b) => a + b, 0) + hidden).toBe(count);
        expect(rings.length).toBeLessThanOrEqual(2);
        expect(hidden).toBeGreaterThanOrEqual(0);
        for (const n of rings) expect(n).toBeGreaterThan(0);
      }
    },
  );

  it("hides everything when the ring has no radius", () => {
    expect(splitRing("short", 8, 0)).toEqual({ rings: [], hidden: 8 });
  });

  it("does not fractionalise a count", () => {
    const { rings, hidden } = splitRing("short", 24.7, 450);
    expect(rings.every(Number.isInteger)).toBe(true);
    expect(Number.isInteger(hidden)).toBe(true);
  });
});

describe("slotAngle and slotPosition", () => {
  it("starts at the top and goes round clockwise", () => {
    expect(slotAngle(0, 8)).toBe(-90);
    expect(slotAngle(2, 8)).toBe(0);
    expect(slotAngle(4, 8)).toBe(90);
  });

  it("is safe for a ring of none", () => {
    expect(slotAngle(0, 0)).toBe(-90);
    expect(slotAngle(3, 0)).toBe(-90);
    expect(Number.isFinite(slotAngle(0, 1))).toBe(true);
    expect(slotAngle(0, 1)).toBe(-90);
  });

  it.each([1, 8, 40, 120])("spreads %i slots evenly over the turn", (n) => {
    const step = slotAngle(1, n) - slotAngle(0, n);
    expect(step).toBeCloseTo(360 / n);
    expect(slotAngle(n - 1, n)).toBeLessThan(270);
  });

  it("puts angle -90 straight above the centre", () => {
    const p = slotPosition(-90, 100, 500, 400);
    expect(p.x).toBeCloseTo(500);
    expect(p.y).toBeCloseTo(300);
  });

  it("puts 0 to the right and 90 below", () => {
    const right = slotPosition(0, 100, 500, 400);
    expect(right.x).toBeCloseTo(600);
    expect(right.y).toBeCloseTo(400);
    const below = slotPosition(90, 100, 500, 400);
    expect(below.x).toBeCloseTo(500);
    expect(below.y).toBeCloseTo(500);
  });
});

describe("subRingRadius", () => {
  it("is the ring itself at index 0 and a factor further out at 1", () => {
    expect(subRingRadius(100, 0)).toBe(100);
    expect(subRingRadius(100, 1)).toBeCloseTo(100 * SUB_RING_FACTOR);
    expect(subRingRadius(100, 2)).toBeCloseTo(100 * SUB_RING_FACTOR ** 2);
  });

  it("treats a bad index as the ring itself", () => {
    expect(subRingRadius(100, -1)).toBe(100);
    expect(subRingRadius(100, Number.NaN)).toBe(100);
  });

  it("is the radius splitRing measures the second ring's capacity at", () => {
    const radius = 450;
    const { rings } = splitRing("short", 500, radius);
    expect(rings[1]).toBe(ringCapacity("short", subRingRadius(radius, 1)));
  });
});
