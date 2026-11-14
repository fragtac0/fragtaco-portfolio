/**
 * The displacement tiles for the glass front's bend, as plain pixels (glass-run.ts turns them into pictures for the SVG
 * filters). Red and green carry the push (128 is none, 255 is the full push right or down, 0 the full push left or up, with the
 * full push being `BEND_MAX` of the peak); blue is unused and alpha is opaque.
 *
 * The push at each point is along the direction from the middle, as strong as `bendProfile` says at that distance from the front
 * (the field is the wandering one of glass-field.ts, so the bend sits exactly on the edge the mask draws), and the filters
 * multiply it by the peak in pixels (`bendPxFor`), by `SPLIT` for each colour, and by minus one for the page arriving.
 */
import { eachTilePixel } from "./glass-field";
import { bendProfile } from "./glass-math";

/** The most the profile reaches over its peak (1.08, at 0.22 half-bands outside the front): the push is stored over this. */
export const BEND_MAX = 1.1;

/** The bend tile for a front of radius `front`. `n` pixels square. */
export function bendTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    out[i * 4] = 128;
    out[i * 4 + 1] = 128;
    out[i * 4 + 3] = 255;
  }
  eachTilePixel(
    n,
    front,
    (i, x, u, v) => {
      const rho = Math.hypot(u, v) || 1;
      const k = bendProfile(x) / BEND_MAX;
      out[i] = 128 + (127 * k * u) / rho;
      out[i + 1] = 128 + (127 * k * v) / rho;
    },
    3.2,
  );
  return out;
}
