// The heights (spec 9.2): the MOLA height picture (public/mars/heights.png, 64 by 41.6 degrees) as a field of numbers,
// blurred a little, with the plain (the 30th percentile) as 0 and the summit as 1, and how far a line of a given
// height has risen as the camera climbs. Pure maths: reading the picture into numbers is the engine's job.
import { HEIGHT_FRAME } from "./frame";
import { clamp, smooth } from "./map-math";

/** The summit in map units: about eight times the truth. */
export const HEIGHT = 84;

/** The field's size: the picture (1000 by 650) is read at 800 by 520, as the preview did. */
export const GRID_W = 800;
export const GRID_H = 520;
/** How wide the blur is, in field cells (three box passes of radius 2). */
export const BLUR_R = 2;
/** The share of the field (sorted) that counts as the plain. */
export const PLAIN_SHARE = 0.3;

export type HeightField = {
  /** Grey levels 0 to 255 after the blur, row by row. */
  data: Float32Array;
  w: number;
  h: number;
  /** The plain: the grey at the 30th percentile. */
  base: number;
  /** The summit: the highest grey. */
  hi: number;
  /** The lowest grey. */
  lo: number;
};

/** One box blur of radius r along the rows `y0` to `y1` (not included) of `src`, written to `dst` (the edges repeat). */
export function blurRows(src: Float32Array, dst: Float32Array, w: number, r: number, y0: number, y1: number): void {
  const win = r * 2 + 1;

  for (let y = y0; y < y1; y++) {
    let s = 0;

    for (let x = -r; x <= r; x++) s += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[y * w + x] = s / win;
      s += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
}

/** One box blur of radius r down the columns `x0` to `x1` (not included) of `src`, written to `dst` (the edges repeat). */
export function blurCols(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, x0: number, x1: number): void {
  const win = r * 2 + 1;

  for (let x = x0; x < x1; x++) {
    let s = 0;

    for (let y = -r; y <= r; y++) s += src[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = s / win;
      s += src[clamp(y + r + 1, 0, h - 1) * w + x] - src[clamp(y - r, 0, h - 1) * w + x];
    }
  }
}

/** Three box blurs of radius r, in place (the edges repeat). */
export function blur3(field: Float32Array, w: number, h: number, r: number): void {
  const tmp = new Float32Array(field.length);

  for (let pass = 0; pass < 3; pass++) {
    blurRows(field, tmp, w, r, 0, h);
    blurCols(tmp, field, w, h, r, 0, w);
  }
}

/** A field from grey levels (one number for each cell, 0 to 255, row by row): blurred, with the plain and the summit found. */
export function makeField(grey: ArrayLike<number>, w: number, h: number, r: number = BLUR_R): HeightField {
  const data = Float32Array.from(grey);

  blur3(data, w, h, r);

  const sorted = Float32Array.from(data).sort();

  return {
    data,
    w,
    h,
    base: sorted[Math.floor(sorted.length * PLAIN_SHARE)],
    hi: sorted[sorted.length - 1],
    lo: sorted[0],
  };
}

/** The bands a step takes of a field: a step is about a half millisecond of work, so a caller can stop between any two (see `fieldSteps`). */
const BANDS = 20;
/** The bins of the histogram that finds the plain (`fieldSteps`). */
const BINS = 4096;

/**
 * `makeField` as a list of small steps to be run one after the other (a time-sliced run: the whole is about 60 ms of work, which must not be one
 * frame): the copy, the three blurs a band of rows or columns at a time, then the lowest, the highest and the plain, the last found without sorting
 * the whole field (a histogram, then a sort of the one bin the plain falls in). `field()` is the same field `makeField` makes, once every step has run.
 */
export function fieldSteps(grey: ArrayLike<number>, w: number, h: number, r: number = BLUR_R): { steps: Array<() => void>; field(): HeightField } {
  const bands = (n: number, each: (a: number, b: number) => void): Array<() => void> => Array.from({ length: BANDS }, (_, i) => () => each(Math.floor((n * i) / BANDS), Math.floor((n * (i + 1)) / BANDS)));
  let data = new Float32Array(0);
  let tmp = new Float32Array(0);
  let [lo, hi, base] = [Infinity, -Infinity, 0];
  let counts = new Uint32Array(BINS);
  const scale = () => (hi > lo ? (BINS - 1) / (hi - lo) : 0);
  const binOf = (v: number) => Math.floor((v - lo) * scale());
  let bin = 0;
  let below = 0;
  let inBin: number[] = [];
  const rank = Math.floor(w * h * PLAIN_SHARE);
  const steps: Array<() => void> = [
    () => {
      data = Float32Array.from(grey);
      tmp = new Float32Array(data.length);
    },
  ];

  for (let pass = 0; pass < 3; pass++) {
    steps.push(...bands(h, (a, b) => blurRows(data, tmp, w, r, a, b)), ...bands(w, (a, b) => blurCols(tmp, data, w, h, r, a, b)));
  }
  steps.push(
    ...bands(w * h, (a, b) => {
      for (let i = a; i < b; i++) {
        if (data[i] < lo) lo = data[i];
        if (data[i] > hi) hi = data[i];
      }
    }),
    ...bands(w * h, (a, b) => {
      for (let i = a; i < b; i++) counts[binOf(data[i])]++;
    }),
    () => {
      // the bin the plain's rank falls in, and how many cells are below it
      let seen = 0;

      for (bin = 0; bin < BINS - 1 && seen + counts[bin] <= rank; bin++) seen += counts[bin];
      below = seen;
      counts = new Uint32Array(0);
    },
    ...bands(w * h, (a, b) => {
      for (let i = a; i < b; i++) if (binOf(data[i]) === bin) inBin.push(data[i]);
    }),
    () => {
      base = Float32Array.from(inBin).sort()[rank - below];
      inBin = [];
    },
  );

  return { steps, field: () => ({ data, w, h, base, hi, lo }) };
}

/** A grey level as a height: 0 at the plain, 1 at the summit (a flat field, with no summit above its plain, is all 0 rather than not a number). */
export function normalise(field: Pick<HeightField, "base" | "hi">, grey: number): number {
  const span = field.hi - field.base;

  return span > 0 ? (grey - field.base) / span : 0;
}

/** The ground's height at a map position: 0 at the plain, 1 at the summit (less than 0 below the plain). Bilinear between cells; outside the frame the edge cell. */
export function sampleHeight(field: HeightField, x: number, y: number): number {
  const { data, w, h } = field;
  const { x0, y0, w: fw, h: fh } = HEIGHT_FRAME;
  const gx = clamp(((x - x0) / fw) * (w - 1), 0, w - 1.001);
  const gy = clamp(((y - y0) / fh) * (h - 1), 0, h - 1.001);
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const a = gx - ix;
  const b = gy - iy;
  const i = iy * w + ix;
  const v = (data[i] * (1 - a) + data[i + 1] * a) * (1 - b) + (data[i + w] * (1 - a) + data[i + w + 1] * a) * b;

  return normalise(field, v);
}

/** Set `n` on each point to the height under it. */
export function setHeights(points: { x: number; y: number; n: number }[], field: HeightField): void {
  for (const p of points) p.n = sampleHeight(field, p.x, p.y);
}

/** How high a line of height n (0 to 1) stands, in map units, when the rise is `rise` (0 flat, 1 risen): the low lines settle first, the summit last. */
export function liftOf(n: number, rise: number): number {
  return n * HEIGHT * smooth(n * 0.55, n * 0.55 + 0.45, rise);
}
