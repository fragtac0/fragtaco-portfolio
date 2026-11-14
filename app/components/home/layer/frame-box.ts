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

/** What `whenDrawn` answers: "drawn" when a frame was drawn with the frame asked for, "stopped" when the engine can draw no frame for it (see `FrameBox.whenDrawn`). */
export type DrawnResult = "drawn" | "stopped";

/** How a frame is asked for. */
export type FrameOptions = {
  /**
   * Default true: the box writes the canvas's place (fixed at the frame, in window pixels). False: the caller owns the canvas's
   * place and size (for example the canvas fills its home box and scrolls with the page, with no per-scroll work): the box writes
   * nothing to the canvas's style, takes only the frame's SIZE (the picture is computed from it) and a move of the frame is nothing.
   * Switching between the two at the same size changes the style only, never the picture.
   */
  place?: boolean;
  /**
   * Called once, by `commit`, right after this frame is in force: in the engine's own frame, before it sizes its buffer and
   * draws. A caller whose own element must follow the frame exactly (the home box's growing frame) writes it here, so the
   * element and the picture change in the same frame whatever order the page's animation-frame callbacks run in. Dropped
   * if a later request replaces this one before it is committed, and by `release`.
   */
  onApplied?: () => void;
};

/** How a scene is docked (`setDocked`). */
export type DockOptions = {
  /** Draw at no more than this many device pixels per CSS pixel while docked (default: today's, the screen's up to 2 for the wall and 1.75 for the shelf). */
  maxDpr?: number;
};

export type FrameBox = {
  /** The frame in force, or null for the whole window. */
  frame(): Frame | null;
  /** Whether the box writes the canvas's place for the frame in force (see `FrameOptions.place`). */
  placed(): boolean;
  /** Asks for a frame (null: the whole window). Nothing changes until `commit`. */
  request(frame: Frame | null, opts?: FrameOptions): void;
  hasPending(): boolean;
  /**
   * Applies the asked-for frame. "resized": the picture's size changed (it must be drawn again); "moved": only the canvas's style
   * changed, by a move of a placed frame or by switching `place` (nothing to draw); "none": nothing was asked, the same frame, or
   * a move of an unplaced frame.
   */
  commit(): "none" | "moved" | "resized";
  /** Where the picture goes in a `vw` by `vh` window at `dpr`, for the frame in force. */
  view(vw: number, vh: number, dpr: number): FrameView;
  /** The next draw is the first one for the frame in force (a new run, a new window size). */
  invalidate(): void;
  /** The engine drew a frame. */
  drawn(): void;
  /** The engine's loop is starting (it may still be preparing): `whenDrawn` waits for its first frame. */
  resume(): void;
  /** The engine can draw no frame (stopped, unmounted, disposed, failed or lost its context): every waiter is let go with "stopped". */
  abandon(): void;
  /**
   * Resolves "drawn" after the first frame drawn with the frame in force, or with the one asked for if its size differs (at once
   * when that has happened). It never hangs: it resolves "stopped" when the engine stops, unmounts, is disposed, fails to draw or
   * loses its context, and at once when no loop is running and no picture is waiting to be drawn (call it after `start()`).
   */
  whenDrawn(): Promise<DrawnResult>;
  /** Puts the canvas's own style back (the stylesheet decides its place again) and lets any waiter go. */
  release(): void;
};

const PLACED = ["position", "left", "top", "right", "bottom", "width", "height"] as const;

/** What a frame's inline transition override replaced, per element (so it can be put back). */
const savedTransition = new WeakMap<object, { value: string; priority: string }>();

/**
 * Takes back what a frame wrote to an element's style, so the stylesheet decides its place and size again, and puts back the
 * inline `transition-property` the element had. The override stays one more frame: a stylesheet's blanket transition (reduced
 * motion's 0.01 ms on everything) would otherwise start on the size changing back and hold the old size for a frame, and the
 * engine reads the size in that frame.
 */
