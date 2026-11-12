import type { SiteBook } from "~/types";

/**
 * The shelf's pure math: sizes, timing, the spring and the camera fit.
 * No three.js and no DOM, so it is unit tested. Ported from the `Shelf`
 * module of docs/redesign/mockups/home-v4.html.
 */

/** World units per inch of book height. */
export const INCH = 0.17;
/** Front edge of the books (z). */
export const FRONT = 0.55;
/** The wall behind the books (z). */
export const WALLZ = FRONT - 1.4;
/** The gap between neighbouring spines in the row (world units). */
export const SHELF_GAP = 0.014;
/** Seconds each book takes to fall in and fade up. */
export const DROP = 1.5;
/** How far each book falls while it drops in (world units; straight down, no tilt). */
export const DROP_FALL = 0.6;
/** Seconds between one book starting to fall and the next. */
export const STAG = 0.09;

/** A stage narrower than this (px) starts the shelf at its left end. */
export const NARROW_PX = 700;

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

/** The tallest spine fills at most this share of the layer's height (spec 8). */
export const TALL_MAX = 0.78;
/** The row fills at most this share of the layer's width. */
export const ROW_MAX = 0.88;
/** On a narrow screen the tallest spine never goes below this share of the height; the row pans instead. */
export const TALL_MIN = 0.56;
/** The line the books stand on, as a share of the layer's height from its top. */
export const BASE_AT = 0.9;
/** The hairline the books stand on, in CSS pixels. */
export const LINE_PX = 1;

/**
 * How large the flat, face-on row is: `scale` is CSS pixels per world unit. The tallest spine fills
 * at most 78% of the height and the row at most 88% of the width; when the width rule would shrink
 * the tallest spine below 56% of the height the height keeps 56% and the row `pans` sideways.
 * `rowWidth` and `tallest` are in world units, `vw` and `vh` in pixels.
 */
export function flatFit(p: { vw: number; vh: number; rowWidth: number; tallest: number }): {
  scale: number;
  pans: boolean;
} {
  const byHeight = (TALL_MAX * p.vh) / p.tallest;
  const byWidth = (ROW_MAX * p.vw) / p.rowWidth;
  const floor = (TALL_MIN * p.vh) / p.tallest;
  const scale = Math.min(byHeight, byWidth);
  return scale < floor ? { scale: floor, pans: true } : { scale, pans: false };
}

/**
 * The whole flat frame for a stage `vw` by `vh` px and a row `span` world units wide whose tallest
 * book is `tallest` high: the scale, whether it pans, the pixel row of the line the books stand on,
 * how far the camera may pan (world units each way; the row's ends stop 6% of the width inside the
 * edges), the row's `reach` in world units (the row and that margin both sides: the hairline's
 * width) and the share of the reach that is on screen at once. The 3D shelf and its
 * placeholder both read this, so one replaces the other without a jump.
 */
export function flatFrame(p: { vw: number; vh: number; span: number; tallest: number }): {
  scale: number;
  pans: boolean;
  baseRow: number;
  maxX: number;
  reach: number;
  visible: number;
} {
  const { scale, pans } = flatFit({ vw: p.vw, vh: p.vh, rowWidth: p.span, tallest: p.tallest });
  const viewW = p.vw / scale;
  const reach = p.span + 2 * 0.06 * viewW;
  return {
    scale,
    pans,
    baseRow: Math.round(BASE_AT * p.vh),
    maxX: pans ? Math.max(0, reach / 2 - viewW / 2) : 0,
    reach,
    visible: Math.min(1, viewW / reach),
  };
}

/** The camera's x when the shelf opens: the left end on a narrow screen (the first book is whole), else centred. */
export function initialCamX(maxX: number, narrow: boolean): number {
  return narrow ? -maxX : 0;
}

/**
 * The camera x while dragging: `startX` (the camera when the drag began) moved against the pointer
 * by `dxPx`, in world units at `scale` pixels per world unit, clamped to the shelf's ends. The
 * books follow the pointer one to one.
 */
export function panFromDrag(startX: number, dxPx: number, scale: number, maxX: number): number {
  return clamp(startX - dxPx / scale, -maxX, maxX);
}

/** Speed (world units per second) below which a flick has settled. */
const FLICK_STOP = 0.02;

/**
 * One step of a flick after release: the speed `v` (units per second) loses 95 percent each
 * second and the camera moves `dx` units. Settles to exactly 0 under 0.02 units per second.
 */
export function flick(v: number, dt: number): { dx: number; v: number } {
  const next = v * Math.pow(0.05, dt);
  if (Math.abs(next) < FLICK_STOP) return { dx: 0, v: 0 };
  return { dx: next * dt, v: next };
}

/** The marker is shown only when the shelf is wider than the screen, so its thumb is shorter than the track. */
export function markerShown(maxX: number, visible: number): boolean {
  return maxX > 0 && visible < 0.999;
}

/** The position marker's thumb: its left edge as a share (0..1) of the track, for the camera at `camX`. */
export function markerLeft(camX: number, maxX: number, visible: number): number {
  if (maxX <= 0) return 0;
  return clamp((camX + maxX) / (2 * maxX)) * (1 - visible);
}

/**
 * Pixels the shelf should pan for a wheel event, or null when the event is not a sideways one: a
 * mostly horizontal wheel (trackpad two-finger swipe) pans by `deltaX`; with shift held the
 * vertical wheel pans by `deltaY`.
 */
export function wheelPanPx(deltaX: number, deltaY: number, shift: boolean): number | null {
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX;
  if (shift && deltaY !== 0) return deltaY;
  return null;
}
