import { describe, expect, it } from "vitest";
import {
  LATS,
  LONS,
  chartAlpha,
  crossInk,
  gridBoost,
  gridCrosses,
  gridInk,
  gridLift,
  gridLines,
  latitudeLabels,
  longitudeLabels,
  readout,
  ringLabelAt,
  ringPoints,
  ringRadius,
  scaleBar,
} from "./chart";
import { OVERVIEW, viewOf, type Stage } from "./view";
import { lowerTrail, sampleTrail, type Point } from "./trail";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const STAGE: Stage = { w: 1440, h: 900 };
const trail = sampleTrail(lowerTrail(ROUTE, [500, 325]), 200);
const overview = viewOf({ ...OVERVIEW, trail }, 0, 1, STAGE);

describe("the grid", () => {
  const lines = gridLines();
  const vertical = lines.filter((l) => l.pts[0].x === l.pts[1].x);
  const horizontal = lines.filter((l) => l.pts[0].y === l.pts[1].y);

  it("has a line every 2.5 degrees inside the height frame: 26 of longitude and 16 of latitude", () => {
    expect(LONS.slice(0, 3)).toEqual([190, 192.5, 195]);
    expect(LATS.slice(0, 3)).toEqual([-5, -2.5, 0]);
    expect(vertical).toHaveLength(26);
    expect(horizontal).toHaveLength(16);
  });

  it("is strong on every fifth degree: half of each", () => {
    expect(vertical.filter((l) => l.major)).toHaveLength(13);
    expect(horizontal.filter((l) => l.major)).toHaveLength(8);
  });

  it("is a point every 8 units along each line, across the whole frame", () => {
    expect(vertical[0].pts).toHaveLength(131);
    expect(vertical[0].pts[0].y).toBe(-195);
    expect(vertical[0].pts[130].y).toBe(845);
    expect(horizontal[0].pts).toHaveLength(201);
    expect(horizontal[0].pts[0].x).toBe(-300);
    expect(horizontal[0].pts[200].x).toBe(1300);
    expect(vertical[0].pts[1].y - vertical[0].pts[0].y).toBe(8);
  });

  it("puts the lines at the right places (the summit's meridian is not a line; 230 E is)", () => {
    const xs = vertical.map((l) => l.pts[0].x);

    expect(xs.some((x) => Math.abs(x - (230 - 206.795) * 25) < 1e-6)).toBe(true);
    expect(xs.some((x) => Math.abs(x - (226.795 - 206.795) * 25) < 1e-6)).toBe(false);
    expect(xs[0]).toBeCloseTo((195 - 206.795) * 25, 9);
  });

  it("starts with heights 0, for the engine to fill in", () => {
    expect(lines.every((l) => l.pts.every((p) => p.n === 0))).toBe(true);
  });

  it("has a small cross where two strong lines meet: 13 by 8", () => {
    const crosses = gridCrosses();

    expect(crosses).toHaveLength(104);
    for (const c of crosses) {
      expect(c.x).toBeGreaterThan(-300);
      expect(c.x).toBeLessThan(1300);
    }
  });

  it("has ink that is stronger over the dark ground (2.6 times in My climb) and a lift of half a unit when risen", () => {
    expect(gridBoost(0)).toBe(1);
    expect(gridBoost(1)).toBeCloseTo(2.6, 12);
    expect(gridInk(true, 1)).toBe("rgba(253,252,230,0.07)");
    expect(gridInk(false, 1)).toBe("rgba(253,252,230,0.04)");
    expect(crossInk(1)).toBe("rgba(253,252,230,0.26)");
    expect(crossInk(5)).toBe("rgba(253,252,230,0.42)");
    expect(gridLift(1)).toBe(0.5);
    expect(gridLift(0)).toBe(0);
  });
});

