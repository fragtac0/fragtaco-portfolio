import { describe, expect, it } from "vitest";
import { aheadTrail, basisCurve, catmullRom, lowerTrail, MILESTONE_SHARES, sampleCurves, sampleTrail, sharesFor, trailAt, type Point, type TrailPoint } from "./trail";

// The first route of content/site/experience.json in map units, and the summit.
const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const SUMMIT: Point = [500, 325];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("lowerTrail", () => {
  const lowered = lowerTrail(ROUTE, SUMMIT);

  it("leaves the first point where it is", () => {
    expect(lowered[0]).toEqual(ROUTE[0]);
  });

  it("moves the last point 40% further from the summit, on the same line", () => {
    const last = lowered[lowered.length - 1];

    expect(dist(last, SUMMIT)).toBeCloseTo(1.4 * dist(ROUTE[10], SUMMIT), 9);
    expect(last[0]).toBeCloseTo(441.34, 6);
    expect(last[1]).toBeCloseTo(382.68, 6);
  });

  it("pushes the middle by 1 + 0.4 * t^1.2, the later ones more", () => {
    expect(dist(lowered[5], SUMMIT)).toBeCloseTo((1 + 0.4 * 0.5 ** 1.2) * dist(ROUTE[5], SUMMIT), 9);
    const growth = lowered.map((p, i) => dist(p, SUMMIT) / dist(ROUTE[i], SUMMIT));

    for (let i = 1; i < growth.length; i++) expect(growth[i]).toBeGreaterThan(growth[i - 1]);
  });

  it("does not change its input and copes with one point", () => {
    expect(ROUTE[10]).toEqual([458.1, 366.2]);
    expect(lowerTrail([[10, 20]], SUMMIT)).toEqual([[10, 20]]);
  });
});

describe("the curve (the same as d3's centripetal Catmull-Rom, alpha 0.5)", () => {
  // Control points d3-shape 3.2 gives for the lowered route (rounded to 3 decimals).
  const curves = catmullRom(lowerTrail(ROUTE, SUMMIT));
  const near = (got: number[], want: number[]) => got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 2));

  it("has a curve between each pair of points", () => {
    expect(curves).toHaveLength(10);
  });

  it("starts flat, with a control point on the first point", () => {
    near(curves[0], [639.5, 329.6, 639.5, 329.6, 627.357, 328.858, 622.208, 329.101]);
  });

  it("matches the middle curves", () => {
    near(curves[1], [622.208, 329.101, 618.025, 329.298, 614.75, 329.868, 610.877, 330.502]);
    near(curves[4], [589.75, 352.65, 585.827, 362.316, 583.083, 375.879, 576.904, 386.289]);
  });

  it("ends flat, with a control point on the last point", () => {
    near(curves[9], [457.937, 399.928, 451.371, 394.898, 441.34, 382.68, 441.34, 382.68]);
  });

  it("has no curves for fewer than two points", () => {
    expect(catmullRom([[1, 1]])).toEqual([]);
  });
});

describe("the basis curve (the dotted part ahead)", () => {
  it("is a line, two curves and a line, as d3.curveBasis draws three points", () => {
    const end: Point = [441.34, 382.68];
    const curves = basisCurve([end, [(end[0] + SUMMIT[0]) / 2 - 20, (end[1] + SUMMIT[1]) / 2 - 22], SUMMIT]);

    expect(curves).toHaveLength(4);
    expect(curves[0].slice(6)).toEqual([curves[1][0], curves[1][1]]);
    expect(curves[1].slice(6).map((v) => +v.toFixed(3))).toEqual([457.337, 339.173]);
    expect(curves[2].slice(6).map((v) => +v.toFixed(3))).toEqual([491.778, 326.14]);
    expect(curves[3].slice(6)).toEqual([500, 325]);
  });
});

