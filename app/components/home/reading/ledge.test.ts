import { describe, expect, it } from "vitest";
import { ledgeHeight, ledgeLines, ledgeStroke, LEDGE_H, LEDGE_LINES } from "./ledge";

/** The y values and x values of a path made of M and L points. */
function points(d: string): { x: number; y: number }[] {
  return d
    .split(/(?=[ML])/)
    .map((p) => p.slice(1).split(",").map(Number))
    .map(([x, y]) => ({ x, y }));
}

describe("ledgeLines", () => {
  it("makes ten lines, top to bottom", () => {
    const lines = ledgeLines(1000);
    expect(lines).toHaveLength(LEDGE_LINES);
    expect(LEDGE_LINES).toBe(10);
    for (let i = 1; i < lines.length; i++) expect(lines[i].y).toBeGreaterThan(lines[i - 1].y);
    expect(lines[0].y).toBeCloseTo(1, 9);
  });

  it("makes the first line straight and bright and the rest fade, warmer and deeper down", () => {
    const lines = ledgeLines(1000);
    const first = points(lines[0].d);
    expect(new Set(first.map((p) => p.y)).size).toBe(1);
    expect(lines[0].alpha).toBeCloseTo(0.85, 9);
    expect(lines[0].warm).toBe(0);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].alpha).toBeLessThan(lines[i - 1].alpha);
      expect(lines[i].alpha).toBeGreaterThan(0);
      if (i > 1) expect(lines[i].warm).toBeGreaterThan(lines[i - 1].warm);
      expect(lines[i].warm).toBeGreaterThan(0);
      expect(lines[i].warm).toBeLessThanOrEqual(1);
      // every other line wavers
      expect(new Set(points(lines[i].d).map((p) => p.y)).size).toBeGreaterThan(5);
    }
    expect(lines[9].alpha).toBeCloseTo(0.15, 9);
  });

  it("wavers more the lower the line", () => {
    const lines = ledgeLines(1000);
    const spread = (i: number) => {
      const ys = points(lines[i].d).map((p) => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(spread(9)).toBeGreaterThan(spread(1));
  });

  it("keeps every point inside the box, its ends on the width, for narrow and wide ledges", () => {
    for (const width of [20, 390, 1000, 1440, 4000]) {
      for (const height of [LEDGE_H, 40, 24]) {
        for (const seed of [0, 1.3, 5]) {
          for (const line of ledgeLines(width, seed, height)) {
            const ps = points(line.d);
            expect(ps[0].x).toBe(0);
            expect(ps[ps.length - 1].x).toBeCloseTo(width, 1);
            for (const p of ps) {
              expect(p.x).toBeGreaterThanOrEqual(0);
              expect(p.x).toBeLessThanOrEqual(width + 0.1);
              expect(p.y).toBeGreaterThanOrEqual(0);
              expect(p.y).toBeLessThanOrEqual(height);
            }
          }
        }
      }
    }
  });

  it("is the same for the same width and seed, and the seed moves the waves", () => {
    expect(ledgeLines(800, 2)).toEqual(ledgeLines(800, 2));
    expect(ledgeLines(800, 2)[3].d).not.toBe(ledgeLines(800, 0)[3].d);
    // the top line is straight for every seed
    expect(ledgeLines(800, 2)[0].d).toBe(ledgeLines(800, 0)[0].d);
  });

  it("squeezes the heights with the height argument", () => {
    const full = ledgeLines(1000, 0, LEDGE_H);
    const half = ledgeLines(1000, 0, LEDGE_H / 2);
    for (let i = 0; i < full.length; i++) expect(half[i].y).toBeCloseTo(full[i].y / 2, 9);
  });
});

describe("ledgeStroke", () => {
  it("draws the top line in cream, a little thicker, and the rest from orange to brown", () => {
    const lines = ledgeLines(1000);
    expect(ledgeStroke(lines[0])).toEqual({ color: "rgba(253,252,230,0.85)", width: 1.3 });
    const second = ledgeStroke(lines[1]);
    const last = ledgeStroke(lines[9]);
    expect(second.width).toBe(0.9);
    expect(second.color).toBe("rgba(248,141,74,0.68)");
    expect(last.color).toBe("rgba(195,70,30,0.15)");
  });
});

describe("ledgeHeight", () => {
  it("is 74 px when there is room under the feet and what is left when there is not", () => {
    expect(ledgeHeight(900, 810)).toBe(74);
    expect(ledgeHeight(844, 760)).toBe(74);
    expect(ledgeHeight(390, 350)).toBe(40);
    expect(ledgeHeight(500, 500)).toBe(0);
    expect(ledgeHeight(500, 560)).toBe(0);
  });
});
