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

/** How far a book rises when opened, as a share of its height (spec 8). */
export const LIFT = 0.38;
/** Seconds an open or a close takes (spec 8). */
export const OPEN_SECONDS = 0.62;
/** The open progress at which the rise has finished. */
export const RISE_END = 0.45;
/** The open progress at which the turn starts (it overlaps the end of the rise a little). */
export const TURN_START = 0.4;

/**
 * Splits the open progress `o` (0..1) into two eased phases: `rise` lifts the book straight up over
 * [0, 45%], `turn` carries it round to its cover over [40%, 100%]. Closing is the same mapping
 * run backwards.
 */
export function liftPhases(o: number): { rise: number; turn: number } {
  return {
    rise: smooth(clamp01(o / RISE_END)),
    turn: smooth(clamp01((o - TURN_START) / (1 - TURN_START))),
  };
}

/**
 * One step of the open progress `o` towards `target` (0 or 1): it moves at a steady rate, so a full
 * open or close takes `OPEN_SECONDS`, and reverses from wherever it is if the target changes.
 */
export function stepOpen(o: number, target: 0 | 1, dt: number): number {
  const d = dt / OPEN_SECONDS;
  return target > o ? Math.min(target, o + d) : Math.max(target, o - d);
}

/** The row's brightness while a book is open, as a share of its full strength (spec 8: 70%). */
export const ROW_DIM = 0.7;

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

/** The tallest spine fills at most this share of the layer's height (spec 8), and never goes under the header. */
export const TALL_MAX = 0.78;
/** The row fills at most this share of the layer's width. */
export const ROW_MAX = 0.88;
/** On a narrow screen the tallest spine never goes below this share of the height (unless the header's room is less); the row pans instead. */
export const TALL_MIN = 0.7;
/** The line the books stand on, as a share of the layer's height from its top. */
export const BASE_AT = 0.9;
/** Room kept under the line for the marker and a two line hint, in CSS pixels (a small stage lifts the line to leave it). */
export const BOTTOM_PX = 84;
/** The hairline the books stand on, in CSS pixels. */
export const LINE_PX = 1;
/** The painted cover's widest and narrowest width in pixels (`coverPixels`). */
export const COVER_PX_MAX = 1024;
export const COVER_PX_MIN = 256;
/** The most device pixels the renderer draws per CSS pixel (a frame-cost cap: see shelf-scene.ts). */
export const RENDER_DPR_MAX = 1.75;
/**
 * The width, in pixels, to paint a cover at: its size on screen when open (CSS px) times the pixel
 * ratio the renderer draws at (at most `RENDER_DPR_MAX`), so the texture is about as large as the
 * picture it makes, never much larger (a texture larger than its picture is blurred by the GPU's
 * own filtering) and never past a memory limit.
 */
export function coverPixels(cssWidth: number, dpr: number): number {
  return Math.round(clamp(cssWidth * clamp(dpr, 1, RENDER_DPR_MAX), COVER_PX_MIN, COVER_PX_MAX));
}
/** Clear space kept between the layer's header and the tallest spine's top, in CSS pixels. */
export const HEAD_GAP = 8;
/**
 * The header's height before it has been measured (`headerBottom`), worked out from layer.css: a
 * 120 px minimum, or its top padding (20 px under 700 px wide, else 4% of the width from 28 to 56),
 * the title (`--t-title`: 2.4% of the width from 24 to 38 px, line height 0.84), 8 px, the 13 px
 * meta line (19.5 px) and 22 px under it. It matches the measured header to the pixel at 1440 and
 * 2560 wide, so the first fit of a mount rarely has to repaint the spines.
 */
export function headGuess(vw: number): number {
  const pad = vw < 700 ? 20 : clamp(0.04 * vw, 28, 56);
  const title = 0.84 * clamp(0.024 * vw, 24, 38);
  return Math.max(120, Math.ceil(pad + title + 8 + 19.5 + 22));
}

/**
 * How large the flat, face-on row is: `scale` is CSS pixels per world unit. The tallest spine fills
 * at most 78% of the height (and never more than `room`, the pixels between the header and the
 * line, so it never runs into the header) and the row at most 88% of the width; when the width
 * rule would shrink the tallest spine below 70% of the height (or below `room`, if that is less)
 * the height keeps that and the row `pans` sideways. `rowWidth` and `tallest` are in world units,
 * `vw`, `vh` and `room` in pixels.
 */
export function flatFit(p: {
  vw: number;
  vh: number;
  rowWidth: number;
  tallest: number;
  room?: number;
}): {
  scale: number;
  pans: boolean;
} {
  const room = p.room ?? Infinity;
  const byHeight = Math.min(TALL_MAX * p.vh, room) / p.tallest;
  const byWidth = (ROW_MAX * p.vw) / p.rowWidth;
  const floor = Math.min(TALL_MIN * p.vh, room) / p.tallest;
  const scale = Math.min(byHeight, byWidth);
  return scale < floor ? { scale: floor, pans: true } : { scale, pans: false };
}

/**
 * The whole flat frame for a stage `vw` by `vh` px and a row `span` world units wide whose tallest
 * book is `tallest` high, under a header whose bottom is `top` px from the stage's top: the scale,
 * whether it pans, the pixel row of the line the books stand on (90% of the height, but never
 * closer than 84 px to the bottom, so a small stage keeps its hint clear), how far the camera may
 * pan (world units each way; the row's ends stop 6% of the width inside the edges), the row's
 * `reach` in world units (the row and that margin both sides: the hairline's width) and the share
 * of the reach that is on screen at once. The height rule reads the room between the header
 * (plus `HEAD_GAP`) and the line. The 3D shelf and its placeholder both read this, so one replaces
 * the other without a jump.
 */
export function flatFrame(p: {
  vw: number;
  vh: number;
  span: number;
  tallest: number;
  top: number;
}): {
  scale: number;
  pans: boolean;
  baseRow: number;
  maxX: number;
  reach: number;
  visible: number;
} {
  const baseRow = Math.round(Math.min(BASE_AT * p.vh, p.vh - BOTTOM_PX));
  const room = Math.max(1, baseRow - p.top - HEAD_GAP);
  const { scale, pans } = flatFit({
    vw: p.vw,
    vh: p.vh,
    rowWidth: p.span,
    tallest: p.tallest,
    room,
  });
  const viewW = p.vw / scale;
  const reach = p.span + 2 * 0.06 * viewW;
  return {
    scale,
    pans,
    baseRow,
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