export function clearPlacement(
  el: HTMLElement | HTMLCanvasElement,
  props: readonly string[],
  stillFramed: () => boolean,
): void {
  for (const p of props) el.style.removeProperty(p);
  const done = () => {
    const was = savedTransition.get(el);
    if (stillFramed() || !was) return;
    savedTransition.delete(el);
    if (was.value) el.style.setProperty("transition-property", was.value, was.priority);
    else el.style.removeProperty("transition-property");
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(done);
  else done();
}

/**
 * Stops a stylesheet's transition on size and place from holding a new frame's size back a frame (see `clearPlacement`). Only
 * `opacity` may still transition (a canvas can fade in while framed); the duration and delay the stylesheet gives are kept.
 */
export function noTransition(el: HTMLElement | HTMLCanvasElement): void {
  if (!savedTransition.has(el)) {
    savedTransition.set(el, {
      value: el.style.getPropertyValue("transition-property"),
      priority: el.style.getPropertyPriority("transition-property"),
    });
  }
  el.style.setProperty("transition-property", "opacity", "important");
}

export function createFrameBox(canvas: HTMLCanvasElement): FrameBox {
  let frame: Frame | null = null;
  let placed = true;
  let asked: Frame | null = null;
  let askedPlace = true;
  let applied: (() => void) | null = null;
  let pending = false;
  /** No frame has been drawn since the last run, window size or committed new size. */
  let stale = true;
  /** No loop is running (not started yet, stopped, given up): no frame will be drawn until `resume`. */
  let stopped = true;
  /** The box has written the canvas's place (and so must take it back; an unplaced canvas's style is the caller's). */
  let wrote = false;
  let waiters: Array<(r: DrawnResult) => void> = [];

  const place = () => {
    const f = frame;
    const s = canvas.style;
    if (!f || !placed) {
      if (wrote) clearPlacement(canvas, PLACED, () => frame !== null && placed);
      wrote = false;
      return;
    }
    wrote = true;
    s.position = "fixed";
    s.left = `${f.left}px`;
    s.top = `${f.top}px`;
    s.right = "auto";
    s.bottom = "auto";
    s.width = `${f.width}px`;
    s.height = `${f.height}px`;
    noTransition(canvas);
  };
  const flush = (r: DrawnResult) => {
    const go = waiters;
    waiters = [];
    for (const w of go) w(r);
  };

  return {
    frame: () => frame,
    placed: () => placed,
    request(f, opts) {
      asked = f;
      askedPlace = opts?.place !== false;
      applied = opts?.onApplied ?? null;
      pending = true;
    },
    hasPending: () => pending,
    commit() {
      if (!pending) return "none";
      pending = false;
      const before = frame;
      const resized = !sameFrameSize(before, asked);
      const nextPlaced = asked ? askedPlace : true;
      const restyle = placed !== nextPlaced || (nextPlaced && !sameFrame(before, asked));
      frame = asked;
      placed = nextPlaced;
      if (resized) stale = true;
      if (resized || restyle) place();
      const hook = applied;
      applied = null;
      hook?.();
      return resized ? "resized" : restyle ? "moved" : "none";
    },
    view: (vw, vh, dpr) => frameView(frame, vw, vh, dpr),
    invalidate() {
      stale = true;
    },
    drawn() {
      stale = false;
      if (waiters.length) flush("drawn");
    },
    resume() {
      stopped = false;
    },
    abandon() {
      stopped = true;
      flush("stopped");
    },
    whenDrawn() {
      // a frame of another size that is asked for but not yet applied also counts: the picture drawn now is not the one asked for
      const waiting = stale || (pending && !sameFrameSize(frame, asked));
      if (!waiting) return Promise.resolve("drawn");
      if (stopped) return Promise.resolve("stopped");
      return new Promise<DrawnResult>((r) => waiters.push(r));
    },
    release() {
      pending = false;
      applied = null;
      frame = null;
      placed = true;
      place();
      stopped = true;
      flush("stopped");
    },
  };
}
