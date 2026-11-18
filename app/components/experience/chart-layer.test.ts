import { describe, expect, it } from "vitest";
import { gridBoost, gridCrosses, gridLines, gridLift, RINGS_KM, ringPoints } from "./chart";
import { CROSS_ARM, RING_ALPHA, RING_DASH, SUMMIT_ALPHA, SUMMIT_MARK, drawChart, drawGrid, drawOverviewMarks, makeChart, setChartHeights } from "./chart-layer";
import { liftOf, makeField } from "./heights";
import { alphaOf, testCanvas } from "./test-canvas";
import { lowerTrail, sampleTrail, type Point } from "./trail";
import { OVERVIEW, project, viewOf, type Stage } from "./view";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const STAGE: Stage = { w: 1440, h: 900 };
const trail = sampleTrail(lowerTrail(ROUTE, [500, 325]), 200);
const cam = { ...OVERVIEW, trail };
const overview = viewOf(cam, 0, 1, STAGE);
const climb = viewOf(cam, 1, 0.8, STAGE);
const SUMMIT: [number, number] = [500, 325];

/** A hill of height 1 in the middle of the height frame, for the grid to take its height from. */
const hill = () => {
  const [w, h] = [80, 52];
  const grey: number[] = [];

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grey.push(240 * Math.max(0, 1 - Math.hypot(x - (w - 1) / 2, y - (h - 1) / 2) / 30));

  return makeField(grey, w, h, 0);
};

describe("the chart", () => {
  it("has the grid's lines and crosses, with no heights until they are read", () => {
    const chart = makeChart();

    expect(chart.lines).toHaveLength(gridLines().length);
    expect(chart.crosses).toHaveLength(gridCrosses().length);
    expect(chart.lines.every((l) => l.pts.every((p) => p.n === 0))).toBe(true);
  });

  it("takes the height under each point of every line and cross once the heights are read", () => {
    const chart = makeChart();

    setChartHeights(chart, hill());

    const heights = chart.lines.flatMap((l) => l.pts.map((p) => p.n));

    expect(Math.max(...heights)).toBeGreaterThan(0.5);
    expect(chart.lines.some((l) => l.pts.some((p) => p.n > 0.3))).toBe(true);
    expect(chart.crosses.every((c) => Number.isFinite(c.n))).toBe(true);
  });
});

describe("drawGrid", () => {
  const chart = makeChart();

  setChartHeights(chart, hill());

  it("strokes each line with its own ink (every fifth stronger) and the crosses in one stroke", () => {
    const { c, strokes } = testCanvas();

    drawGrid(c, overview, chart);
    expect(strokes).toHaveLength(chart.lines.length + 1);
    expect(strokes.slice(0, chart.lines.length).map((s) => alphaOf(s.style))).toEqual(chart.lines.map((l) => +((l.major ? 0.07 : 0.04) * 1).toFixed(4)));
    expect(alphaOf(strokes[chart.lines.length].style)).toBeCloseTo(0.26, 6);
    expect(strokes[0].points).toHaveLength(chart.lines[0].pts.length);
    expect(strokes[chart.lines.length].points).toHaveLength(chart.crosses.length * 4);
  });

  it("is flat in the overview: every point is where the ground is (height 0)", () => {
    const { c, strokes } = testCanvas();

    drawGrid(c, overview, chart);
    chart.lines[3].pts.forEach((p, i) => {
      const [x, y] = project(overview, p.x, p.y, 0);

      expect(strokes[3].points[i][0]).toBeCloseTo(x, 9);
      expect(strokes[3].points[i][1]).toBeCloseTo(y, 9);
    });
  });

  it("lies over the mountain in My climb: each point takes the height under it, and half a unit more", () => {
    const { c, strokes } = testCanvas();

    drawGrid(c, climb, chart);

    const line = chart.lines.findIndex((l) => l.pts.some((p) => p.n > 0.5));
    const high = chart.lines[line].pts.findIndex((p) => p.n > 0.5);
    const p = chart.lines[line].pts[high];
    const flat = project(climb, p.x, p.y, 0);

    expect(strokes[line].points[high][1]).toBeLessThan(flat[1] - 10); // up the screen, on the mountain

    const [x, y] = project(climb, p.x, p.y, liftOf(p.n, climb.rise) + gridLift(climb.rise));

    expect(strokes[line].points[high][0]).toBeCloseTo(x, 9);
    expect(strokes[line].points[high][1]).toBeCloseTo(y, 9);
  });

  it("takes more ink over the dark ground of My climb, the crosses capped at 42%", () => {
    const { c, strokes } = testCanvas();

    drawGrid(c, climb, chart);

    const boost = gridBoost(climb.k);

    expect(boost).toBeCloseTo(2.6, 10);
    expect(alphaOf(strokes[0].style)).toBeCloseTo((chart.lines[0].major ? 0.07 : 0.04) * 2.6, 3);
    expect(alphaOf(strokes[chart.lines.length].style)).toBeCloseTo(0.42, 6); // 0.26 * 2.6 = 0.676, capped
  });

  it("makes each cross of two arms of 4.5 px", () => {
    const { c, strokes } = testCanvas();

    drawGrid(c, overview, chart);

    const pts = strokes[chart.lines.length].points;

    expect(pts[1][0] - pts[0][0]).toBeCloseTo(2 * CROSS_ARM, 9);
    expect(pts[3][1] - pts[2][1]).toBeCloseTo(2 * CROSS_ARM, 9);
  });
});

