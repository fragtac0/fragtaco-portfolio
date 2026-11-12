/**
 * The displacement maps for the glass front, as plain pixels (glass-run.ts turns them into pictures for
 * the SVG filter). Red and green carry the push (128 is none, 255 is the full push right or down, 0 the
 * full push left or up; the filter multiplies by `2 * bendPx`, so the strongest push is `bendPx`).
 * Blue is unused and alpha is opaque.
 *
 * The push at the front is the glass's surface slope, as in the painting shader: the gradient of a
 * smooth noise (so the picture wobbles slightly differently along the front, which is what makes the
 * front irregular), plus a push along the front's normal that changes sign across the middle of the band
 * (so the rim magnifies, like the edge of a thick lens). Both die away outside the band.
 */
import { GLASS, REACH } from "./glass-math";

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Three octaves of smooth noise, 0..1. */
export function fbm(x: number, y: number): number {
  return (
    valueNoise(x, y) * 0.55 +
    valueNoise(x * 2.03 + 7.1, y * 2.03 + 7.1) * 0.3 +
    valueNoise(x * 4.07 - 3.7, y * 4.07 - 3.7) * 0.15
  );
}

/** Noise's slope, scaled so a typical value is about 0.4 of the full push (the noise gradient itself runs 1 to 3). */
const SLOPE = 0.2;
/** The normal push at its peak, relative to the full push. */
const NORMAL = 0.5;

function slope(x: number, y: number, freq: number): [number, number] {
  const e = 0.02;
  const c = fbm(x * freq, y * freq);
  return [((fbm(x * freq + e, y * freq) - c) / e) * SLOPE, ((fbm(x * freq, y * freq + e) - c) / e) * SLOPE];
}

/** A Gaussian of the distance from the front's middle in half-bands, lowered so it is exactly 0 at the texture's edge (REACH). */
const EDGE = Math.exp(-REACH * REACH * 0.5);
function gateAt(z: number): number {
  return Math.max(0, (Math.exp(-z * z * 0.5) - EDGE) / (1 - EDGE));
}

function pack(out: Uint8ClampedArray<ArrayBuffer>, i: number, vx: number, vy: number) {
  const m = Math.hypot(vx, vy);
  const k = m > 1 ? 1 / m : 1;
  out[i] = 128 + 127 * vx * k;
  out[i + 1] = 128 + 127 * vy * k;
  out[i + 2] = 0;
  out[i + 3] = 255;
}

/**
 * The ring map: a square of `n` pixels covering a circle of radius `(1 + REACH * band)` front radii,
 * so the front is at distance `1 / (1 + REACH * band)` of the half-size from the middle and the band
 * is `band / (1 + REACH * band)` wide. Stretched to a front of radius r, the band is `band * r` wide, the
 * same share of the radius at every moment.
 */
export function ringPixels(n: number, band: number = GLASS.band): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  const reach = 1 + REACH * band;
  const front = 1 / reach;
  const sigma = band / reach;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = ((x + 0.5) / n) * 2 - 1;
      const dy = ((y + 0.5) / n) * 2 - 1;
      const d = Math.hypot(dx, dy);
      const z = (d - front) / sigma;
      const gate = gateAt(z);
      const [sx, sy] = slope(dx, dy, 3.1);
      const normal = z * gate * NORMAL;
      const nx = d > 0 ? dx / d : 0;
      const ny = d > 0 ? dy / d : 0;
      pack(out, (y * n + x) * 4, sx * gate + nx * normal, sy * gate + ny * normal);
    }
  }
  return out;
}

/**
 * The strip map for a linear front: `w` pixels across (the direction of travel) by `h` along the front,
 * covering `REACH` half-bands either side of the front's middle. It is the same for a front travelling right
 * or left (the normal push changes sign across the band, and mirroring that is the same picture). It is
 * stretched to a fixed number of CSS px across, so the band is the same width in px whatever the screen.
 */
export function stripPixels(w: number, h: number, band: number = GLASS.band): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(w * h * 4);
  const sigma = 1 / REACH;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1;
      const z = u / sigma;
      const gate = gateAt(z);
      // noise over the strip in px-like units: across and along are scaled alike
      const [sx, sy] = slope((x / w) * (w / h) * 0.6, (y / h) * 1.5, 3.1 * (band / 0.07));
      const normal = z * gate * NORMAL;
      pack(out, (y * w + x) * 4, sx * gate + normal, sy * gate);
    }
  }
  return out;
}
