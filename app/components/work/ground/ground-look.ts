/**
 * The numbers of the work ground (spec 6.4), shared by the shader scene (ground-scene.tsx) and the CSS
 * picture that stands in for it (`.work-wash` in work.css, which repeats FALLOFF, the centres and the
 * sizes by hand: change both together). Pure, so it is tested (ground-look.test.ts) and WorkGround does
 * not pull the `shaders` package in to read it.
 *
 * The package sizes a radial gradient in pixels as `radius * the screen's height`, and `aspect` squeezes
 * it across (width = radius * height / aspect). Its colour stops are mixed in linear light, which the
 * CSS gradients are told to do too (`in srgb-linear`), so the two draw the same picture.
 */
import { GROUND, GROUND_EMBER, GROUND_POOL } from "../../../styles/tokens";

/** How much of the peak colour is left at each share of the way to the edge: a soft, eased fall, not a cone. */
export const FALLOFF: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.2, 0.62],
  [0.4, 0.33],
  [0.6, 0.14],
  [0.8, 0.04],
  [1, 0],
];

export const GROUND_LOOK = {
  /** One large soft pool of cool cream-grey light, off centre. */
  pool: { color: GROUND_POOL, x: 0.34, y: 0.4, radius: 1.0, aspect: 1.25 },
  /** One low ember of orange in the lower right corner; weak and small, never full strength. */
  ember: { color: GROUND_EMBER, x: 1.0, y: 1.02, radius: 0.6, aspect: 1.5 },
  /** Strength of the package's static grain, which hides banding; the site's own grain sits on top of it. */
  grain: 0.035,
  /** A breath is the radius going out and back: cycles per second 1/70 and 1/90, so 70 s and 90 s (spec: 40 s or more). */
  poolSpeed: 1 / 70,
  emberSpeed: 1 / 90,
  /** How far the radius breathes, as a share of its value. */
  breath: { min: 0.88, max: 1.08 },
} as const;

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `from` mixed toward `to` by `amount` (0 to 1), channel by channel in sRGB, as `#rrggbb`. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((c, i) => hex2(c + (b[i] - c) * amount)).join("")}`;
}

export interface GroundStop {
  color: string;
  position: number;
}

/** The pool's stops: the pool colour at the centre falling to the ground colour at the edge along FALLOFF. */
export function poolStops(): GroundStop[] {
  return FALLOFF.map(([position, keep]) => ({ position, color: mixHex(GROUND, GROUND_POOL, keep) }));
}

/** The ember's stops: the ember colour at the centre fading to nothing at the edge along FALLOFF (`#rrggbbaa`). */
export function emberStops(): GroundStop[] {
  return FALLOFF.map(([position, keep]) => ({
    position,
    color: `${GROUND_EMBER}${hex2(keep * 255)}`,
  }));
}

/**
 * Radii are shares of the screen's height, which on a tall narrow screen would let the pool and the ember
 * swallow the whole width (an orange corner over 13% of a phone). So the size is taken from
 * `min(height, 1.25 * width)`, as `min(100dvh, 125dvw)` in work.css. This is the factor to multiply a
 * radius by to get that: 1 on any screen that is wider than 4:5 portrait.
 */
export function reachFactor(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(1, (1.25 * width) / height);
}

/** The radius range a breath moves over, for a base radius. */
export function breathRange(radius: number): { min: number; max: number } {
  return { min: radius * GROUND_LOOK.breath.min, max: radius * GROUND_LOOK.breath.max };
}

/** Seconds a full breath takes at a speed in cycles per second. */
export function breathSeconds(speed: number): number {
  return 1 / speed;
}
