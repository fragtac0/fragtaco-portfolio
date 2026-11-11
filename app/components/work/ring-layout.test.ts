import { describe, expect, it } from "vitest";
import { RING_ORDER, introLine, labelSide, layoutRings } from "./ring-layout";
import { RING, ringCapacity, ringRadius, subRingRadius } from "./ring-math";

const WORK = { stack: 8, long: 16, short: 24, clients: 10 };

describe("layoutRings", () => {
  it("draws the four rings, inside to outside, for the real content on a laptop", () => {
    const specs = layoutRings(WORK, 1440, 900);
    expect(specs.map((s) => `${s.id}:${s.sub}:${s.slots.length}`)).toEqual([
      "stack:0:8",
      "long:0:15",
      "long:1:1",
      "short:0:24",
      "clients:0:10",
    ]);
    expect(specs.map((s) => s.order)).toEqual([0, 1, 1, 2, 3]);
  });

  it("uses the ring's radius, period and direction", () => {
    const specs = layoutRings(WORK, 1440, 900);
    const stack = specs[0];
    expect(stack.radius).toBe(ringRadius("stack", 1440, 900));
    expect(stack.period).toBe(RING.stack.period);
    expect(stack.dir).toBe(1);
    expect(specs.find((s) => s.id === "clients")?.dir).toBe(-1);
  });

  it("turns a sub-ring the other way and puts it further out", () => {
    const [inner, outer] = layoutRings(WORK, 1440, 900).filter((s) => s.id === "long");
    expect(inner.dir).toBe(RING.long.dir);
    expect(outer.dir).toBe(-RING.long.dir);
    expect(outer.radius).toBeCloseTo(subRingRadius(inner.radius, 1));
  });

  it("gives every sub-ring of a ring the same item size, in the ring's shape", () => {
    const longs = layoutRings(WORK, 1440, 900).filter((s) => s.id === "long");
    expect(longs[1].width).toBe(longs[0].width);
    expect(longs[0].width / longs[0].height).toBeCloseTo(16 / 9);
    const short = layoutRings(WORK, 1440, 900).find((s) => s.id === "short")!;
    expect(short.width / short.height).toBeCloseTo(9 / 16);
  });

  it("numbers the slots across sub-rings so each item is drawn once", () => {
    for (const [vw, vh] of [[1440, 900], [390, 844], [1920, 1080]]) {
      const specs = layoutRings(WORK, vw, vh);
      for (const id of RING_ORDER) {
        const indexes = specs.filter((s) => s.id === id).flatMap((s) => s.slots.map((x) => x.index));
        expect(indexes).toEqual(indexes.map((_, i) => i));
        expect(indexes.length).toBeLessThanOrEqual(WORK[id]);
      }
    }
  });

  it("starts the first slot at the top and offsets a sub-ring by half a slot", () => {
    const [inner, outer] = layoutRings(WORK, 390, 844).filter((s) => s.id === "long");
    expect(inner.slots[0].angle).toBe(-90);
    expect(outer.slots[0].angle).toBeCloseTo(-90 + 180 / outer.slots.length);
  });

  it("leaves out items neither ring holds", () => {
    const specs = layoutRings({ stack: 0, long: 0, short: 500, clients: 0 }, 1440, 900);
    const held = specs.reduce((n, s) => n + s.slots.length, 0);
    const radius = ringRadius("short", 1440, 900);
    expect(held).toBe(ringCapacity("short", radius) + ringCapacity("short", subRingRadius(radius, 1)));
    expect(held).toBeLessThan(500);
  });

  it("draws nothing for no items, and never assumes a first ring", () => {
    expect(layoutRings({ stack: 0, long: 0, short: 0, clients: 0 }, 1440, 900)).toEqual([]);
    const onlyClients = layoutRings({ stack: 0, long: 0, short: 0, clients: 3 }, 1440, 900);
    expect(onlyClients).toHaveLength(1);
    expect(onlyClients[0].order).toBe(3);
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
