// What the map's input means (spec 9.2), as pure functions: no DOM, no timers. `map-input.ts` reads the events,
// asks these what to do and applies the answer to the map.
//
// Screen positions given to these (px, py) are CSS pixels from the screen's centre, as `zoomAbout` takes them.
import type { Manifest } from "./geo";
import { clampView, EXPLORE_MIN, fitScale, fitView, MAX_SCALE, zoomAbout, type View } from "./view";

type Size = Pick<Manifest, "size">;

export type Mode = "overview" | "explore";

/** What an input asks of the map. `enter` and `fit` are the 700 ms moves between the two states. */
export type Action =
  | { kind: "none" }
  | { kind: "fit" }
  | { kind: "enter"; view: View }
  | { kind: "view"; view: View };

/** One `+` or `-` press, one button press: the scale changes by this factor. */
export const ZOOM_STEP = 1.6;
/** A held arrow key pans this many screen pixels a second. */
export const PAN_SPEED = 720;
/** Two taps within this many milliseconds and pixels are a double tap. */
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_PX = 28;
/** A pointer that moves less than this has not started dragging. */
export const DRAG_SLOP = 4;
/** A pinch that began in the overview and ends above this many times the fit scale goes on into explore. */
export const PINCH_ENTER = 1.25;

const NONE: Action = { kind: "none" };

/** Explore from a scale a little above the fit scale; the overview is the fit scale itself. */
export function modeOf(v: View, vw: number, vh: number, m: Size): Mode {
  return v.scale > fitScale(vw, vh, m) * 1.02 ? "explore" : "overview";
}

/** The overview, with the picture's own point under (px, py) kept still, at `EXPLORE_MIN` times the fit scale. */
export function enterAt(vw: number, vh: number, m: Size, px: number, py: number): View {
  return clampView(zoomAbout(fitView(vw, vh, m), EXPLORE_MIN, px, py), vw, vh, m);
}

/**
 * How much a wheel event zooms by: smooth for a mouse wheel's steps and for a trackpad's stream. `deltaMode`
 * 1 is lines and 2 is pages (a few browsers); a pinch on a trackpad arrives as a wheel with the control key down
 * and small deltas, so it counts for more. Zooming in is `deltaY < 0`.
 */
export function wheelFactor(deltaY: number, deltaMode: number, ctrl: boolean): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const f = Math.exp(-Math.max(-240, Math.min(240, px)) * (ctrl ? 0.01 : 0.0016));

  return f;
}

/** A wheel event over (px, py): `factor` is from `wheelFactor`. */
export function wheelAction(v: View, factor: number, px: number, py: number, vw: number, vh: number, m: Size): Action {
  if (modeOf(v, vw, vh, m) === "overview") return factor > 1 ? { kind: "enter", view: enterAt(vw, vh, m, px, py) } : NONE;

  const next = v.scale * factor;

  // zooming out past the start of explore is the way back to the overview
  if (factor < 1 && next < EXPLORE_MIN * fitScale(vw, vh, m) * 0.999) return { kind: "fit" };
  if (factor > 1 && v.scale >= MAX_SCALE) return NONE;

  return { kind: "view", view: clampView(zoomAbout(v, factor, px, py), vw, vh, m) };
}

/** A button, a key or a double tap: zoom by `factor` about (px, py), with the same way into and out of explore. */
export function stepAction(v: View, factor: number, px: number, py: number, vw: number, vh: number, m: Size): Action {
  return wheelAction(v, factor, px, py, vw, vh, m);
}

/** Drag the picture by (dx, dy) screen pixels. */
export function panView(v: View, dx: number, dy: number, vw: number, vh: number, m: Size): View {
  return clampView({ ...v, cx: v.cx - dx / v.scale, cy: v.cy - dy / v.scale }, vw, vh, m);
}

/**
 * The view while two fingers are down. `start` is the view when the second finger touched, `startDist` the
 * distance between the fingers then and `startMid` their midpoint; `dist` and `mid` are the same now. The picture
 * point that was under the first midpoint stays under the finger midpoint, so a pinch both zooms and pans.
 */
export function pinchView(
  start: View,
  startDist: number,
  startMid: { x: number; y: number },
  dist: number,
  mid: { x: number; y: number },
  vw: number,
  vh: number,
  m: Size,
): View {
  const scale = Math.min(MAX_SCALE, Math.max(fitScale(vw, vh, m), start.scale * (dist / Math.max(1, startDist))));
  // the picture point under the starting midpoint
  const px = start.cx + startMid.x / start.scale;
  const py = start.cy + startMid.y / start.scale;

  return clampView({ cx: px - mid.x / scale, cy: py - mid.y / scale, scale }, vw, vh, m);
}

/** What happens when a pinch ends: the mode it started in and the view it ended with decide. */
export function pinchEnd(from: Mode, v: View, vw: number, vh: number, m: Size): Action {
  const fit = fitScale(vw, vh, m);

  if (from === "overview") {
    if (v.scale <= fit * PINCH_ENTER) return { kind: "fit" };

    return v.scale >= EXPLORE_MIN * fit ? NONE : { kind: "enter", view: clampView({ ...v, scale: EXPLORE_MIN * fit }, vw, vh, m) };
  }

  return v.scale < EXPLORE_MIN * fit * 0.999 ? { kind: "fit" } : NONE;
}

export type Tap = { t: number; x: number; y: number };

/** Is this tap the second of a double tap? */
export function isDoubleTap(prev: Tap | null, now: Tap): boolean {
  return prev !== null && now.t - prev.t <= DOUBLE_TAP_MS && Math.hypot(now.x - prev.x, now.y - prev.y) <= DOUBLE_TAP_PX;
}

export type KeyAction = "in" | "out" | "fit" | "prev" | "next";

/** The map's own keys. Arrow keys are handled apart (they pan while held). */
export function keyAction(key: string): KeyAction | null {
  switch (key) {
    case "+":
    case "=":
      return "in";
    case "-":
    case "_":
      return "out";
    case "0":
    case "Escape":
      return "fit";
    case "[":
      return "prev";
    case "]":
      return "next";
    default:
      return null;
  }
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export const isArrow = (key: string) => key in ARROWS;

/** The screen distance a set of held arrow keys moves the view in `dtMs` (positive x: the picture slides left). */
export function arrowStep(keys: ReadonlySet<string>, dtMs: number): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;

  for (const k of keys) {
    const d = ARROWS[k];

    if (d) {
      dx += d[0];
      dy += d[1];
    }
  }
  const len = Math.hypot(dx, dy);

  if (len === 0) return { dx: 0, dy: 0 };
  const dist = (PAN_SPEED * Math.min(dtMs, 50)) / 1000;

  return { dx: (dx / len) * dist, dy: (dy / len) * dist };
}
