import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawLedge, ledgeHeight, ledgeLines, ledgeStroke, LEDGE_H } from "./ledge";

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
    expect(lines).toHaveLength(10);
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

/** Path2D is not in Node: a stand-in that keeps the path text. */
class FakePath2D {
  constructor(readonly d: string) {}
}

/** A 2D context that records the order of what drawLedge asks of it. */
function recorder() {
  const ops: string[] = [];
  const strokes: { color: string; width: number; d: string }[] = [];
  const stops: [number, string][] = [];
  const fillRects: number[][] = [];
  const state = { strokeStyle: "", lineWidth: 0, composite: "source-over" };
  const ctx = {
    setTransform: (...a: number[]) => ops.push(`transform ${a.join(",")}`),
    clearRect: () => ops.push("clear"),
    lineJoin: "",
    set strokeStyle(v: string) {
      state.strokeStyle = v;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    stroke: (p: FakePath2D) => {
      ops.push("stroke");
      strokes.push({ color: state.strokeStyle, width: state.lineWidth, d: p.d });
    },
    createLinearGradient: (...a: number[]) => {
      ops.push(`gradient ${a.join(",")}`);
      return { addColorStop: (at: number, c: string) => stops.push([at, c]) };
    },
    set globalCompositeOperation(v: string) {
      state.composite = v;
      ops.push(`composite ${v}`);
    },
    set fillStyle(_v: unknown) {},
    fillRect: (...a: number[]) => {
      ops.push(`fillRect@${state.composite}`);
      fillRects.push(a);
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops, strokes, stops, fillRects };
}

describe("drawLedge", () => {
  beforeEach(() => {
    vi.stubGlobal("Path2D", FakePath2D);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strokes the ten lines with ledgeStroke's colours and widths, fades the ends, and leaves the transform reset", () => {
    const r = recorder();
    drawLedge(r.ctx, 1000, 74, 2, 2);
    const lines = ledgeLines(1000, 0, 74);
    expect(r.strokes).toHaveLength(10);
    r.strokes.forEach((st, i) => {
      expect(st.color).toBe(ledgeStroke(lines[i]).color);
      expect(st.width).toBe(ledgeStroke(lines[i]).width);
      expect(st.d).toBe(lines[i].d);
    });
    // scaled to device pixels first, the whole canvas cleared, then the strokes
    expect(r.ops[0]).toBe("transform 2,0,0,2,0,0");
    expect(r.ops[1]).toBe("clear");
    expect(r.ops.slice(2, 12)).toEqual(Array(10).fill("stroke"));
    // then the fade: a gradient across the width, destination-in, one fill of the whole box
    expect(r.ops.slice(12)).toEqual([
      "gradient 0,0,1000,0",
      "composite destination-in",
      "fillRect@destination-in",
      "composite source-over",
      "transform 1,0,0,1,0,0",
    ]);
    expect(r.fillRects).toEqual([[0, 0, 1000, 74]]);
    expect(r.stops.map(([at]) => at)).toEqual([0, 0.06, 0.94, 1]);
    expect(r.stops.map(([, c]) => c)).toEqual(["rgba(0,0,0,0)", "rgba(0,0,0,1)", "rgba(0,0,0,1)", "rgba(0,0,0,0)"]);
  });
});
