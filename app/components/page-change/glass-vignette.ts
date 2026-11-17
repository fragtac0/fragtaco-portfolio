/**
 * The bend's push, damped to nothing at the screen's edges (a review finding on the first cut). A displacement filter
 * takes each pixel from `push` px away, and where that is outside the picture an SVG filter gets transparent black (the preview's
 * shader clamps to the edge instead): within the push of the screen's edge the picture lost its red, then its green, then
 * everything, and the dark page behind showed through as a strip along the edge while the band crossed it. So the displacement map
 * is multiplied (about its neutral grey) by a vignette that is 0 at the edge of the screen and 1 from `DAMP` times the biggest
 * push inwards: the picture never looks further than the distance to its own edge.
 */
import { SPLIT } from "./glass-math";
import { BEND_RANGE } from "./glass-texture";

/** How many times the biggest push the vignette takes to get to 1 (a smoothstep is never steeper than 1.5 times its average). */
export const DAMP = 1.5;
/** CSS px per texel of the vignette's picture (it is stretched to the screen; the ramp is smooth, so a texel of 4 px is plenty). */
export const VIGNETTE_CELL = 4;

/** The biggest distance the bend can take a pixel from, in CSS px, for a peak push of `peakPx` (the red channel is pushed furthest). */
export const maxPush = (peakPx: number) => peakPx * SPLIT.r * BEND_RANGE;

/** The vignette at `distance` px from the nearest edge of the screen: 0 at the edge, 1 from `DAMP * maxPush` inwards, smooth between. */
export function edgeDamp(distance: number, maxPushPx: number): number {
  if (maxPushPx <= 0) return 1;
  const t = Math.min(1, Math.max(0, distance / (DAMP * maxPushPx)));
  return t * t * (3 - 2 * t);
}

/** The vignette's size in texels for a screen `w` by `h` CSS px. */
export const vignetteSize = (w: number, h: number) => ({ w: Math.ceil(w / VIGNETTE_CELL), h: Math.ceil(h / VIGNETTE_CELL) });

/** The vignette as RGBA pixels (grey, opaque) for a screen `w` by `h` CSS px: `vignetteSize(w, h)` texels, stretched over the screen. */
export function vignettePixels(w: number, h: number, maxPushPx: number): Uint8ClampedArray<ArrayBuffer> {
  const size = vignetteSize(w, h);
  const out = new Uint8ClampedArray(size.w * size.h * 4);
  for (let y = 0; y < size.h; y++) {
    const py = ((y + 0.5) / size.h) * h;
    for (let x = 0; x < size.w; x++) {
      const px = ((x + 0.5) / size.w) * w;
      const v = Math.round(255 * edgeDamp(Math.min(px, w - px, py, h - py), maxPushPx));
      const i = (y * size.w + x) * 4;
      out[i] = v;
      out[i + 1] = v;
      out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}
