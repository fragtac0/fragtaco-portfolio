import { describe, expect, it } from "vitest";
import { buildLevels, fillOf, strokeOf, thresholdsOf, type Level } from "./contours";
import { makeField } from "./heights";
import { HEIGHT_FRAME } from "./frame";

/** A cone of grey: 240 at the peak (the middle), falling to 0 at `radius` cells, on a w by h grid. */
function cone(w: number, h: number, radius: number, top = 240): number[] {
  const out: number[] = [];
  const [cx, cy] = [(w - 1) / 2, (h - 1) / 2];

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push(Math.round(top * Math.max(0, 1 - Math.hypot(x - cx, y - cy) / radius) * 100) / 100);

  return out;
}

const W = 80;
const H = 52;
const field = makeField(cone(W, H, 30), W, H, 0);
const levels: Level[] = buildLevels(field);

describe("thresholdsOf", () => {
  it("is a level every 3 grey steps from half a step above the lowest whole grey, up to but not including the highest", () => {
    const t = thresholdsOf({ lo: 0, hi: 240 });

    expect(t[0]).toBe(0.5);
    expect(t[1]).toBe(3.5);
    expect(t[t.length - 1]).toBe(237.5);
    expect(t).toHaveLength(80);
    expect(thresholdsOf({ lo: 12.2, hi: 30 })[0]).toBe(13.5);
  });
});

describe("buildLevels", () => {
  it("makes a level for each threshold that crosses the field, lowest first", () => {
    expect(levels.length).toBeGreaterThan(70);
    for (let i = 1; i < levels.length; i++) expect(levels[i].n).toBeGreaterThan(levels[i - 1].n);
  });

  it("gives n as the height between the plain and the summit", () => {
    const top = levels[levels.length - 1];

    expect(top.n).toBeGreaterThan(0.9);
    expect(top.n).toBeLessThan(1);
    expect(levels[0].n).toBeLessThan(0.1);
  });

  it("makes every fifth line stronger", () => {
    levels.forEach((l, i) => expect(l.width).toBe(i % 5 === 0 ? 1.4 : 0.8));
  });

  it("puts rings in map units, inside the height frame", () => {
    const { x0, y0, w, h } = HEIGHT_FRAME;

    for (const l of levels) {
      expect(l.rings.length).toBeGreaterThan(0);
      for (const ring of l.rings) {
        for (let i = 0; i < ring.length; i += 2) {
          expect(ring[i]).toBeGreaterThanOrEqual(x0);
          expect(ring[i]).toBeLessThanOrEqual(x0 + w);
          expect(ring[i + 1]).toBeGreaterThanOrEqual(y0);
          expect(ring[i + 1]).toBeLessThanOrEqual(y0 + h);
        }
      }
    }
  });

  it("makes closed rings round the peak, at the radius the cone gives, centred on the summit", () => {
    const l = levels[40];
    const ring = l.rings[0];
    const radii: number[] = [];

    expect(ring[0]).toBeCloseTo(ring[ring.length - 2], 4);
    expect(ring[1]).toBeCloseTo(ring[ring.length - 1], 4);
    for (let i = 0; i < ring.length; i += 2) radii.push(Math.hypot(ring[i] - 500, ring[i + 1] - 325));
    // The level is at grey 3 * 40 + 0.5 = 120.5: the cone is at that grey where r = 30 * (1 - 120.5 / 240) cells.
    const cells = 30 * (1 - 120.5 / 240);
    const units = (cells * HEIGHT_FRAME.w) / W;
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;

    expect(Math.abs(mean - units) / units).toBeLessThan(0.06);
  });

  it("makes more rings or longer ones lower down", () => {
    const length = (l: Level) => l.rings.reduce((n, r) => n + r.length, 0);

    expect(length(levels[5])).toBeGreaterThan(length(levels[70]));
  });
});

describe("colours", () => {
  it("fill: a deep brown that warms a little with height", () => {
    expect(fillOf(0)).toBe("rgb(15, 14, 13)");
    expect(fillOf(1)).toBe("rgb(33, 22, 15)");
    expect(fillOf(-0.05)).toBe("rgb(15, 14, 13)");
    expect(fillOf(2)).toBe("rgb(33, 22, 15)");
  });

  it("stroke: faint ink on the plain, strong on every fifth line", () => {
    expect(strokeOf(0.01, true)).toBe("rgba(253,252,230,0.2)");
    expect(strokeOf(0.01, false)).toBe("rgba(253,252,230,0.11)");
    expect(strokeOf(-0.05, false)).toBe("rgba(253,252,230,0.11)");
  });

  it("stroke: cream climbing to the first third, then fire to the top", () => {
    expect(strokeOf(0.05, false)).toBe("rgba(253, 241, 216, 0.336)");
    expect(strokeOf(0.45, false)).toBe("rgba(255, 190, 130, 0.7)");
    expect(strokeOf(1, false)).toBe("rgb(255, 118, 40)");
    expect(strokeOf(0.725, true)).toBe("rgba(255, 154, 85, 0.85)");
  });
});
