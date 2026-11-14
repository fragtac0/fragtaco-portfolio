import { frameView, sameFrame, sameFrameSize, type Frame, type FrameView } from "./frame-math";

/**
 * The frame an engine's canvas is drawn into (client only; the maths is frame-math.ts). One box serves the wall and the shelf:
 * it holds the asked-for frame, writes the canvas's place (fixed at the frame, in window pixels), tells the engine when the
 * picture needs drawing again, and answers `whenDrawn`.
 *
 * A frame asked for while the engine's loop runs is not applied at once but by the loop, in the frame it draws (`hasPending`,
 * `commit`): the canvas's size and its picture then change in one go, so a buffer that was just resized is never shown empty and
 * a stretched old picture is never shown for a frame. When the loop is not running the caller commits at once.
 */

/** The window the open page is laid out for: what a fixed layer with `inset: 0` fills (the viewport without its scroll bars). */
export function windowSize(): [number, number] {
  const e = document.documentElement;
  return [e.clientWidth || window.innerWidth, e.clientHeight || window.innerHeight];
}

export type FrameBox = {
  /** The frame in force, or null for the whole window. */
  frame(): Frame | null;
  /** Asks for a frame (null: the whole window). Nothing changes until `commit`. */
  request(frame: Frame | null): void;
  hasPending(): boolean;
  /**
   * Applies the asked-for frame to the canvas's style. "resized": the picture's size changed (it must be drawn again); "moved":
   * only its place did (nothing to draw); "none": nothing was asked, or the same frame.
   */
  commit(): "none" | "moved" | "resized";
  /** Where the picture goes in a `vw` by `vh` window at `dpr`, for the frame in force. */
  view(vw: number, vh: number, dpr: number): FrameView;
  /** The next draw is the first one for the frame in force (a new run, a new window size). */
  invalidate(): void;
  /** The engine drew a frame. */
  drawn(): void;
  /** Resolves after the first frame drawn with the frame in force, or with the one asked for if its size differs (at once when that has happened). */
  whenDrawn(): Promise<void>;
  /** Puts the canvas's own style back (the stylesheet decides its place again) and lets any waiter go. */
  release(): void;
};

const PLACED = ["position", "left", "top", "right", "bottom", "width", "height"] as const;

/**
 * Takes back what a frame wrote to an element's style, so the stylesheet decides its place and size again. The inline
 * `transition: none` stays one more frame: a stylesheet's blanket transition (reduced motion's 0.01 ms on everything) would
 * otherwise start on the size changing back and hold the old size for a frame, and the engine reads the size in that frame.
 */
export function clearPlacement(el: HTMLElement | HTMLCanvasElement, props: readonly string[], stillFramed: () => boolean): void {
  for (const p of props) el.style.removeProperty(p);
  const done = () => {
    if (!stillFramed()) el.style.removeProperty("transition");
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(done);
  else done();
}

/** Stops a stylesheet's blanket transition from holding a new frame's size back a frame (see `clearPlacement`). */
export const noTransition = (el: HTMLElement | HTMLCanvasElement) => el.style.setProperty("transition", "none", "important");

export function createFrameBox(canvas: HTMLCanvasElement): FrameBox {
  let frame: Frame | null = null;
  let asked: Frame | null = null;
  let pending = false;
  /** No frame has been drawn since the last run, window size or committed new size. */
  let stale = true;
  let waiters: Array<() => void> = [];

  const place = (f: Frame | null) => {
    const s = canvas.style;
    if (!f) {
      clearPlacement(canvas, PLACED, () => frame !== null);
      return;
    }
    s.position = "fixed";
    s.left = `${f.left}px`;
    s.top = `${f.top}px`;
    s.right = "auto";
    s.bottom = "auto";
    s.width = `${f.width}px`;
    s.height = `${f.height}px`;
    noTransition(canvas);
  };
  const flush = () => {
    const go = waiters;
    waiters = [];
    for (const r of go) r();
  };

  return {
    frame: () => frame,
    request(f) {
      asked = f;
      pending = true;
    },
    hasPending: () => pending,
    commit() {
      if (!pending) return "none";
      pending = false;
      if (sameFrame(frame, asked)) return "none";
      const resized = !sameFrameSize(frame, asked);
      frame = asked;
      place(frame);
      if (resized) stale = true;
      return resized ? "resized" : "moved";
    },
    view: (vw, vh, dpr) => frameView(frame, vw, vh, dpr),
    invalidate() {
      stale = true;
    },
    drawn() {
      stale = false;
      if (waiters.length) flush();
    },
    whenDrawn() {
      // a frame of another size that is asked for but not yet applied also counts: the picture drawn now is not the one asked for
      const waiting = stale || (pending && !sameFrameSize(frame, asked));
      return waiting ? new Promise<void>((r) => waiters.push(r)) : Promise.resolve();
    },
    release() {
      pending = false;
      frame = null;
      place(null);
      flush();
    },
  };
}
