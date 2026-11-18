import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("swells slowly: no dot changes by more than 8.5% of its range in a second, anywhere", () => {
    // the fastest the strength can move: 0.27 * 0.2 + 0.23 * 0.13 = 0.0839 of the range per second
    let worst = 0;
    for (let x = 3.5; x < 1500; x += 41) {
      for (let y = 3.5; y < 900; y += 37) {
        for (const t of [0, 3.3, 11, 29.5, 100, 4000]) {
          const a = dotAt(x, y, t).alpha;
          const b = dotAt(x, y, t + 1).alpha;
          worst = Math.max(worst, Math.abs(a - b) / (DOT_ALPHA_MAX - DOT_ALPHA_MIN));
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(0.085);
    // and the sweep is not vacuous: somewhere it does move at close to that rate
    expect(worst).toBeGreaterThan(0.04);
  });

  it("is moving: the same dot looks different half a minute apart", () => {
    expect(dotAt(300, 200, 0).alpha).not.toBeCloseTo(dotAt(300, 200, 30).alpha, 3);
  });
});

/** Path2D is not in Node: a stand-in that keeps the rectangles added to it. */
class FakePath2D {
  rects: number[][] = [];
  rect(x: number, y: number, w: number, h: number) {
    this.rects.push([x, y, w, h]);
  }
}

/** A 2D context that only records what paintDots asks of it: each fill with its colour and the rectangles of its path. */
function recorder() {
  const rects: number[][] = [];
  const fills: string[] = [];
  const fillRects: number[][][] = [];
  let style = "";
  const ctx = {
    clearRect: () => {},
    fill: (path: FakePath2D) => {
      fills.push(style);
      fillRects.push(path.rects);
      rects.push(...path.rects);
    },
    set fillStyle(v: string) {
      style = v;
    },
    get fillStyle() {
      return style;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, fills, fillRects };
}

describe("paintDots", () => {
  beforeEach(() => {
    vi.stubGlobal("Path2D", FakePath2D);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("paints each dot with the rule dotAt gives (to one of 16 steps), and a fill is one colour and one size", () => {
    const { ctx, fills, fillRects } = recorder();
    paintDots(ctx, 350, 210, 12.5);
    const step = (DOT_SIZE_MAX - DOT_SIZE_MIN) / 15;
    fillRects.forEach((rs, n) => {
      const alpha = Number(/,([\d.]+)\)$/.exec(fills[n])?.[1]);
      for (const [x, y, w] of rs) {
        const d = dotAt(x + w / 2, y + w / 2, 12.5);
        expect(Math.abs(w - d.size)).toBeLessThanOrEqual(step / 2 + 1e-9);
        expect(w).toBeCloseTo(rs[0][2], 9);
        // the colour is the one the size asks for (alpha is written to three places)
        const f = (w - DOT_SIZE_MIN) / (DOT_SIZE_MAX - DOT_SIZE_MIN);
        expect(alpha).toBeCloseTo(DOT_ALPHA_MIN + (DOT_ALPHA_MAX - DOT_ALPHA_MIN) * f, 3);
      }
    });
    expect(fills.every((f) => f.startsWith("rgba(253,252,230,"))).toBe(true);
  });
});
