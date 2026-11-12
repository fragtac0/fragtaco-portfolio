import type { ShelfEls } from "./shelf-open";

/** The shelf engine's public surface (shelf-engine.ts). */
export type ShelfEngine = {
  prepare(): Promise<void>;
  mount(els: ShelfEls): void;
  /**
   * Starts the loop once the scene is built. `skipIntro` places the books without the drop-in (a
   * placeholder already showed them); `onFirstFrame` is called once, right after the first frame
   * has been drawn.
   */
  start(opts?: { skipIntro?: boolean; onFirstFrame?: () => void }): Promise<void>;
  stop(): void;
  unmount(): void;
  hasOpen(): boolean;
  /** True once `prepare()` has run and the scene could not be built (no WebGL2, a throw), or the context was lost. */
  hasFailed(): boolean;
  /** Called once when the graphics context is lost (the scene switches to its plain grid). */
  onLost(cb: () => void): () => void;
  /** The scene is built, so `start()` shows it on the next frame. */
  ready(): boolean;
  /** Urgent: preparation stops yielding to idle time and runs in short slices every frame. */
  setUrgent(on: boolean): void;
  closeBook(): void;
  focusNext(dir: 1 | -1): void;
  openFocused(): void;
  dispose(): void;
};
