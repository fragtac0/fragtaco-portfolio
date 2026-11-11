import type { SiteBook } from "~/types";

/**
 * The shelf's pure math: sizes, timing, the spring and the camera fit.
 * No three.js and no DOM, so it is unit tested. Ported from the `Shelf`
 * module of docs/redesign/mockups/home-v4.html.
 */

/** World units per inch of book height. */
export const INCH = 0.17;
/** Front edge of the plank (z). */
export const FRONT = 0.55;
/** The wall behind the books (z). */
export const WALLZ = FRONT - 1.4;
/** The gap between neighbouring spines on the plank (world units). */
export const SHELF_GAP = 0.014;
/** The shelf camera's vertical field of view, in degrees. */
export const FOV_DEG = 26;
/** Plank thickness (world units). */
export const PLANK_H = 0.09;
/** Seconds each book takes to fall in and fade up. */
export const DROP = 1.5;
/** Seconds between one book starting to fall and the next. */
export const STAG = 0.09;

/** Camera framing. `dollyFrom` is the starting distance factor, eased to 1 over `dollyS` seconds. */
export const CAMERA = {
  lookY: 0.88,
  lift: 0.1,
  tilt: 0.09,
  dollyFrom: 1.12,
  dollyS: 2.6,
} as const;

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

/** `v` limited to the range `a` to `b` (0 to 1 by default). */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Cubic ease-out. */
export function easeOut(k: number): number {
  return 1 - Math.pow(1 - k, 3);
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Where the open spring value `o` hands over from sliding out of the shelf to turning. */
export const OPEN_SPLIT = 0.38;

/**
 * Splits the single open spring value `o` (0..1) into two eased phases: `pull` slides the book
 * straight out of the shelf over [0, OPEN_SPLIT], then `present` carries it to the reading pose
 * and turns it over [OPEN_SPLIT, 1]. Closing is the same mapping run backwards.
 */
export function openPhases(o: number): { pull: number; present: number } {
  return {
    pull: smooth(clamp01(o / OPEN_SPLIT)),
    present: smooth(clamp01((o - OPEN_SPLIT) / (1 - OPEN_SPLIT))),
  };
}

/** Seconds until the last of `count` books has finished dropping. */
export function introSeconds(count: number): number {
  return 0.25 + STAG * (count - 1) + DROP;
}

/** Book height, width and spine thickness in world units. */
export function bookSize(
  b: Pick<SiteBook, "heightIn" | "aspect" | "pages">,
): { H: number; W: number; T: number } {
  const H = b.heightIn * INCH;
  return { H, W: H * b.aspect, T: 0.035 + b.pages * 0.00048 };
}

/** Drop-in progress 0..1 for the book at `order` after `elapsed` seconds. */
export function dropProgress(elapsed: number, order: number): number {
  return clamp01((elapsed - 0.25 - order * STAG) / DROP);
}

/**
 * Semi-implicit critically damped spring. Reads `o[key]` and `o[key + "V"]`
 * (velocity, default 0), writes both back, and returns whether it is still
 * moving. Snaps to `to` once it is within rest tolerance.
 */
export function spring(
  o: Record<string, number>,
  key: string,
  to: number,
  w: number,
  dt: number,
): boolean {
  const vKey = key + "V";
  const x = o[key];
  const v = o[vKey] || 0;
  const f = 1 + 2 * dt * w;
  const hoo = dt * w * w;
  const det = 1 / (f + dt * hoo);
  o[key] = det * (f * x + dt * v + dt * hoo * to);
  o[vKey] = det * (v + hoo * (to - x));
  if (Math.abs(to - o[key]) < 0.001 && Math.abs(o[vKey]) < 0.01) {
    o[key] = to;
    o[vKey] = 0;
    return false;
  }
  return true;
}

/** Camera distance that frames the shelf, and how far the camera may pan sideways. */
export function fitCamera(p: {
  fovDeg: number;
  aspect: number;
  span: number;
}): { dist: number; maxX: number } {
  const half = (p.fovDeg / 2) * (Math.PI / 180);
  // room above the tallest book (11 in) for the header and a hover lift
  const needH = 3.05;
  const needW = p.span + 0.9;
  const dW = needW / 2 / (Math.tan(half) * p.aspect);
  const dH = needH / 2 / Math.tan(half);
  const dist = Math.max(dH, Math.min(dW, dH * (p.aspect < 0.8 ? 1.3 : 2.3)));
  const maxX = Math.max(0, needW / 2 - Math.tan(half) * p.aspect * dist * 0.9);
  return { dist, maxX };
}

/** Camera height, distance and look-at height `elapsed` seconds after the intro starts. */
export function cameraAt(
  elapsed: number,
  dist: number,
): { y: number; distance: number; lookY: number } {
  const ci = easeOut(clamp01(elapsed / CAMERA.dollyS));
  const distance = dist * (CAMERA.dollyFrom - (CAMERA.dollyFrom - 1) * ci);
  return {
    y: CAMERA.lookY + CAMERA.lift + distance * CAMERA.tilt,
    distance,
    lookY: CAMERA.lookY,
  };
}
