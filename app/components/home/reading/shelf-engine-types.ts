import type { DockOptions, DrawnResult, FrameOptions } from "../layer/frame-box";
import type { Frame } from "../layer/frame-math";
import type { ShelfEls } from "./shelf-open";
import type { Projected } from "./shelf-projected";

/** The shelf engine's public surface (shelf-engine.ts). */
export type ShelfEngine = {
  prepare(): Promise<void>;
  mount(els: ShelfEls): void;
  /**
   * Starts the loop once the scene is built. The books stand in place (the layer's picture of the
   * block already showed them, so there is no drop-in); `onFirstFrame` is called once, right after
   * the first frame has been drawn.
   */
  start(opts?: { onFirstFrame?: () => void }): Promise<void>;
  stop(): void;
  unmount(): void;
  hasOpen(): boolean;
  /** True once `prepare()` has run and the scene could not be built (no WebGL2, a throw), or the context was lost. */
  hasFailed(): boolean;
  /** Called once when the graphics context is lost (the scene switches to its plain grid). */
  onLost(cb: () => void): () => void;
  /** Urgent: preparation stops yielding to idle time and runs in short slices every frame. */
  setUrgent(on: boolean): void;
  closeBook(): void;
  /**
   * Draws the open page's picture for the current window framed by `frame` (CSS pixels in the window), nothing outside it, with the
   * ledge and (through `els.dots`) the dot field: a box at rest shows the whole row on its ledge, a frame in a move (`opts.move`)
   * eases to the open page's picture (box-framing.ts); null draws the whole window as before. By default the
   * canvas (and the dot field) is placed at the frame (fixed); with `{ place: false }` the caller owns the canvas's place and size
   * (it sits in its home box and scrolls with the page; the dot field is then positioned absolutely from the frame's own corner,
   * so it must share the canvas's offset parent) and only the frame's size is used: a move is nothing, a new size is a resize,
   * and switching `place` at the same size changes no picture. Never rebuilds the scene: a frame asked for while the loop runs is
   * applied by the loop in the frame it draws. Called while the loop is stopped it applies at once (the canvas keeps its old
   * buffer until the next `start()`), so call it on a hidden or running shelf.
   */
  setFrame(frame: Frame | null, opts?: FrameOptions): void;
  /**
   * Docked: no pointer, wheel or key input (the canvas is out of the tab order and lets the pointer through); an open book is
   * closed at once, and it draws only when something changed. `maxDpr` caps the renderer's pixel ratio while docked.
   */
  setDocked(docked: boolean, opts?: DockOptions): void;
  /**
   * Resolves "drawn" after the first frame drawn with the current frame (at once if that has happened) and "stopped" when the
   * shelf stops, unmounts, is disposed, fails to build or loses its context: it never hangs. Call it after `start()`; with no
   * loop and nothing to draw it answers "stopped" at once.
   */
  whenDrawn(): Promise<DrawnResult>;
  /** Every book's box and the ledge's in the canvas's own pixels as drawn (read through the camera), or null before the scene is built. */
  projected(): Projected | null;
  focusNext(dir: 1 | -1): void;
  openFocused(): void;
  dispose(): void;
};
