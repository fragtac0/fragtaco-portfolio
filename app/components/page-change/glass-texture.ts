/**
 * The displacement tiles for the glass front's bend, as plain pixels (glass-run.ts turns them into pictures for the SVG
 * filters). Red and green carry the push (128 is none, 255 is the full push right or down, 0 the full push left or up, with the
 * full push being `BEND_RANGE` of the peak); blue is unused and alpha is opaque.
 *
 * R58, the 17 November design (`docs/superpowers/specs/2026-11-17-round7-edge-look-design.md`, 4.1 to 4.3): the push is the hero
 * painting's liquid, not a lens. At each point it is the gradient of the hero's noise (glass-noise.ts), so it has no one direction,
 * as strong as `noiseStrength` says at that distance from the front (a band at the front and a wake behind it, as the painting's
 * change has), the field being the wandering one of glass-field.ts so the bend sits exactly on the edge the mask draws. The filters
 * multiply it by the peak in pixels (`bendPxFor`, 150% of R54's), by `SPLIT` for each colour (the hero's), and by minus one for the
 * page arriving. The noise is fixed on the screen while a tile is scaled onto the front, so every tile of the ladder serves the bend.
 */
import { eachTilePixel } from "./glass-field";
import { noiseGradient, noiseStrength, NOISE_S_MAX, WAKE_REACH } from "./glass-noise";

/** The most the push reaches over its peak (`NOISE_S_MAX`): the push is stored over this. */
export const BEND_RANGE = NOISE_S_MAX;

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
      const s = noiseStrength(x);
      if (s < 1e-3) return;
      const g = noiseGradient(u, v);
      out[i] = 128 + (127 * g.x * s) / BEND_RANGE;
      out[i + 1] = 128 + (127 * g.y * s) / BEND_RANGE;
    },
    WAKE_REACH + 0.2,
  );
  return out;
}
