import { describe, expect, it } from "vitest";
import { BEFORE } from "./ring-before.fixture";
import { coverage } from "./ring-coverage";
import { introLine, labelSide, layoutRings } from "./ring-layout";
import { clear, ringCapacity, ringPlan } from "./ring-math";

const WORK = { stack: 8, long: 35, short: 35 };
/** What the content file holds since round 7: 8 tools, 21 long form videos, 35 short form placeholders. */
const REAL = { stack: 8, long: 21, short: 35 };
/** The seven sizes the ring audit photographs (scripts/audit/make-rings.mjs). */
const AUDIT_SIZES: [number, number][] = [[1440, 900], [1920, 1080], [820, 1180], [390, 844], [375, 667], [568, 320], [320, 568]];
/** The nine sizes the ring audit measures. */
const ALL_AUDIT_SIZES: [number, number][] = [...AUDIT_SIZES, [1024, 768], [2560, 1440]];

describe("layoutRings without a cut-out round the dock (R56.4)", () => {
  it("has, at every audit size, tiles no smaller and no fewer than at 4621443, the last commit with the cut-out", () => {
    for (const [vw, vh] of ALL_AUDIT_SIZES) {
      const before = BEFORE[`${vw}x${vh}`];
      const layout = layoutRings(REAL, vw, vh);
      const video = layout.rings.filter((r) => r.kind !== "stack");
      expect(layout.L, `${vw}x${vh} L`).toBeGreaterThanOrEqual(before.L);
      expect(video.reduce((n, r) => n + r.slots.length, 0), `${vw}x${vh} tiles`).toBeGreaterThanOrEqual(before.tiles);
      for (const r of video) expect(Math.max(r.size.w, r.size.h), `${vw}x${vh} ${r.id}`).toBeGreaterThanOrEqual(before.L);
    }
  });

  it("counts the coverage of that layout without a mask, and it is no less than before", () => {
    for (const [vw, vh] of ALL_AUDIT_SIZES) {
      expect(coverage(layoutRings(REAL, vw, vh), vw, vh), `${vw}x${vh}`).toBeGreaterThanOrEqual(BEFORE[`${vw}x${vh}`].full - 1e-6);
    }
  });

  it("does not depend on a dock: a fifth argument (the old dock box) changes nothing, the layout is a function of the counts, the size and the order", () => {
    expect(layoutRings(REAL, 1440, 900)).toEqual(layoutRings(REAL, 1440, 900, "alternating"));
    const extra = layoutRings as (...a: unknown[]) => unknown;
    expect(extra(REAL, 1440, 900, "alternating", { l: 500, t: 780, r: 940, b: 880 })).toEqual(layoutRings(REAL, 1440, 900, "alternating"));
  });
});

describe("layoutRings", () => {
  it("draws the stack ring and the video rings inside to outside, for the real content on a laptop", () => {
    const { rings } = layoutRings(WORK, 1440, 900);
    // R54.2: larger tiles, so two video rings (a laptop), not four
    expect(rings.map((r) => `${r.id}:${r.slots.length}`)).toEqual(["stack:8", "long-1:10", "short-1:16"]);
    expect(rings.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it("keeps every ring and every neighbour clear for the real counts (8, 21, 35) at the seven audit sizes", () => {
    for (const [vw, vh] of AUDIT_SIZES) {
      const { rings, hidden } = layoutRings(REAL, vw, vh);
      for (const [i, a] of rings.entries()) {
        // neighbours on one ring: no more items than the ring holds with the clearance
        expect(a.slots.length, `${vw}x${vh} ${a.id}`).toBeLessThanOrEqual(ringCapacity(a.radius, a.size));
        // rings: the radii differ by at least the clearance of their two item sizes
        for (const b of rings.slice(i + 1)) {
          expect(b.radius - a.radius, `${vw}x${vh} ${a.id} / ${b.id}`).toBeGreaterThanOrEqual(clear(a.size, b.size) - 1e-6);
        }
      }
      // what is left out is the last items in file order, never an item drawn twice
      for (const kind of ["long", "short"] as const) {
        const drawn = rings.filter((r) => r.kind === kind).reduce((n, r) => n + r.slots.length, 0);
        expect(drawn + hidden[kind]).toBe(REAL[kind]);
      }
    }
  });

  it("leaves the videos that fit in no ring to the walls: 11 long form on a laptop, none of them on a wide screen", () => {
    expect(layoutRings(REAL, 1440, 900).hidden).toEqual({ long: 11, short: 19 });
    expect(layoutRings(REAL, 2560, 1440).hidden.long).toBe(0);
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
    const { rings } = layoutRings(WORK, 2560, 1440, "paired");
    expect(rings.filter((r) => r.kind !== "stack").map((r) => r.kind)).toEqual(["long", "long", "short"]);
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