describe("sampleTrail", () => {
  const lowered = lowerTrail(ROUTE, SUMMIT);
  const samples = sampleTrail(lowered, 200);

  it("gives n + 1 points from the first point to the last, heights 0", () => {
    expect(samples).toHaveLength(201);
    expect(samples[0].x).toBeCloseTo(lowered[0][0], 9);
    expect(samples[0].y).toBeCloseTo(lowered[0][1], 9);
    expect(samples[200].x).toBeCloseTo(441.34, 6);
    expect(samples[200].y).toBeCloseTo(382.68, 6);
    expect(samples.every((p) => p.n === 0)).toBe(true);
  });

  it("goes through every point it was given", () => {
    const fine = sampleTrail(lowered, 4000);

    for (const p of lowered) expect(Math.min(...fine.map((s) => dist([s.x, s.y], p)))).toBeLessThan(0.15);
  });

  it("steps equal distances along the line, to within the flattening", () => {
    const steps = samples.slice(1).map((p, i) => dist([p.x, p.y], [samples[i].x, samples[i].y]));
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;

    for (const s of steps) expect(Math.abs(s - mean) / mean).toBeLessThan(0.12);
  });

  it("has the length of d3's path (262.511 units, measured on the control points d3 gives) and its middle where d3's path has it", () => {
    const fine = sampleTrail(lowered, 3000);
    const length = fine.slice(1).reduce((n, p, i) => n + dist([p.x, p.y], [fine[i].x, fine[i].y]), 0);

    expect(length).toBeCloseTo(262.511, 1);
    expect(samples[100].x).toBeCloseTo(557.866, 1);
    expect(samples[100].y).toBeCloseTo(411.567, 1);
  });
});

describe("sampleCurves", () => {
  it("samples a straight line at equal steps", () => {
    const pts = sampleCurves([[0, 0, 0, 0, 10, 0, 10, 0]], 5);

    expect(pts.map((p) => +p[0].toFixed(6))).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe("aheadTrail", () => {
  it("runs from the end of the trail to the summit in 61 points", () => {
    const ahead = aheadTrail([441.34, 382.68], SUMMIT);

    expect(ahead).toHaveLength(61);
    expect(ahead[0].x).toBeCloseTo(441.34, 6);
    expect(ahead[60].x).toBeCloseTo(500, 6);
    expect(ahead[60].y).toBeCloseTo(325, 6);
  });
});

describe("trailAt", () => {
  const samples: TrailPoint[] = [
    { x: 0, y: 0, n: 0 },
    { x: 10, y: 20, n: 0.5 },
    { x: 30, y: 20, n: 1 },
  ];

  it("gives the sample at the ends and a mix between", () => {
    expect(trailAt(samples, 0)).toEqual(samples[0]);
    expect(trailAt(samples, 1)).toEqual(samples[2]);
    expect(trailAt(samples, 0.25)).toEqual({ x: 5, y: 10, n: 0.25 });
    expect(trailAt(samples, 0.75)).toEqual({ x: 20, y: 20, n: 0.75 });
  });

  it("holds at the ends outside 0 to 1", () => {
    expect(trailAt(samples, -3)).toEqual(samples[0]);
    expect(trailAt(samples, 7)).toEqual(samples[2]);
  });
});

describe("MILESTONE_SHARES", () => {
  it("are nine, rising from 0 to 1", () => {
    expect([...MILESTONE_SHARES]).toEqual([0, 0.3, 0.38, 0.48, 0.58, 0.66, 0.8, 0.93, 1]);
  });
});

describe("sharesFor", () => {
  it("is the nine shares of the design for nine milestones", () => {
    expect(sharesFor(9)).toEqual([...MILESTONE_SHARES]);
  });

  it("spreads any other number evenly from 0 to 1", () => {
    expect(sharesFor(3)).toEqual([0, 0.5, 1]);
    expect(sharesFor(2)).toEqual([0, 1]);
    expect(sharesFor(1)).toEqual([1]);
  });
});