describe("drawOverviewMarks", () => {
  it("draws nothing once the picture is gone", () => {
    const { c, strokes } = testCanvas();

    drawOverviewMarks(c, overview, SUMMIT, 0);
    drawOverviewMarks(c, overview, SUMMIT, 0.01);
    expect(strokes).toHaveLength(0);
  });

  it("draws two dotted rings of 150 and 300 km round the summit, and a small triangle on it, all at the picture's strength", () => {
    const { c, strokes } = testCanvas();

    drawOverviewMarks(c, overview, SUMMIT, 0.5);
    expect(strokes).toHaveLength(RINGS_KM.length + 1);
    RINGS_KM.forEach((km, i) => {
      expect(strokes[i].dash).toEqual(RING_DASH);
      expect(strokes[i].points).toHaveLength(ringPoints([500, 325], km).length);
      expect(alphaOf(strokes[i].style)).toBeCloseTo(RING_ALPHA * 0.5, 9);
    });

    const [sx, sy] = project(overview, 500, 325, 0);
    const triangle = strokes[RINGS_KM.length];

    expect(triangle.dash).toEqual([]); // plain
    expect(triangle.points[0]).toEqual([sx, sy - SUMMIT_MARK.top]);
    expect(triangle.points[1]).toEqual([sx + SUMMIT_MARK.half, sy + SUMMIT_MARK.foot]);
    expect(alphaOf(triangle.style)).toBeCloseTo(SUMMIT_ALPHA * 0.5, 9);
  });

  it("dots the rings 1 on, 4 off, and is plain again after each", () => {
    const { c, dashes } = testCanvas();

    drawOverviewMarks(c, overview, SUMMIT, 1);
    expect(dashes).toEqual([RING_DASH, [], RING_DASH, []]);
    expect(RING_DASH).toEqual([1, 4]);
  });

  it("puts the rings round the summit on the screen: the 150 km ring is 63.2 map units across the middle", () => {
    const { c, strokes } = testCanvas();

    drawOverviewMarks(c, overview, SUMMIT, 1);

    const xs = strokes[0].points.map((p) => p[0]);
    const [cx] = project(overview, 500, 325, 0);

    expect(Math.max(...xs) - cx).toBeCloseTo(63.2377 * overview.S, 0);
  });
});

describe("drawChart", () => {
  it("draws the grid, then the overview's marks", () => {
    const chart = makeChart();
    const { c, strokes } = testCanvas();

    drawChart(c, overview, chart, SUMMIT, 1);
    expect(strokes).toHaveLength(chart.lines.length + 1 + RINGS_KM.length + 1);
  });

  it("draws the grid only in My climb, where the picture is gone", () => {
    const chart = makeChart();
    const { c, strokes } = testCanvas();

    drawChart(c, climb, chart, SUMMIT, 0);
    expect(strokes).toHaveLength(chart.lines.length + 1);
  });
});
