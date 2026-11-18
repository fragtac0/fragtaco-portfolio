import type { LayerKind } from "./layer-state";

/**
 * The history entry of a layer that is closing and is turned round before the browser's Back has arrived. `history.back()` was
 * called and its popstate has not come yet; a click that turns the closing round in that time cannot push its entry (the pop
 * would take it away), so it waits for the pop. A Close in that time drops the wait: the layer is closing again and owns no entry.
 */
export type BackTracker = {
  /** `history.back()` has been called: its popstate is still to come. */
  backCalled(): void;
  /** A click turned the closing round to `kind`: true when its entry must wait for the pop, false when it can be pushed now. */
  turned(kind: LayerKind): boolean;
  /** Close (or anything that closes the layer) while a turned entry waits: it is dropped. */
  closed(): void;
  /** The popstate arrived: the entry that waited for it (once), or null. */
  popped(): LayerKind | null;
  pending(): boolean;
};

export function createBackTracker(): BackTracker {
  let back = false;
  let waiting: LayerKind | null = null;
  return {
    backCalled() {
      back = true;
    },
    turned(kind) {
      if (!back) return false;
      waiting = kind;
      return true;
    },
    closed() {
      waiting = null;
    },
    popped() {
      back = false;
      const kind = waiting;
      waiting = null;
      return kind;
    },
    pending: () => back,
  };
}
