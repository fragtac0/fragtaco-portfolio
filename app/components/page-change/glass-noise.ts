/**
 * The hero painting's liquid, as numbers (round 7, the edge's look: `docs/superpowers/specs/2026-11-17-round7-edge-look-design.md`,
 * 4.1 and 4.2). The painting's own change (`home/hero/paint-shaders.ts`) pushes each pixel along the gradient of a smooth noise, so the
 * push has no single direction, and it is strongest at the front and trails off in a wake behind it. The page change's bend does the
 * same: `fbm` is that shader's `h`, `n` and `fbm`, `noiseGradient` its push direction and `noiseStrength` its strength at a distance
 * from the front. Pure, no DOM: `noiseGradient` goes into the vignette's picture (glass-vignette.ts, fixed on the screen) and `noiseStrength` into the bend's tiles (glass-texture.ts), R129.
 */
import { newShare } from "./glass-field";

const fract = (v: number) => v - Math.floor(v);
/** The shader's `h`: a hash of a lattice point. */
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
/** The shader's `n`: value noise, the hash of the four lattice points round `(px, py)` mixed by a smoothstep. */
function noise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let fx = fract(px);
  let fy = fract(py);
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * fx;
  const b = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * fx;
  return a + (b - a) * fy;
}
/** The shader's `fbm`: three octaves of `noise`, 0 to 1. */
export const fbm = (x: number, y: number): number =>
  noise(x, y) * 0.55 + noise(x * 2.03 + 7.1, y * 2.03 + 7.1) * 0.3 + noise(x * 4.07 - 3.7, y * 4.07 - 3.7) * 0.15;

/** The shader's `q = p * 2.9`: how many noise cells a farthest-corner distance spans. */
export const NOISE_SCALE = 2.9;
/** The shader's `e`: the step of the forward difference. */
export const NOISE_STEP = 0.02;
/** The gradient's length over a screen has a maximum of 1.54 (a median of 0.45, measured in the spike): it is divided by this and clamped to 1. */
export const NOISE_NORM = 1.55;

/**
 * The push's direction and size at (`u`, `v`) (farthest-corner distances from the middle of the screen): the gradient of `fbm` at
 * `(u, v) * NOISE_SCALE` by forward differences of `NOISE_STEP`, over `NOISE_NORM`, never longer than 1.
 */
export function noiseGradient(u: number, v: number): { x: number; y: number } {
  const qx = u * NOISE_SCALE;
  const qy = v * NOISE_SCALE;
  const c = fbm(qx, qy);
  const x = (fbm(qx + NOISE_STEP, qy) - c) / NOISE_STEP / NOISE_NORM;
  const y = (fbm(qx, qy + NOISE_STEP) - c) / NOISE_STEP / NOISE_NORM;
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/** How far behind the front (in half-bands) the wake reaches. */
export const WAKE_REACH = 3.7;
/** The most `noiseStrength` reaches (1 from the band and 0.3 from the wake, at the front): the push is stored over it. */
export const NOISE_S_MAX = 1.3;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The push's strength at `x` half-bands outside the front (negative inside), as the hero's: `band + 0.6 * wake`, the band being
 * the share of the picture that is mixed (1 at the front, 0 well either side) and the wake a trail behind the front on the new
 * page's side, which ends `WAKE_REACH` half-bands behind it.
 */
export function noiseStrength(x: number): number {
  const m = newShare(x);
  const band = 1 - Math.abs(2 * m - 1);
  const wake = smoothstep(-WAKE_REACH, 0, x) * m;
  return band + 0.6 * wake;
}
