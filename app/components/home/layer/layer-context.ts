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
  /** A scene hides the layer's header while it shows something over it (an open video). */
  setHeaderHidden: (hidden: boolean) => void;
};

/** No default: a component that needs the layer outside HomePage is a bug, not a no-op. */
export const LayerControlContext = createContext<LayerControl | null>(null);

export function useLayerControl(): LayerControl {
  const control = useContext(LayerControlContext);
  if (!control) throw new Error("LayerControl used outside its provider");
  return control;
}
