/**
 * The bend's direction picture: the hero's noise, fixed on the screen, damped to nothing at the screen's edges.
 *
 * The damping is a review finding on the first cut. A displacement filter takes each pixel from `push` px away, and where that is
 * outside the picture an SVG filter gets transparent black (the preview's shader clamps to the edge instead): within the push of the
 * screen's edge the picture lost its red, then its green, then everything, and the dark page behind showed through as a strip along
 * the edge while the band crossed it. So the push is multiplied by a vignette that is 0 at the edge of the screen and 1 from `DAMP`
 * times the biggest push inwards: the picture never looks further than the distance to its own edge.
 *
 * R58 and Ruling R129: the picture also carries the noise. Red and green hold `128 + 127 * gradient * vignette` (the hero's push
 * direction at that place, glass-noise.ts, `u` and `v` in farthest-corner distances from the middle of the screen), and the bend's
 * tiles hold only the strength (glass-texture.ts), so each filter's arithmetic composite gives `1/2 + (picture - 1/2) * strength`. The
 * noise is therefore exactly where it was on the screen before and after a change of tile: nothing slides when the front moves on to
 * the next tile, and the picture costs nothing per frame. It is made when the screen's size is known (at load and after a resize), a
 * few rows at a time (`vignetteRows`), as it costs more than the plain ramp did.
 */
import { SPLIT } from "./glass-math";
import { noiseGradient } from "./glass-noise";
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

/** The direction picture's neutral level (no push) and its reach either side. */
const NEUTRAL = 128;
const REACH = 127;

/**
 * Fills rows `y0` up to `y1` of the picture's pixels (`vignetteSize(w, h)` texels, stretched over a screen `w` by `h` CSS px): red and
 * green are `128 + 127 * gradient * damp`, blue is neutral, alpha is opaque. Rows are independent, so a caller can make them a few at a time.
 */
export function vignetteRows(out: Uint8ClampedArray<ArrayBuffer>, w: number, h: number, maxPushPx: number, y0: number, y1: number): void {
  const size = vignetteSize(w, h);
  const far = Math.hypot(w / 2, h / 2);
  for (let y = y0; y < Math.min(y1, size.h); y++) {
    const py = ((y + 0.5) / size.h) * h;
    for (let x = 0; x < size.w; x++) {
      const px = ((x + 0.5) / size.w) * w;
      const damp = edgeDamp(Math.min(px, w - px, py, h - py), maxPushPx);
      const i = (y * size.w + x) * 4;
      if (damp > 0) {
        const g = noiseGradient((px - w / 2) / far, (py - h / 2) / far);
        out[i] = NEUTRAL + REACH * g.x * damp;
        out[i + 1] = NEUTRAL + REACH * g.y * damp;
      } else {
        out[i] = NEUTRAL;
        out[i + 1] = NEUTRAL;
      }
      out[i + 2] = NEUTRAL;
      out[i + 3] = 255;
    }
  }
}

/** The picture as RGBA pixels for a screen `w` by `h` CSS px, all of it at once (tests; glass-prepare.ts makes it a few rows at a time). */
export function vignettePixels(w: number, h: number, maxPushPx: number): Uint8ClampedArray<ArrayBuffer> {
  const size = vignetteSize(w, h);
  const out = new Uint8ClampedArray(size.w * size.h * 4);
  vignetteRows(out, w, h, maxPushPx, 0, size.h);
  return out;
}
