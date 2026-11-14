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
  const prev = typeof current === "object" && current !== null ? (current as { idx?: number }) : {};
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
  // the layer was opened with no move (a deep link or a hard load that starts open)
  const [layerInstant, setLayerInstant] = useState(false);
  // `history.back()` has been called and its popstate has not arrived yet; a click that turns the closing round in that time
  // pushes its entry when the pop has arrived (`reopenRef`)
  const backPendingRef = useRef(false);
  const reopenRef = useRef<LayerKind | null>(null);
  const sceneHooks = useRef<Partial<Record<LayerKind, LayerSceneHooks>>>({});
  // Set by a scene through the layer context; the layer is the one that hides its own header.
  const [headerHidden, setHeaderHidden] = useState(false);
  const layerLive = layer.phase === "growing" || layer.phase === "open";

  const openLayer = useCallback<LayerControl["openLayer"]>(
    (kind, from, opts) => {
      const now = layerRef.current;
      // a click on the block that is closing turns the closing round (open-move.ts `turn`): the entry the close left is pushed again
      const turning = now.phase === "shrinking" && now.kind === kind;
      if (now.phase !== "closed" && !turning) return;
      setLayerFrom(from);
      setLayerInstant(!!opts?.instant && !turning);
      setLayerOpen(true);
      if (opts?.push !== false) {
        if (turning && backPendingRef.current) {
          reopenRef.current = kind;
        } else {
          window.history.pushState(nextHistoryState(window.history.state, kind), "", "#" + kind);
          pushedRef.current = true;
        }
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
      backPendingRef.current = true;
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
  const registerSceneHooks = useCallback((kind: LayerKind, hooks: LayerSceneHooks) => {
    sceneHooks.current[kind] = hooks;
    return () => {
      if (sceneHooks.current[kind] === hooks) delete sceneHooks.current[kind];
    };
  }, []);
  /** An open video is put away as a closing begins (the scene stays alive in its box, so it must not be left open). */
  const closeDetail = useCallback(
    (kind: LayerKind) => sceneHooks.current[kind]?.closeVideo?.(),
    [],
  );
  const layerControl = useMemo<LayerControl>(
    () => ({ openLayer, closeLayer, registerSceneHooks, setHeaderHidden }),
    [openLayer, closeLayer, registerSceneHooks],
  );

  // A deep link (/#reading, /#watching on arrival, or a history move onto one) opens the layer
  // from its block, with no history entry of its own. The block is scrolled into view first,
  // instantly, so the move starts from where the block is. On arrival (`instant`) there is no move at all.
  const openFromHash = useCallback(
    (kind: LayerKind, instant = false) => {
      const block = document.getElementById(BLOCK_ID[kind]);
      if (!block) return;
      block.scrollIntoView({ block: "center", behavior: "instant" });
      openLayer(kind, block, { push: false, instant });
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
      backPendingRef.current = false;
      pushedRef.current = false;
      // the closing was turned round before this pop arrived: the entry the click wanted is pushed now, and the layer stays
      const again = reopenRef.current;
      reopenRef.current = null;
      if (again && layerRef.current.phase !== "closed") {
        window.history.pushState(nextHistoryState(window.history.state, again), "", "#" + again);
        pushedRef.current = true;
        return;
      }
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
      const h = sceneHooks.current[layerRef.current.kind ?? "reading"] ?? {};
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
    layerInstant,
    layerActive,
    layerControl,
    headerHidden,
    openLayer,
    closeLayer,
    dispatchLayer,
    openFromHash,
    closeDetail,
  };
}
