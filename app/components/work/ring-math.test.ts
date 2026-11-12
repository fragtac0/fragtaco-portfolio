import { describe, expect, it } from "vitest";
import {
  BAND_GAP,
  CENTRE_CLEAR,
  FIT_MARGIN,
  MIN_SCALE,
  RING,
  type RingId,
  fitScale,
  itemExtent,
  planRings,
  itemWidth,
  ringCapacity,
  ringRadius,
  SUB_RING_FACTOR,
  subRingRadius,
  slotAngle,
  slotPosition,
  splitRing,
} from "./ring-math";

const IDS: RingId[] = ["stack", "long", "short"];
const COUNTS = [0, 1, 8, 40, 120];

describe("ringRadius", () => {
  it("is the ring's fraction of the shorter side", () => {
    expect(ringRadius("stack", 1440, 900)).toBe(189);
    expect(ringRadius("short", 900, 1440)).toBeCloseTo(0.5 * 900);
  });

  it("is the same fraction on a phone (a phone's items shrink instead, see fitScale)", () => {
    expect(ringRadius("stack", 390, 844)).toBeCloseTo(0.21 * 390);
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
    // a tall cover's extent along the ring is its height, 16/9 of its width
    const w = itemWidth("short", 20, 450);
    expect(w).toBeCloseTo((2 * Math.PI * 450) / (20 * 1.3 * (16 / 9)));
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
    expect(itemWidth("short", 0, 300)).toBe(96);
  });
});

describe("ringCapacity", () => {
  it("is how many minimum-width items fit with their gap", () => {
    expect(ringCapacity("short", 450)).toBe(22); // 96px tall at minimum, not 54 wide
    expect(ringCapacity("long", 306)).toBe(15);
  });

  it("is zero for a ring with no radius", () => {
    expect(ringCapacity("short", 0)).toBe(0);
    expect(ringCapacity("short", -5)).toBe(0);
    expect(ringCapacity("short", Number.NaN)).toBe(0);
  });
});

