/**
 * The maths of a scene drawn into a frame (round 7 follow-ups, spec 6.1 and 6.2). The wall and the shelf draw the open page for the
 * current window; with a frame set they draw that same picture scaled evenly until it covers the frame, centred, and
 * nothing outside the frame. Pure: the engines' DOM and GL work is frame-box.ts and their own files.
 */

/** A rectangle in CSS pixels in the window. */
export type Frame = { left: number; top: number; width: number; height: number };

/** The straight line from `box` at `e = 0` to the whole `vw` by `vh` window at `e = 1` (each number exact at both ends). */
export function frameAt(box: Frame, vw: number, vh: number, e: number): Frame {
  const mix = (a: number, b: number) => (1 - e) * a + e * b;
  return {
    left: mix(box.left, 0),
    top: mix(box.top, 0),
    width: mix(box.width, vw),
    height: mix(box.height, vh),
  };
}

/** How much the open page's picture is scaled to cover `frame`: the larger of the width and height shares (1 for the whole window). */
export function gluedScale(frame: Frame, vw: number, vh: number): number {
  return Math.max(frame.width / vw, frame.height / vh);
}

/**
 * Where a picture goes: the canvas's CSS size, its drawing buffer and the whole window's picture inside the buffer, all
 * in device pixels (`x` and `y` from the buffer's top-left corner, negative when the picture is larger than the frame and cropped by it).
 */
export type FrameView = {
  cssW: number;
  cssH: number;
  bufW: number;
  bufH: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** CSS pixels of the frame per CSS pixel of the window. */
  scale: number;
  /** The picture fills the buffer exactly (no frame, or one that covers the window): nothing is offset and nothing cropped. */
  full: boolean;
};

/**
 * The view for `frame` (null: the whole window, as before frames existed) of a `vw` by `vh` window at `dpr` device pixels per
 * CSS pixel. A frame that covers the window gives exactly the view of no frame.
 */
export function frameView(frame: Frame | null, vw: number, vh: number, dpr: number): FrameView {
  if (!frame) {
    const bufW = Math.max(1, Math.round(vw * dpr));
    const bufH = Math.max(1, Math.round(vh * dpr));
    return { cssW: vw, cssH: vh, bufW, bufH, x: 0, y: 0, w: bufW, h: bufH, scale: 1, full: true };
  }
  const scale = gluedScale(frame, vw, vh);
  const bufW = Math.max(1, Math.round(frame.width * dpr));
  const bufH = Math.max(1, Math.round(frame.height * dpr));
  // never a pixel short of the buffer (rounding must not leave a bare column or row)
  const w = Math.max(bufW, Math.round(vw * scale * dpr));
  const h = Math.max(bufH, Math.round(vh * scale * dpr));
  const x = Math.round((bufW - w) / 2);
  const y = Math.round((bufH - h) / 2);
  return {
    cssW: frame.width,
    cssH: frame.height,
    bufW,
    bufH,
    x,
    y,
    w,
    h,
    scale,
    full: x === 0 && y === 0 && w === bufW && h === bufH,
  };
}

/**
 * How many device pixels a drawing buffer is allocated in while a frame moves (`FrameOptions.coarse`): setting a canvas's size
 * allocates its buffer anew, and a frame that grows every animation frame would do it at every frame (measured: 5 to 9 ms a
 * frame at 4 times slower, two thirds of the budget). The buffer keeps its size while it still covers what is needed and is at most this
 * much larger, and goes up (or down) to the next multiple of it otherwise; the picture is drawn into the whole buffer and shown at the frame's CSS size.
 */
export const COARSE_STEP = 256;

/** A buffer up to this share smaller than the picture needs is kept as it is: it is shown stretched by that little, which no eye sees, and the first frames of a move (where the frame has grown by a pixel or two) draw exactly what the box at rest drew (the click changes no pixel of the picture). */
export const COARSE_SHORT = 0.02;

