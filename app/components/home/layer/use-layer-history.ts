import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type RefObject,
} from "react";
import { BLOCK_ID } from "../blocks/interest-blocks";
import type { HeroHandle } from "../hero/hero";
import type { LayerControl, LayerSceneHooks } from "./layer-context";
import {
  escTarget,
  layerFromHash,
  layerReducer,
  type LayerAction,
  type LayerKind,
  type LayerState,
} from "./layer-state";

/**
 * The state pushed when a layer opens. Remix keeps its bookkeeping (`key`, `idx`, `usr`) in
 * history.state: keep it, add `xp`, and bump `idx` because Remix counts entries by it.
 */
export function nextHistoryState(current: unknown, kind: LayerKind): object {
  const prev =
    typeof current === "object" && current !== null ? (current as { idx?: number }) : {};
  return { ...prev, xp: kind, idx: (prev.idx ?? 0) + 1 };
}

type Options = {
  heroRef: RefObject<HeroHandle>;
  /** Tells the cards' gesture gate whether a layer is open. */
  setLayerOpen: (open: boolean) => void;
};

/**
 * The reading / watching layer and its place in the browser's history: the reducer, opening and
 * closing (with the history entry they push or leave), a deep link or a Forward onto one, Esc, and
 * the page lock while it is open. Behaviour ported as it was in HomePage.
 */
export function useLayerHistory({ heroRef, setLayerOpen }: Options) {
  const [layer, rawDispatchLayer] = useReducer(layerReducer, { kind: null, phase: "closed" });
  // The phase ref is advanced right where the reducer is dispatched (the reducer is pure, so it
  // computes the same state React will), never in a passive effect: openLayer and closeLayer can
  // run twice before a render and must see the phase the first call left.
  const layerRef = useRef<LayerState>(layer);
  const dispatchLayer = useCallback((action: LayerAction) => {
    layerRef.current = layerReducer(layerRef.current, action);
    rawDispatchLayer(action);
  }, []);
  // True while the layer owns a history entry it pushed (not a deep link): closing then goes Back.
  const pushedRef = useRef(false);
  const [layerFrom, setLayerFrom] = useState<HTMLElement | null>(null);
  const sceneHooks = useRef<LayerSceneHooks>({});
  // Set by a scene through the layer context; the layer is the one that hides its own header.
  const [headerHidden, setHeaderHidden] = useState(false);
  const layerLive = layer.phase === "growing" || layer.phase === "open";

  const openLayer = useCallback<LayerControl["openLayer"]>(
    (kind, from, opts) => {
      if (layerRef.current.phase !== "closed") return;
      setLayerFrom(from);
      setLayerOpen(true);
      if (opts?.push !== false) {
        window.history.pushState(nextHistoryState(window.history.state, kind), "", "#" + kind);
        pushedRef.current = true;
      } else {
        pushedRef.current = false;
      }
      dispatchLayer({ type: "open", kind });
    },
    [dispatchLayer, setLayerOpen],
  );
  const closeLayer = useCallback(() => {
    const phase = layerRef.current.phase;
    if (phase !== "growing" && phase !== "open") return;
    dispatchLayer({ type: "close" });
    if (pushedRef.current) {
      // leave the entry the layer pushed; the popstate that follows finds the layer already shrinking
      pushedRef.current = false;
      window.history.back();
    } else {
      // a deep link owns no entry of its own: just drop the hash (the query string stays)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [dispatchLayer]);
  const registerSceneHooks = useCallback((hooks: LayerSceneHooks) => {
    sceneHooks.current = hooks;
    return () => {
      if (sceneHooks.current === hooks) sceneHooks.current = {};
    };
  }, []);
  const layerControl = useMemo<LayerControl>(
    () => ({ openLayer, closeLayer, registerSceneHooks, setHeaderHidden }),
    [openLayer, closeLayer, registerSceneHooks],
  );

  // A deep link (/#reading, /#watching on arrival, or a history move onto one) opens the layer
  // from its block, with no history entry of its own. The block is scrolled into view first,
  // instantly, so the grow starts from where the block is.
  const openFromHash = useCallback(
    (kind: LayerKind) => {
      const block = document.getElementById(BLOCK_ID[kind]);
      if (!block) return;
      block.scrollIntoView({ block: "center", behavior: "instant" });
      openLayer(kind, block, { push: false });
    },
    [openLayer],
  );

  // While the layer is not closed: the cards ignore gestures, the hero's paint loop parks, the
  // page is locked (html.locked, separate from intro and cards-open), and the dock is hidden.
  const layerActive = layer.phase !== "closed";
  useEffect(() => {
    if (!layerActive) return;
    const html = document.documentElement;
    const hero = heroRef.current;
    setLayerOpen(true);
    hero?.setParked("layer", true);
    html.classList.add("locked");
    return () => {
      setLayerOpen(false);
      hero?.setParked("layer", false);
      html.classList.remove("locked");
      setHeaderHidden(false);
    };
  }, [layerActive, heroRef, setLayerOpen]);

  // History moves. While the layer is live, any of them closes it (the reducer ignores a close
  // while it is already shrinking); the entry it pushed is gone either way. With the layer closed,
  // a move onto /#reading or /#watching (Forward) opens it.
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      if (layerRef.current.phase !== "closed") {
        dispatchLayer({ type: "close" });
        return;
      }
      const kind = layerFromHash(window.location.hash);
      if (kind) openFromHash(kind);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dispatchLayer, openFromHash]);

  // Esc closes an open video, then an open book, then the layer.
  useEffect(() => {
    if (!layerLive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return; // a held key must not walk down the layers
      const h = sceneHooks.current;
      const target = escTarget({
        bookOpen: h.isBookOpen?.() ?? false,
        videoOpen: h.isVideoOpen?.() ?? false,
        layer: layerRef.current,
      });
      if (target === null) return;
      e.preventDefault();
      if (target === "video") h.closeVideo?.();
      else if (target === "book") h.closeBook?.();
      else closeLayer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layerLive, closeLayer]);

  return {
    layer,
    layerFrom,
    layerActive,
    layerControl,
    headerHidden,
    openLayer,
    closeLayer,
    dispatchLayer,
    openFromHash,
  };
}
