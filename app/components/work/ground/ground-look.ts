/**
 * The numbers of the work ground (spec 6.4), shared by the shader scene (ground-scene.tsx) and the CSS
 * picture that stands in for it (`.work-wash` in ground.css, which repeats FALLOFF, the centres, the
 * sizes and the drift by hand: change both together). Pure, so it is tested (ground-look.test.ts) and WorkGround does
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
  /**
   * The drift. The picture is drawn once and does not move inside the package (a driver makes the package redraw
   * at 60 frames a second for ever, for a change nobody can see). Instead the whole canvas breathes: a CSS
   * animation (`work-ground-breathe`, transform only, on the compositor) scales it from 1 to `scale` and back
   * about the pool, a full cycle every `seconds` (spec: 40 s or more). ground.css repeats both numbers.
   */
  drift: { scale: 1.06, seconds: 80, originX: 0.34, originY: 0.4 },
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

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (l: number) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);

/**
 * The package lays a translucent layer over the one below in linear light, which comes out much brighter
 * than the same alpha laid in sRGB as CSS does. This is the alpha the CSS ember needs at each stop so that
 * it lays down the same red over the ground as the shader's ember does (red is its strongest channel).
 */
export function emberCssAlphas(): Array<readonly [number, number]> {
  const ground = channels(GROUND)[0];
  const ember = channels(GROUND_EMBER)[0];
  return FALLOFF.map(([position, keep]) => {
    const lit = toSrgb(keep * toLinear(ember) + (1 - keep) * toLinear(ground));
    return [position, Math.min(1, Math.max(0, (lit - ground) / (ember - ground)))] as const;
  });
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
 * `min(height, 1.25 * width)`, as `min(100dvh, 125dvw)` in ground.css. This is the factor to multiply a
 * radius by to get that: 1 on any screen that is wider than 4:5 portrait.
 */
export function reachFactor(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(1, (1.25 * width) / height);
}

/**
 * Whether the still picture taken at one screen size is too far from the screen now and the shader must be
 * started again to take a new one: the width or the height moved by more than `tolerance` (a share; 15% so the collapsing address bar of a phone browser does not start it).
 */
export function needsRedraw(taken: readonly [number, number], now: readonly [number, number], tolerance = 0.15): boolean {
  const [tw, th] = taken;
  const [nw, nh] = now;
  if (tw <= 0 || th <= 0) return true;
  return Math.abs(nw - tw) / tw > tolerance || Math.abs(nh - th) / th > tolerance;
}
