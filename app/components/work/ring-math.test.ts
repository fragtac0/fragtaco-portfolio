import { describe, expect, it } from "vitest";
import {
  L_MAX,
  L_MIN,
  RING_ORDER_MODE,
  clear,
  halfDiagonal,
  ringCapacity,
  ringKinds,
  ringPlan,
  slotAngle,
  stackIconSize,
  stackRadius,
  tileSize,
  type RingOrderMode,
  type RingPlan,
} from "./ring-math";

/** Review Focus 1: the sizes and the counts per kind. */
const SIZES: [number, number][] = [
  [320, 568],
  [390, 844],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
  [1920, 1080],
];
const COUNTS = [1, 8, 35, 120];
const MODES: RingOrderMode[] = ["alternating", "paired"];

const plan = (vw: number, vh: number, n: number, mode?: RingOrderMode): RingPlan =>
  ringPlan(vw, vh, { stack: 8, long: n, short: n }, mode);

describe("clear", () => {
  it("is the diagonal of the box two rectangles' half-extents and the gap make", () => {
    // a 100 by 56.25 and a 56.25 by 100 tile: both sides (78.125 + 12) wide
    const d = clear({ w: 100, h: 56.25 }, { w: 56.25, h: 100 });
    expect(d).toBeCloseTo(Math.SQRT2 * 90.125, 6);
  });

  it("takes a gap, 12 by default, and is symmetric", () => {
    const a = { w: 60, h: 60 };
    const b = { w: 100, h: 56.25 };
    expect(clear(a, b)).toBe(clear(b, a));
    expect(clear(a, a)).toBeCloseTo(Math.SQRT2 * 72, 6);
    expect(clear(a, a, 0)).toBeCloseTo(Math.SQRT2 * 60, 6);
  });

  it("is enough: centres that far apart never overlap, at any offset", () => {
    const a = { w: 110, h: 61.875 };
    const b = { w: 61.875, h: 110 };
    const gap = 12;
    const d = clear(a, b, gap);
    for (let deg = 0; deg < 360; deg += 1) {
      const dx = d * Math.cos((deg * Math.PI) / 180);
      const dy = d * Math.sin((deg * Math.PI) / 180);
      const xGap = Math.abs(dx) - (a.w + b.w) / 2;
      const yGap = Math.abs(dy) - (a.h + b.h) / 2;
      expect(Math.max(xGap, yGap)).toBeGreaterThanOrEqual(gap - 1e-9);
    }
  });
});

describe("stack ring", () => {
  it("has icons of 60 px, 52 px under 700 px wide", () => {
    expect(stackIconSize(1440)).toBe(60);
    expect(stackIconSize(700)).toBe(60);
    expect(stackIconSize(699)).toBe(52);
  });

  it("has radius min(max(190, 0.24 vh), 0.42 vw)", () => {
    expect(stackRadius(1440, 900)).toBeCloseTo(216);
    expect(stackRadius(1024, 768)).toBe(190);
    expect(stackRadius(1920, 1080)).toBeCloseTo(259.2);
    expect(stackRadius(390, 844)).toBeCloseTo(0.42 * 390);
  });

  it("keeps its icons inside the screen's width on the narrowest screens", () => {
    for (const vw of [320, 340, 360, 375]) {
      expect(stackRadius(vw, 700) + stackIconSize(vw) / 2).toBeLessThanOrEqual(vw / 2);
    }
  });
});

describe("tileSize and ringKinds", () => {
  it("makes long form L by 0.5625 L and short form 0.5625 L by L", () => {
    expect(tileSize("long", 160)).toEqual({ w: 160, h: 90 });
    expect(tileSize("short", 160)).toEqual({ w: 90, h: 160 });
  });

  it("orders the rings long, short, long, short, or long, long, short, short", () => {
    expect(ringKinds(4, "alternating")).toEqual(["long", "short", "long", "short"]);
    expect(ringKinds(4, "paired")).toEqual(["long", "long", "short", "short"]);
  });

  it("puts long inside and short outside with two rings, in both modes", () => {
    expect(ringKinds(2, "alternating")).toEqual(["long", "short"]);
    expect(ringKinds(2, "paired")).toEqual(["long", "short"]);
  });

  it("ships alternating", () => {
    expect(RING_ORDER_MODE).toBe("alternating");
  });
});

describe("ringCapacity", () => {
  it("is the most items whose neighbours meet clear, so one more would not", () => {
    const size = tileSize("long", 110);
    for (const r of [357, 499, 640, 781]) {
      const n = ringCapacity(r, size);
      expect(2 * r * Math.sin(Math.PI / n)).toBeGreaterThanOrEqual(clear(size, size));
      expect(2 * r * Math.sin(Math.PI / (n + 1))).toBeLessThan(clear(size, size));
    }
  });

  it("is 1 where the ring cannot hold two", () => {
    expect(ringCapacity(50, tileSize("long", 200))).toBe(1);
    expect(ringCapacity(0, tileSize("long", 100))).toBe(1);
  });
});

