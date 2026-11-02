import { createContext, useContext } from "react";
import type { LayerKind } from "./layer-state";

/** Registered by the scenes (shelf, wall) so Esc can close an open book or video before the layer. */
export type LayerSceneHooks = {
  isBookOpen?: () => boolean;
  closeBook?: () => void;
  isVideoOpen?: () => boolean;
  closeVideo?: () => void;
};

export type LayerControl = {
  /** `from` is the block the layer grows out of. `push: false` opens without a history entry (deep links). */
  openLayer: (kind: LayerKind, from: HTMLElement, opts?: { push?: boolean }) => void;
  closeLayer: () => void;
  /** Returns the function that unregisters the hooks. */
  registerSceneHooks: (hooks: LayerSceneHooks) => () => void;
};

const noop = () => {};
export const LayerControlContext = createContext<LayerControl>({
  openLayer: noop,
  closeLayer: noop,
  registerSceneHooks: () => noop,
});

export const useLayerControl = () => useContext(LayerControlContext);
