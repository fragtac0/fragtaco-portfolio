import type { ShelfEls } from "./shelf-open";

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
  focusNext(dir: 1 | -1): void;
  openFocused(): void;
  dispose(): void;
};