describe("ringPlan: the worked numbers of spec 6.2", () => {
  it("gives 4 video rings about 141 px apart at 1440 by 900, L near 110, room for all 70", () => {
    const p = plan(1440, 900, 35);
    const video = p.rings.filter((r) => r.kind !== "stack");
    expect(video.map((r) => r.id)).toEqual(["long-1", "short-1", "long-2", "short-2"]);
    expect(p.L).toBeGreaterThanOrEqual(104);
    expect(p.L).toBeLessThanOrEqual(114);
    expect(p.hidden).toEqual({ long: 0, short: 0 });
    expect(video[1].radius - video[0].radius).toBeCloseTo(141.4, 0);
    expect(video.reduce((n, r) => n + r.count, 0)).toBe(70);
  });

  it("has L near 155 at 1920 by 1080", () => {
    const p = plan(1920, 1080, 35);
    expect(p.L).toBeGreaterThanOrEqual(150);
    expect(p.L).toBeLessThanOrEqual(160);
    expect(p.rings.filter((r) => r.kind !== "stack")).toHaveLength(4);
  });

  it("has 2 video rings and L near 104 at 390 by 844, showing about 32 videos", () => {
    const p = plan(390, 844, 35);
    const video = p.rings.filter((r) => r.kind !== "stack");
    expect(video.map((r) => r.kind)).toEqual(["long", "short"]);
    expect(p.L).toBeGreaterThanOrEqual(100);
    expect(p.L).toBeLessThanOrEqual(108);
    const shown = video.reduce((n, r) => n + r.count, 0);
    expect(shown).toBeGreaterThanOrEqual(30);
    expect(shown).toBeLessThanOrEqual(34);
    expect(p.hidden.long + p.hidden.short).toBe(70 - shown);
  });

  it("uses 3 rings where 4 would need L under 96 (820 by 1180, 1024 by 768)", () => {
    for (const [vw, vh] of [[820, 1180], [1024, 768]]) {
      const p = plan(vw, vh, 35);
      expect(p.L).toBeGreaterThanOrEqual(L_MIN);
      expect(p.rings.filter((r) => r.kind !== "stack").map((r) => r.radius).length).toBeLessThanOrEqual(3);
    }
  });
});

describe("ringPlan: no overlap at any ring phase", () => {
  for (const mode of MODES) {
    for (const [vw, vh] of SIZES) {
      for (const n of COUNTS) {
        it(`${mode}, ${vw} by ${vh}, ${n} per kind`, () => {
          const p = plan(vw, vh, n, mode);
          const rings = p.rings;

          // neighbours on one ring: the chord between them meets clear
          for (const r of rings) {
            if (r.count < 2) continue;
            const chord = 2 * r.radius * Math.sin(Math.PI / r.count);
            expect(chord).toBeGreaterThanOrEqual(clear(r.size, r.size) - 1e-9);
          }

          // every pair of rings, not only neighbours: radii at least clear apart
          for (let i = 0; i < rings.length; i++) {
            for (let j = i + 1; j < rings.length; j++) {
              expect(rings[j].radius - rings[i].radius).toBeGreaterThanOrEqual(
                clear(rings[i].size, rings[j].size) - 1e-9,
              );
            }
          }
        });
      }
    }
  }
});

