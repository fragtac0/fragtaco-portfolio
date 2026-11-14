// The chart layer (spec 9.6): a grid laid over the ground (a point every 8 units along each line, lines every
// 2.5 degrees, a small cross every 5), two dotted range rings round the summit, the degree labels, the scale bar
// and the position readout. Pure maths: positions in map units or on the stage; the engine draws them.
import { HEIGHT_FRAME, KM_PER_UNIT, latOf, lonOf, xOf, yOf } from "./frame";
import { range, smooth } from "./map-math";
import { project, type Stage, type View } from "./view";

/** The grid's lines every 2.5 degrees, and which are strong (every 5). */
export const LONS = range(190, 266, 2.5);
export const LATS = range(-5, 46, 2.5);
/** The step along a grid line, in map units. */
export const GRID_STEP = 8;
/** The range rings, in kilometres from the summit, and the steps round each. */
export const RINGS_KM = [150, 300] as const;
export const RING_STEPS = 96;
/** The scale bar, in kilometres. */
export const SCALE_KM = 200;
/** The chart's ink (cream), as r,g,b. */
export const INK = "253,252,230";

export type GridPoint = { x: number; y: number; n: number };
export type GridLine = { major: boolean; pts: GridPoint[] };
export type Cross = { x: number; y: number; n: number };

const { x0: X0, y0: Y0, w: XW, h: YH } = HEIGHT_FRAME;

/** The grid: lines of longitude and latitude inside the height frame, each a row of points that take the height under them. */
export function gridLines(): GridLine[] {
  const lines: GridLine[] = [];

  LONS.forEach((lon) => {
    const x = xOf(lon);

    if (x > X0 && x < X0 + XW) lines.push({ major: lon % 5 === 0, pts: range(Y0, Y0 + YH + 1, GRID_STEP).map((y) => ({ x, y, n: 0 })) });
  });
  LATS.forEach((lat) => {
    const y = yOf(lat);

    if (y > Y0 && y < Y0 + YH) lines.push({ major: lat % 5 === 0, pts: range(X0, X0 + XW + 1, GRID_STEP).map((x) => ({ x, y, n: 0 })) });
  });

  return lines;
}

/** The small crosses, where a line of longitude and a line of latitude both fall on a multiple of 5 degrees. */
export function gridCrosses(): Cross[] {
  const out: Cross[] = [];

  LONS.forEach((lon) =>
    LATS.forEach((lat) => {
      const x = xOf(lon);
      const y = yOf(lat);

      if (lon % 5 === 0 && lat % 5 === 0 && x > X0 && x < X0 + XW && y > Y0 && y < Y0 + YH) out.push({ x, y, n: 0 });
    }),
  );

  return out;
}

/** How strong the chart marks of the overview are: they tilt with the picture and fade exactly as it does. */
export const chartAlpha = (night: number) => 1 - smooth(0.12, 0.85, night);

/** The grid's ink strength: more over the dark ground of My climb (up to 2.6 times), for the same faint look. */
export const gridBoost = (k: number) => 1 + 1.6 * k;
/** The line colour of a grid line, and of the crosses. */
export const gridInk = (major: boolean, alpha: number) => `rgba(${INK},${(major ? 0.07 : 0.04) * alpha})`;
export const crossInk = (alpha: number) => `rgba(${INK},${Math.min(0.42, 0.26 * alpha)})`;
/** The grid sits this high above the ground, scaled by the rise, so the lines do not sink into it. */
export const gridLift = (rise: number) => 0.5 * rise;

/** A ring of `km` round the summit, in map units: the radius and the points (a closed loop, steps + 1 points). */
export function ringRadius(km: number): number {
  return km / KM_PER_UNIT;
}

export function ringPoints(centre: [number, number], km: number, steps: number = RING_STEPS): [number, number][] {
  const r = ringRadius(km);

  return range(0, steps + 1).map((i) => [centre[0] + Math.cos((i / steps) * 6.2832) * r, centre[1] + Math.sin((i / steps) * 6.2832) * r]);
}

/** Where a ring's label sits: up and to the right of the summit, at 45 degrees. */
export function ringLabelAt(centre: [number, number], km: number): [number, number] {
  const r = ringRadius(km);

  return [centre[0] + r * 0.7071, centre[1] - r * 0.7071];
}

export type Label = { text: string; x: number; y: number };

/** Latitude labels (every 5 degrees) along the right edge: kept off the top and foot of the stage. */
export function latitudeLabels(v: View, stage: Stage): Label[] {
  return LATS.filter((lat) => lat % 5 === 0).flatMap((lat) => {
    const y = project(v, 0, yOf(lat), 0)[1];

    return y > 84 && y < stage.h - 80 ? [{ text: `${lat}° N`, x: stage.w - 16, y: y - 7 }] : [];
  });
}

/** Longitude labels (every 5 degrees) along part of the foot, right of the middle and clear of the scale bar. */
export function longitudeLabels(v: View, stage: Stage): Label[] {
  return LONS.filter((lon) => lon % 5 === 0).flatMap((lon) => {
    const x = project(v, xOf(lon), 0, 0)[0];

    return x > stage.w * 0.5 && x < stage.w - 250 ? [{ text: `${lon}° E`, x: x + 5, y: stage.h - 16 }] : [];
  });
}

export type ScaleBar = { x0: number; x1: number; y: number; ticks: number[]; zeroLabel: Label; endLabel: Label };

/** The scale bar at the foot: 200 km long on the ground, so `S` pixels a unit makes its length. Ticks at the start, middle and end. */
export function scaleBar(S: number, stage: Stage): ScaleBar {
  const len = (SCALE_KM / KM_PER_UNIT) * S;
  const x1 = stage.w - 24;
  const x0 = x1 - len;
  const y = stage.h - 44;

  return {
    x0,
    x1,
    y,
    ticks: [0, 0.5, 1].map((t) => x0 + len * t),
    zeroLabel: { text: "0", x: x0 - 2, y: y - 11 },
    endLabel: { text: `${SCALE_KM} km`, x: x1 + 2, y: y - 11 },
  };
}

/** The position readout: latitude and longitude of a map point, two decimals. */
export function readout(x: number, y: number): string {
  return `${latOf(y).toFixed(2)}° N   ${lonOf(x).toFixed(2)}° E`;
}

