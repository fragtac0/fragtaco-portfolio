// Pure helpers for the timeline's motion and input: easing, the pulse, how a wheel event is read, where
// the whole grid fits on a screen, and how a focused cell moves. Nothing here touches the window.
import { fitView, type View } from "./timeline-math";

/** Zoom and arrow-key moves ease over this long. */
export const EASE_MS = 180;
/** Pixels one arrow-key press pans. */
export const PAN_STEP = 48;
/** The most the zoom can reach, in pixels per cell. */
export const MAX_SCALE = 72;
/** Today's cell breathes once in this long. */
export const PULSE_MS = 2400;

export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));

  return 1 - u * u * u;
}

/** A view part of the way (0 to 1) from one to another. Scale and position move together, so a point held by the pointer stays put. */
export function lerpView(a: View, b: View, t: number): View {
  return {
    scale: a.scale + (b.scale - a.scale) * t,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/** Today's opacity: 100% at the start of each breath, 70% half a breath later. */
export function pulseAlpha(ms: number): number {
  return 0.85 + 0.15 * Math.cos((2 * Math.PI * ms) / PULSE_MS);
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Room kept clear round the fitted grid: on wide screens the label block on the left and the
 * dock below, on phones the label row above and the dock below. The grid is centred in what is left.
 */
export function fitInsets(vw: number): Insets {
  return vw < 700
    ? { top: 100, right: 12, bottom: 100, left: 12 }
    : { top: 28, right: 64, bottom: 108, left: 360 };
}

/** The view that shows the whole grid inside the screen less its insets. */
export function fitWithInsets(cols: number, rows: number, vw: number, vh: number, insets: Insets): View {
  const w = Math.max(1, vw - insets.left - insets.right);
  const h = Math.max(1, vh - insets.top - insets.bottom);
  const view = fitView(cols, Math.max(1, rows), w, h, 0);

  return { scale: view.scale, x: view.x + insets.left, y: view.y + insets.top };
}

export type WheelIntent = "zoom" | "pan";

/**
 * A wheel event is a zoom when it is a pinch (ctrl held), counts in lines, or is one big step of a
 * mouse wheel; it is a pan when it looks like two fingers on a trackpad (small steps, a sideways part,
 * fractions) or follows one within 400 ms (the tail of a flick).
 */
export function wheelIntent(e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean }, msSincePan: number): WheelIntent {
  if (e.ctrlKey || e.deltaMode !== 0) return "zoom";
  if (e.deltaX !== 0 || !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 40) return "pan";

  return msSincePan < 400 ? "pan" : "zoom";
}

/** The zoom factor for a wheel step: scrolling up (negative deltaY) zooms in. A pinch counts for more per pixel. */
export function wheelZoomFactor(e: { deltaY: number; deltaMode: number; ctrlKey: boolean }): number {
  const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  const clamped = Math.max(-240, Math.min(240, px));

  return Math.exp(-clamped * (e.ctrlKey ? 0.01 : 0.0015));
}

/** The day a focus move lands on: one day left or right, one row up or down, kept inside 0 to total - 1. */
export function moveFocus(index: number, key: string, cols: number, total: number): number {
  const step = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowUp" ? -cols : key === "ArrowDown" ? cols : 0;
  if (total <= 0) return 0;

  return Math.min(total - 1, Math.max(0, index + step));
}

/** The view moved the least that brings a cell fully inside the screen with `pad` to spare; unchanged if it already is. */
export function revealCell(view: View, index: number, cols: number, vw: number, vh: number, pad: number): View {
  const left = view.x + (index % cols) * view.scale;
  const top = view.y + Math.floor(index / cols) * view.scale;
  let dx = 0;
  let dy = 0;
  if (left < pad) dx = pad - left;
  else if (left + view.scale > vw - pad) dx = vw - pad - (left + view.scale);
  if (top < pad) dy = pad - top;
  else if (top + view.scale > vh - pad) dy = vh - pad - (top + view.scale);

  return dx === 0 && dy === 0 ? view : { scale: view.scale, x: view.x + dx, y: view.y + dy };
}

/** True when two views differ by less than half a pixel in each part (scale by 0.01 of a pixel). */
export function sameView(a: View, b: View): boolean {
  return Math.abs(a.scale - b.scale) < 0.01 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}
