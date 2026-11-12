import { describe, expect, it } from "vitest";
import { introLine, labelSide, layoutRings } from "./ring-layout";
import { ringCapacity, ringPlan } from "./ring-math";

const WORK = { stack: 8, long: 35, short: 35 };

describe("layoutRings", () => {
  it("draws the stack ring and the video rings inside to outside, for the real content on a laptop", () => {
    const { rings } = layoutRings(WORK, 1440, 900);
    expect(rings.map((r) => `${r.id}:${r.slots.length}`)).toEqual([
      "stack:8",
      "long-1:13",
      "short-1:14",
      "long-2:22",
      "short-2:21",
    ]);
    expect(rings.map((r) => r.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("is the ring plan: radii, sizes, periods and directions come from ringPlan", () => {
    const layout = layoutRings(WORK, 1440, 900);
    const plan = ringPlan(1440, 900, WORK);
    expect(layout.L).toBe(plan.L);
    expect(layout.hidden).toEqual(plan.hidden);
    expect(layout.rings.map((r) => [r.id, r.radius, r.periodS, r.dir, r.size])).toEqual(
      plan.rings.map((r) => [r.id, r.radius, r.periodS, r.dir, r.size]),
    );
  });

  it("numbers the slots across a kind's rings in content order so each item is drawn once", () => {
    for (const [vw, vh] of [[1440, 900], [390, 844], [1920, 1080], [820, 1180]]) {
      const { rings, hidden } = layoutRings(WORK, vw, vh);
      for (const kind of ["stack", "long", "short"] as const) {
        const indexes = rings.filter((r) => r.kind === kind).flatMap((r) => r.slots.map((s) => s.index));
        expect(indexes).toEqual(indexes.map((_, i) => i));
        expect(indexes.length + (kind === "stack" ? 0 : hidden[kind])).toBe(WORK[kind]);
      }
    }
  });

  it("leaves out the last videos in content order, never the first", () => {
    const { rings, hidden } = layoutRings({ stack: 8, long: 120, short: 120 }, 390, 844);
    expect(hidden.long).toBeGreaterThan(0);
    const kept = rings.filter((r) => r.kind === "long").flatMap((r) => r.slots.map((s) => s.index));
    expect(kept[0]).toBe(0);
    expect(Math.max(...kept)).toBe(kept.length - 1);
  });

  it("starts the first slot at the top and offsets every other ring by half a slot", () => {
    const { rings } = layoutRings(WORK, 1440, 900);
    expect(rings[0].slots[0].angle).toBe(-90);
    expect(rings[1].slots[0].angle).toBeCloseTo(-90 + 180 / rings[1].count);
    expect(rings[2].slots[0].angle).toBe(-90);
  });

  it("never holds more than a ring's capacity", () => {
    const { rings } = layoutRings({ stack: 8, long: 500, short: 500 }, 1440, 900);
    for (const r of rings) expect(r.slots.length).toBeLessThanOrEqual(ringCapacity(r.radius, r.size));
  });

  it("draws nothing for no items, and does not assume a first ring", () => {
    expect(layoutRings({ stack: 0, long: 0, short: 0 }, 1440, 900).rings).toEqual([]);
    const only = layoutRings({ stack: 0, long: 0, short: 3 }, 1440, 900);
    expect(only.rings).toHaveLength(1);
    expect(only.rings[0].kind).toBe("short");
  });

  it("can be asked for the paired order", () => {
    const { rings } = layoutRings(WORK, 1440, 900, "paired");
    expect(rings.filter((r) => r.kind !== "stack").map((r) => r.kind)).toEqual(["long", "long", "short", "short"]);
  });

  it("copes with a screen of no size", () => {
    expect(() => layoutRings(WORK, 0, 0)).not.toThrow();
  });
});

describe("labelSide", () => {
  it("points the label towards the middle of the screen", () => {
    expect(labelSide(100, 1440)).toBe("right");
    expect(labelSide(1300, 1440)).toBe("left");
    expect(labelSide(720, 1440)).toBe("left");
  });
});

describe("introLine", () => {
  it("is the text up to its first comma or stop", () => {
    expect(introLine("Six years of cutting long videos, shorts and brand films for creators and companies.")).toBe(
      "Six years of cutting long videos",
    );
    expect(introLine("Edits that move. And more.")).toBe("Edits that move");
  });

  it("is the whole text when it has no break", () => {
    expect(introLine("Edits that move")).toBe("Edits that move");
    expect(introLine("  Edits that move  ")).toBe("Edits that move");
  });

  it("falls back to the text when it starts with a break, and copes with nothing", () => {
    expect(introLine(", odd")).toBe(", odd");
    expect(introLine("")).toBe("");
  });
});