describe("the chart marks of the overview", () => {
  it("fade exactly as the picture does", () => {
    expect(chartAlpha(0)).toBe(1);
    expect(chartAlpha(0.12)).toBe(1);
    expect(chartAlpha(0.85)).toBe(0);
    expect(chartAlpha(0.485)).toBeCloseTo(0.5, 6);
  });

  it("has rings of 150 and 300 km, 2.372 km to a unit", () => {
    expect(ringRadius(150)).toBeCloseTo(63.2377, 3);
    expect(ringRadius(300)).toBeCloseTo(126.4755, 3);
  });

  it("makes a ring of 97 points round the summit, closed", () => {
    const pts = ringPoints([500, 325], 150);

    expect(pts).toHaveLength(97);
    for (const p of pts) expect(Math.hypot(p[0] - 500, p[1] - 325)).toBeCloseTo(63.2377, 3);
    expect(pts[0][0]).toBeCloseTo(pts[96][0], 2);
    expect(pts[0][1]).toBeCloseTo(pts[96][1], 2);
    expect(pts[24][1]).toBeCloseTo(325 + 63.2377, 2);
  });

  it("puts a ring's label up and right at 45 degrees", () => {
    const [x, y] = ringLabelAt([500, 325], 150);

    expect(x).toBeCloseTo(500 + 63.2377 * 0.7071, 3);
    expect(y).toBeCloseTo(325 - 63.2377 * 0.7071, 3);
  });
});

describe("the degree labels", () => {
  it("run along the right edge, every 5 degrees of latitude that are inside the stage's top and foot margins", () => {
    const labels = latitudeLabels(overview, STAGE);

    expect(labels.length).toBeGreaterThan(2);
    for (const l of labels) {
      expect(l.x).toBe(STAGE.w - 16);
      expect(l.y).toBeGreaterThan(84 - 7);
      expect(l.y).toBeLessThan(STAGE.h - 80 - 7);
      expect(l.text).toMatch(/^\d+° N$/);
    }
    expect(labels.map((l) => l.text)).toContain("20° N");
    expect(labels.map((l) => l.text)).not.toContain("22.5° N");
  });

  it("run along part of the foot, right of the middle and clear of the scale bar", () => {
    const labels = longitudeLabels(overview, STAGE);

    expect(labels.length).toBeGreaterThan(1);
    for (const l of labels) {
      expect(l.y).toBe(STAGE.h - 16);
      expect(l.x).toBeGreaterThan(STAGE.w * 0.5);
      expect(l.x).toBeLessThan(STAGE.w - 250 + 5);
      expect(l.text).toMatch(/^\d+° E$/);
    }
  });
});

describe("scaleBar", () => {
  it("is 200 km long on the ground, ends 24 px from the right edge and sits 44 px above the foot", () => {
    const S = 1.584;
    const bar = scaleBar(S, STAGE);
    const length = (200 / 2.372) * S;

    expect(bar.x1).toBe(1416);
    expect(bar.x1 - bar.x0).toBeCloseTo(length, 9);
    expect(bar.y).toBe(856);
    expect(bar.ticks).toHaveLength(3);
    expect(bar.ticks[0]).toBeCloseTo(bar.x0, 9);
    expect(bar.ticks[1]).toBeCloseTo((bar.x0 + bar.x1) / 2, 9);
    expect(bar.ticks[2]).toBeCloseTo(bar.x1, 9);
    expect(bar.zeroLabel).toEqual({ text: "0", x: bar.x0 - 2, y: 845 });
    expect(bar.endLabel).toEqual({ text: "200 km", x: 1418, y: 845 });
  });

  it("grows with the zoom", () => {
    expect(scaleBar(3, STAGE).x1 - scaleBar(3, STAGE).x0).toBeGreaterThan(scaleBar(1.5, STAGE).x1 - scaleBar(1.5, STAGE).x0);
  });
});

describe("readout", () => {
  it("gives latitude and longitude with two decimals, as the preview does", () => {
    expect(readout(500, 325)).toBe("18.37° N   226.79° E");
    expect(readout(0, 0)).toBe("31.37° N   206.79° E");
    expect(readout(1000, 650)).toBe("5.37° N   246.79° E");
  });
});