/**
 * The buffer size, in device pixels, for a picture that needs `needed` of them when the buffer is now `held` (0 for none): the same
 * `held` while `needed * (1 - COARSE_SHORT) <= held < needed + step`, else `needed` rounded up to a multiple of `step`, but not above `cap` (the buffer
 * the move ends with) unless the need itself is above it. Never more than `COARSE_SHORT` smaller than `needed`.
 */
export function coarseBuffer(needed: number, held: number, step: number = COARSE_STEP, cap: number = Infinity): number {
  const need = Math.max(1, Math.ceil(needed));
  if (held >= need * (1 - COARSE_SHORT) && held - need < step) return held;
  // `cap` (the window's own size) is where the opening ends: the buffer is exactly that there, so the end of the move allocates nothing
  return Math.min(Math.ceil(need / step) * step, Math.max(cap, need));
}

/** The part of the `vw` by `vh` window's picture that `frame` shows, in window pixels (the whole window for none, or for a frame that covers it). */
export function subWindow(frame: Frame | null, vw: number, vh: number): { x: number; y: number; w: number; h: number } {
  if (!frame) return { x: 0, y: 0, w: vw, h: vh };
  const s = gluedScale(frame, vw, vh);
  const w = frame.width / s;
  const h = frame.height / s;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

/** Where a canvas laid over a region of the picture goes in a frame (`placeRegion`). */
export type RegionPlacement = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  /** How much to cut off each side (top, right, bottom, left), in the canvas's own pixels, to stay inside the frame. */
  inset: [number, number, number, number];
};

/**
 * Where a canvas that covers `region` of the open page's picture (the shelf's dot field, which has its own canvas) goes so it is
 * part of the same picture when `frame` shows `sub` of it: its top-left corner in the window, the scale about that corner, and how much to cut off each
 * side to stay inside the frame. `sub` and `region` are in the picture's pixels, the canvas is `region.w` by `region.h` of its own.
 */
export function placeRegion(frame: Frame, sub: { x: number; y: number; w: number; h: number }, region: { x: number; y: number; w: number; h: number }): RegionPlacement {
  const scale = frame.width / sub.w;
  const cut = (n: number) => Math.max(0, n);
  return {
    left: frame.left + (region.x - sub.x) * scale,
    top: frame.top + (region.y - sub.y) * scale,
    width: region.w,
    height: region.h,
    scale,
    inset: [
      cut(sub.y - region.y),
      cut(region.x + region.w - (sub.x + sub.w)),
      cut(region.y + region.h - (sub.y + sub.h)),
      cut(sub.x - region.x),
    ],
  };
}

/**
 * Where a canvas that is `vw` wide and `ledgeTop` tall in window pixels goes when the frame covers the window's picture
 * (`subWindow`): `placeRegion` for the window's top part. Null while there is no row yet.
 */
export function dotPlacement(frame: Frame, vw: number, vh: number, ledgeTop: number): RegionPlacement | null {
  if (!(ledgeTop > 0)) return null;
  return placeRegion(frame, subWindow(frame, vw, vh), { x: 0, y: 0, w: vw, h: ledgeTop });
}

/** True when the two frames are the same place and size (null is the whole window). */
export function sameFrame(a: Frame | null, b: Frame | null): boolean {
  if (!a || !b) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/** True when the two frames are the same size (a move alone needs no new picture). */
export function sameFrameSize(a: Frame | null, b: Frame | null): boolean {
  if (!a || !b) return a === b;
  return a.width === b.width && a.height === b.height;
}

/** A docked scene draws at most this often: 30 a second. */
export const DOCKED_MS = 1000 / 30;
/** A frame arrives a little before or after its time on a screen's own clock: this much slack keeps a 60 Hz screen at every second frame. */
const SLACK_MS = 1;

/** Whether a frame at `now` may draw, `last` being when the last one did (ms). Always when not docked. */
export function drawDue(now: number, last: number, docked: boolean): boolean {
  return !docked || now - last >= DOCKED_MS - SLACK_MS;
}