describe("splitRing", () => {
  it("keeps one ring when the items fit", () => {
    expect(splitRing("short", 22, 450)).toEqual({ rings: [22], hidden: 0 });
    expect(splitRing("long", 15, 306)).toEqual({ rings: [15], hidden: 0 });
    expect(splitRing("stack", 1, 189)).toEqual({ rings: [1], hidden: 0 });
  });

  it("keeps one ring at exactly its capacity", () => {
    expect(splitRing("short", 22, 450)).toEqual({ rings: [22], hidden: 0 });
    expect(splitRing("short", 23, 450).rings).toEqual([22, 1]);
  });

  it("fills the inner ring, then puts the rest on the outer one", () => {
    expect(splitRing("short", 40, 450)).toEqual({ rings: [22, 18], hidden: 0 });
    expect(splitRing("short", 24, 450)).toEqual({ rings: [22, 2], hidden: 0 });
  });

  it("hides what neither ring can hold", () => {
    expect(splitRing("short", 120, 450)).toEqual({ rings: [22, 25], hidden: 73 });
    expect(splitRing("short", 47, 450)).toEqual({ rings: [22, 25], hidden: 0 });
    expect(splitRing("short", 48, 450)).toEqual({ rings: [22, 25], hidden: 1 });
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

describe("itemExtent", () => {
  it("is the longest side: the width for wide and square items, the height for tall ones", () => {
    expect(itemExtent("long", 96)).toBe(96);
    expect(itemExtent("stack", 50)).toBe(50);
    expect(itemExtent("stack", 80)).toBe(80);
    expect(itemExtent("short", 54)).toBeCloseTo(96);
  });
});

describe("scale", () => {
  it("shrinks the bounds and the capacity's item size, and 1 changes nothing", () => {
    expect(itemWidth("long", 40, 306, 0.5)).toBe(48);
    expect(itemWidth("long", 4, 306, 0.5)).toBe(88);
    expect(itemWidth("long", 16, 306, 1)).toBe(itemWidth("long", 16, 306));
    expect(ringCapacity("long", 306, 0.5)).toBe(30);
    expect(splitRing("long", 16, 306, 0.5)).toEqual({ rings: [16], hidden: 0 });
  });

  it("falls back to 1 for a bad scale", () => {
    expect(itemWidth("long", 16, 306, 0)).toBe(96);
    expect(itemWidth("long", 16, 306, Number.NaN)).toBe(96);
  });
});

const WORK = { stack: 8, long: 16, short: 24 };
const SCREENS: [number, number][] = [
  [1920, 1080],
  [1440, 900],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [360, 780],
  [320, 568],
];

describe("planRings", () => {
  it("leaves rings at their nominal radius when nothing touches", () => {
    const plans = planRings(WORK, 1440, 900);
    expect(plans.map((p) => p.id)).toEqual(["stack", "long", "short"]);
    expect(plans[0].radius).toBe(189);
    expect(plans[1].radius).toBe(306);
  });

  it.each(SCREENS)("keeps the intro's space and a gap between every ring's band at %ix%i", (vw, vh) => {
    for (const scale of [1, 0.7, 0.4]) {
      const plans = planRings(WORK, vw, vh, scale);
      expect(plans[0].radius - plans[0].extent / 2).toBeGreaterThanOrEqual(CENTRE_CLEAR - 1e-6);
      for (let i = 1; i < plans.length; i++) {
        const inside = plans[i - 1].outer + plans[i - 1].extent / 2;
        const here = plans[i].radius - plans[i].extent / 2;
        expect(here - inside).toBeGreaterThanOrEqual(BAND_GAP - 1e-6);
      }
    }
  });

  it("never lets neighbours on a ring touch: slot spacing is at least the item's longest side", () => {
    for (const [vw, vh] of SCREENS) {
      for (const p of planRings(WORK, vw, vh, fitScale(WORK, vw, vh))) {
        const radii = [p.radius, p.outer];
        p.counts.forEach((count, sub) => {
          expect((2 * Math.PI * radii[sub]) / count).toBeGreaterThanOrEqual(p.extent * 1.3 - 1e-6);
        });
      }
    }
  });

  it("pushes a ring out when the ring inside it has a sub-ring", () => {
    const plans = planRings(WORK, 1440, 900);
    const long = plans[1];
    expect(long.counts.length).toBe(2);
    expect(plans[2].radius - plans[2].extent / 2).toBeGreaterThanOrEqual(long.outer + long.extent / 2 + BAND_GAP - 1e-6);
  });

  it("skips rings with no items and keeps the clear space for the first one drawn", () => {
    const plans = planRings({ stack: 0, long: 0, short: 3 }, 1440, 900);
    expect(plans.map((p) => p.id)).toEqual(["short"]);
    expect(planRings({ stack: 0, long: 0, short: 0 }, 1440, 900)).toEqual([]);
  });

  it("pushes a lone ring off the middle when its nominal radius would eat the intro's space", () => {
    const [stack] = planRings({ stack: 8, long: 0, short: 0 }, 100, 100);
    expect(stack.radius - stack.extent / 2).toBeGreaterThanOrEqual(CENTRE_CLEAR - 1e-6);
  });
});

describe("fitScale", () => {
  it("is 1 from 700px wide up", () => {
    expect(fitScale(WORK, 700, 900)).toBe(1);
    expect(fitScale(WORK, 1440, 900)).toBe(1);
    expect(fitScale(WORK, 0, 0)).toBe(1);
  });

  it.each([
    [390, 844],
    [360, 780],
    [320, 568],
    [414, 896],
    [699, 900],
  ])("fits the stack and long rings, sub-ring and half an item included, inside %ix%i", (vw, vh) => {
    const scale = fitScale(WORK, vw, vh);
    expect(scale).toBeGreaterThan(MIN_SCALE);
    expect(scale).toBeLessThanOrEqual(1);
    for (const p of planRings(WORK, vw, vh, scale)) {
      if (p.id === "stack" || p.id === "long") {
        expect(p.outer + p.extent / 2).toBeLessThanOrEqual(vw / 2 - FIT_MARGIN + 1e-6);
      }
    }
  });

  it("is the largest scale that fits: one step up does not", () => {
    for (const [vw, vh] of [[390, 844], [320, 568]]) {
      const scale = fitScale(WORK, vw, vh);
      if (scale >= 1) continue;
      const bigger = planRings(WORK, vw, vh, scale + 0.01).filter((p) => p.id === "stack" || p.id === "long");
      expect(bigger.some((p) => p.outer + p.extent / 2 > vw / 2 - FIT_MARGIN)).toBe(true);
    }
  });

  it("lets the outer ring run past the screen's sides", () => {
    const plans = planRings(WORK, 390, 844, fitScale(WORK, 390, 844));
    expect(plans[2].radius).toBeGreaterThan(390 / 2);
  });

  it("copes with no items", () => {
    expect(fitScale({ stack: 0, long: 0, short: 0 }, 390, 844)).toBe(1);
  });
});
