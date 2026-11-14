import { describe, expect, it } from "vitest";
import {
  DOT_ALPHA_MAX,
  DOT_ALPHA_MIN,
  DOT_SIZE_MAX,
  DOT_SIZE_MIN,
  DOT_STEP,
  dotAt,
  paintDots,
} from "./dot-field";

describe("dotAt", () => {
  it("stays inside the preview's bounds everywhere, at every time", () => {
    for (let x = 3.5; x < 3000; x += 97) {
      for (let y = 3.5; y < 2000; y += 83) {
        for (const t of [0, 1.7, 30, 600, 86400, 1e6]) {
          const d = dotAt(x, y, t);
          expect(d.size).toBeGreaterThanOrEqual(DOT_SIZE_MIN - 1e-12);
          expect(d.size).toBeLessThanOrEqual(DOT_SIZE_MAX + 1e-12);
          expect(d.alpha).toBeGreaterThanOrEqual(DOT_ALPHA_MIN - 1e-12);
          expect(d.alpha).toBeLessThanOrEqual(DOT_ALPHA_MAX + 1e-12);
        }
      }
    }
    expect(DOT_STEP).toBe(7);
    expect([DOT_SIZE_MIN, DOT_SIZE_MAX]).toEqual([0.8, 1.7]);
    expect([DOT_ALPHA_MIN, DOT_ALPHA_MAX]).toEqual([0.022, 0.097]);
  });

  it("makes a bigger dot a stronger one", () => {
    const a = dotAt(100, 100, 0);
    const b = dotAt(380, 40, 12);
    expect(a.size > b.size).toBe(a.alpha > b.alpha);
  });

  it("swells slowly: a dot changes by under 6% of its range in a second", () => {
    for (const [x, y] of [[10, 10], [500, 300], [1200, 800]]) {
      const a = dotAt(x, y, 5).alpha;
      const b = dotAt(x, y, 6).alpha;
      expect(Math.abs(a - b)).toBeLessThan(0.06 * (DOT_ALPHA_MAX - DOT_ALPHA_MIN));
    }
  });

  it("is moving: the same dot looks different half a minute apart", () => {
    expect(dotAt(300, 200, 0).alpha).not.toBeCloseTo(dotAt(300, 200, 30).alpha, 3);
  });
});

/** A 2D context that only records what paintDots asks of it. */
function recorder() {
  const rects: number[][] = [];
  const fills: string[] = [];
  let style = "";
  const ctx = {
    clearRect: () => {},
    beginPath: () => {},
    rect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]),
    fill: () => fills.push(style),
    set fillStyle(v: string) {
      style = v;
    },
    get fillStyle() {
      return style;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, fills };
}

describe("paintDots", () => {
  it("puts one dot on every 7 px cell, inside the area, in at most 16 fills", () => {
    const { ctx, rects, fills } = recorder();
    paintDots(ctx, 700, 350, 3);
    expect(rects).toHaveLength(100 * 50);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.length).toBeLessThanOrEqual(16);
    for (const [x, y, w, h] of rects) {
      expect(w).toBeGreaterThanOrEqual(DOT_SIZE_MIN - 1e-9);
      expect(w).toBeLessThanOrEqual(DOT_SIZE_MAX + 1e-9);
      expect(h).toBe(w);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(700);
      expect(y + h).toBeLessThanOrEqual(350);
    }
    for (const f of fills) {
      const alpha = Number(/,([\d.]+)\)$/.exec(f)?.[1]);
      expect(alpha).toBeGreaterThanOrEqual(DOT_ALPHA_MIN - 1e-9);
      expect(alpha).toBeLessThanOrEqual(DOT_ALPHA_MAX + 1e-9);
    }
  });

  it("draws nothing for an area with no room, and works for a small frame", () => {
    const empty = recorder();
    paintDots(empty.ctx, 0, 0, 0);
    expect(empty.rects).toHaveLength(0);
    const small = recorder();
    paintDots(small.ctx, 20, 20, 0);
    expect(small.rects).toHaveLength(3 * 3);
  });
});