describe("ringPlan: limits", () => {
  for (const mode of MODES) {
    for (const [vw, vh] of SIZES) {
      it(`${mode}, ${vw} by ${vh}: radii, L and the stack ring`, () => {
        for (const n of COUNTS) {
          const p = plan(vw, vh, n, mode);
          for (const r of p.rings) expect(r.radius).toBeLessThanOrEqual(0.92 * halfDiagonal(vw, vh) + 1e-9);
          expect(p.L).toBeLessThanOrEqual(L_MAX);
          const stack = p.rings.find((r) => r.kind === "stack")!;
          expect(stack.radius + stack.size.w / 2).toBeLessThanOrEqual(vw / 2);
          expect(stack.count).toBe(8);
        }
        const p = plan(vw, vh, 35, mode);
        // 96 or more, except on a screen too small for two rings at 96 (clearance wins there)
        if (vw >= 360) expect(p.L).toBeGreaterThanOrEqual(L_MIN);
        else expect(p.L).toBeGreaterThanOrEqual(48);
      });
    }
  }

  it("gives 4, 4, 3, 3, 2 and 2 video rings at the review sizes' 35 and 35", () => {
    const rings = (vw: number, vh: number) => plan(vw, vh, 35).rings.filter((r) => r.kind !== "stack").length;
    expect(rings(2560, 1440)).toBe(4);
    expect(rings(1440, 900)).toBe(4);
    expect(rings(1024, 768)).toBe(3);
    expect(rings(820, 1180)).toBe(3);
    expect(rings(390, 844)).toBe(2);
    expect(rings(320, 568)).toBe(2);
  });

  it("goes round the ring the other way each ring, the stack ring first, with the periods of the spec", () => {
    const p = plan(1440, 900, 35);
    expect(p.rings.map((r) => r.dir)).toEqual([1, -1, 1, -1, 1]);
    expect(p.rings.map((r) => r.periodS)).toEqual([90, 150, 190, 230, 270]);
  });

  it("copes with a screen of no size and with no items", () => {
    expect(() => ringPlan(0, 0, { stack: 8, long: 35, short: 35 })).not.toThrow();
    const none = ringPlan(1440, 900, { stack: 0, long: 0, short: 0 });
    expect(none.rings).toEqual([]);
    expect(none.hidden).toEqual({ long: 0, short: 0 });
    expect(ringPlan(1440, 900, { stack: Number.NaN, long: -3, short: 2.7 }).hidden).toEqual({ long: 0, short: 0 });
  });
});

describe("ringPlan: counts and what is left out", () => {
  it("counts what does not fit as hidden, and the rings hold exactly the rest", () => {
    for (const [vw, vh] of SIZES) {
      for (const n of COUNTS) {
        const p = plan(vw, vh, n);
        for (const kind of ["long", "short"] as const) {
          const held = p.rings.filter((r) => r.kind === kind).reduce((s, r) => s + r.count, 0);
          expect(held + p.hidden[kind]).toBe(n);
          // a ring is never over capacity
          for (const r of p.rings.filter((x) => x.kind === kind)) {
            expect(r.count).toBeLessThanOrEqual(ringCapacity(r.radius, r.size));
          }
        }
      }
    }
  });

  it("hides nothing for 1 and 8 of each kind, and hides the surplus for 120", () => {
    for (const [vw, vh] of SIZES) {
      expect(plan(vw, vh, 1).hidden).toEqual({ long: 0, short: 0 });
      expect(plan(vw, vh, 8).hidden).toEqual({ long: 0, short: 0 });
      const big = plan(vw, vh, 120);
      expect(big.hidden.long).toBeGreaterThan(0);
      expect(big.hidden.short).toBeGreaterThan(0);
    }
  });

  it("keeps a few items near the middle: 8 of a kind sit on its innermost ring", () => {
    const p = plan(1440, 900, 8);
    expect(p.rings.map((r) => r.id)).toEqual(["stack", "long-1", "short-1"]);
    expect(p.rings.map((r) => r.count)).toEqual([8, 8, 8]);
  });

  it("shares a kind's items over its rings in proportion to their capacity", () => {
    const [a, b] = plan(1440, 900, 35).rings.filter((r) => r.kind === "long");
    expect(a.count + b.count).toBe(35);
    expect(a.count).toBeLessThan(b.count);
    expect(Math.abs(a.count / ringCapacity(a.radius, a.size) - b.count / ringCapacity(b.radius, b.size))).toBeLessThan(0.1);
  });

  it("keeps the stack ring to what it can hold", () => {
    const p = ringPlan(320, 568, { stack: 50, long: 0, short: 0 });
    expect(p.rings).toHaveLength(1);
    expect(p.rings[0].count).toBe(ringCapacity(p.rings[0].radius, p.rings[0].size));
  });

  it("is the same plan whether it has the default mode or the shipped one", () => {
    expect(ringPlan(1440, 900, { stack: 8, long: 35, short: 35 })).toEqual(
      ringPlan(1440, 900, { stack: 8, long: 35, short: 35 }, RING_ORDER_MODE),
    );
  });

  it("paired puts both long rings inside both short rings, with a smaller L than alternating", () => {
    const paired = plan(1440, 900, 35, "paired");
    expect(paired.rings.filter((r) => r.kind !== "stack").map((r) => r.kind)).toEqual(["long", "long", "short", "short"]);
    expect(paired.L).toBeLessThanOrEqual(plan(1440, 900, 35, "alternating").L);
    expect(paired.L).toBeGreaterThanOrEqual(L_MIN);
  });
});

describe("slotAngle", () => {
  it("starts at the top and goes clockwise", () => {
    expect(slotAngle(0, 4)).toBe(-90);
    expect(slotAngle(1, 4)).toBe(0);
    expect(slotAngle(2, 4)).toBe(90);
  });

  it("copes with no slots", () => {
    expect(slotAngle(0, 0)).toBe(-90);
  });
});
