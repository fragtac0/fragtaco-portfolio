// The chart layer's drawing (spec 9.6), on the trail's canvas under the trail: the grid laid over the ground, so it tilts with
// the picture and in My climb runs up and over the mountain (the rows take the height under them), and the marks that are
// only in the overview and fade with the picture: two dotted range rings and a small triangle on the summit. The numbers are
// preview 9's (map.js drawGrid and drawChart); the maths of the grid, the rings and the inks is chart.ts. The words of the
// chart (degrees, scale, north, ring labels) are frame-layer.ts. Drawn only when the view changes.
import { INK, RINGS_KM, crossInk, gridBoost, gridCrosses, gridInk, gridLift, gridLines, ringPoints, type Cross, type GridLine } from "./chart";
import { setHeights, liftOf, type HeightField } from "./heights";
import { project, type View } from "./view";

export type Chart = { lines: GridLine[]; crosses: Cross[] };

/** The overview-only marks' strength and the shape of their lines (preview 9). */
export const RING_ALPHA = 0.3;
export const RING_DASH: [number, number] = [1, 4];
export const SUMMIT_ALPHA = 0.7;
/** Half the length of a cross's arm, and the summit triangle's size (top, half base, foot). */
export const CROSS_ARM = 4.5;
export const SUMMIT_MARK = { top: 6, half: 5.5, foot: 4 };

export const makeChart = (): Chart => ({ lines: gridLines(), crosses: gridCrosses() });

/** The grid's points take the height under them (once the heights are read). */
export function setChartHeights(chart: Chart, field: HeightField): void {
  for (const line of chart.lines) setHeights(line.pts, field);
  setHeights(chart.crosses, field);
}

/** The grid: a line for each 2.5 degrees (every fifth stronger) and a small cross where two strong ones meet, over the ground at the view's rise. */
export function drawGrid(c: CanvasRenderingContext2D, v: View, chart: Chart): void {
  const lift = gridLift(v.rise);
  const boost = gridBoost(v.k); // over the dark ground the same faint grid needs more ink to read as the same

  c.lineWidth = 1;
  c.lineJoin = "round";
  for (const line of chart.lines) {
    c.strokeStyle = gridInk(line.major, boost);
    c.beginPath();
    line.pts.forEach((p, i) => {
      const [x, y] = project(v, p.x, p.y, liftOf(p.n, v.rise) + lift);

      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.stroke();
  }
  c.strokeStyle = crossInk(boost);
  c.beginPath();
  for (const p of chart.crosses) {
    const [x, y] = project(v, p.x, p.y, liftOf(p.n, v.rise) + lift);

    c.moveTo(x - CROSS_ARM, y);
    c.lineTo(x + CROSS_ARM, y);
    c.moveTo(x, y - CROSS_ARM);
    c.lineTo(x, y + CROSS_ARM);
  }
  c.stroke();
}

/** The overview's own marks at `over` strength (0 to 1, the picture's own opacity): the two dotted rings round the summit and a small open triangle on it. */
export function drawOverviewMarks(c: CanvasRenderingContext2D, v: View, summit: readonly [number, number], over: number): void {
  if (over <= 0.01) return;
  c.lineJoin = "round";
  for (const km of RINGS_KM) {
    c.beginPath();
    ringPoints([summit[0], summit[1]], km).forEach(([px, py], i) => {
      const [x, y] = project(v, px, py, 0);

      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    });
    c.setLineDash(RING_DASH);
    c.strokeStyle = `rgba(${INK},${RING_ALPHA * over})`;
    c.lineWidth = 1;
    c.stroke();
    c.setLineDash([]);
  }

  const [sx, sy] = project(v, summit[0], summit[1], 0);

  c.beginPath();
  c.moveTo(sx, sy - SUMMIT_MARK.top);
  c.lineTo(sx + SUMMIT_MARK.half, sy + SUMMIT_MARK.foot);
  c.lineTo(sx - SUMMIT_MARK.half, sy + SUMMIT_MARK.foot);
  c.closePath();
  c.strokeStyle = `rgba(${INK},${SUMMIT_ALPHA * over})`;
  c.lineWidth = 1.2;
  c.stroke();
}

/** The chart marks on the cleared canvas (the trail is drawn over them): the grid, then the overview's marks at `over` strength. */
export function drawChart(c: CanvasRenderingContext2D, v: View, chart: Chart, summit: readonly [number, number], over: number): void {
  drawGrid(c, v, chart);
  drawOverviewMarks(c, v, summit, over);
}
