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

/** Three box blurs of radius r, in place (the edges repeat). */
export function blur3(field: Float32Array, w: number, h: number, r: number): void {
  const tmp = new Float32Array(field.length);
  const win = r * 2 + 1;

  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let s = 0;

      for (let x = -r; x <= r; x++) s += field[y * w + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / win;
        s += field[y * w + clamp(x + r + 1, 0, w - 1)] - field[y * w + clamp(x - r, 0, w - 1)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;

      for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        field[y * w + x] = s / win;
        s += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
      }
    }
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

  return (v - field.base) / (field.hi - field.base);
}

/** Set `n` on each point to the height under it. */
export function setHeights(points: { x: number; y: number; n: number }[], field: HeightField): void {
  for (const p of points) p.n = sampleHeight(field, p.x, p.y);
}

/** How high a line of height n (0 to 1) stands, in map units, when the rise is `rise` (0 flat, 1 risen): the low lines settle first, the summit last. */
export function liftOf(n: number, rise: number): number {
  return n * HEIGHT * smooth(n * 0.55, n * 0.55 + 0.45, rise);
}
