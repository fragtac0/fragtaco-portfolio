/**
 * The strength tiles for the glass front's bend, as plain pixels (glass-run.ts turns them into pictures for the SVG filters). Red and
 * green both hold the push's strength, unsigned: 0 is none and 255 is the strongest the push gets (`BEND_RANGE` of the peak); blue is
 * unused and alpha is opaque.
 *
 * R58, the 17 November design (`docs/superpowers/specs/2026-11-17-round7-edge-look-design.md`, 4.1 to 4.3 and 4.7): the push is the hero
 * painting's liquid, not a lens. At each point it is the gradient of the hero's noise (glass-noise.ts) as strong as `noiseStrength` says
 * at that distance from the front (a band at the front and a wake behind it, as the painting's change has), the field being the
 * wandering one of glass-field.ts so the bend sits exactly on the edge the mask draws. The noise itself is NOT in these tiles: it is in
 * the vignette's picture (glass-vignette.ts), fixed on the screen, and each filter multiplies the two (glass-filter.tsx). A tile is
 * scaled by up to 4% onto the front, and a noise baked into it would slide 8% of its distance from the middle each time the tile
 * changes (Ruling R129); the strength is a smooth profile along the front, and scaling that moves nothing but the edge of the band.
 * The filters multiply the push by the peak in pixels (`bendPxFor`, 150% of R54's), by `SPLIT` for each colour (the hero's), and by
 * minus one for the page arriving.
 */
import { eachTilePixel } from "./glass-field";
import { noiseStrength, NOISE_S_MAX, WAKE_REACH } from "./glass-noise";

/** The most the push reaches over its peak (`NOISE_S_MAX`): the strength is stored over this. */
export const BEND_RANGE = NOISE_S_MAX;

/** The bend tile for a front of radius `front`. `n` pixels square. */
export function bendTilePixels(n: number, front: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < n * n; i++) out[i * 4 + 3] = 255;
  eachTilePixel(
    n,
    front,
    (i, x) => {
      const s = noiseStrength(x);
      if (s < 1e-3) return;
      const v = (255 * s) / BEND_RANGE;
      out[i] = v;
      out[i + 1] = v;
    },
    WAKE_REACH + 0.2,
  );
  return out;
}
