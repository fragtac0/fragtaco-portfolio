import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BLOCK_ID } from "./blocks/interest-blocks";
import { makeScene } from "./layer/box-scene";
import type { LayerKind, LayerState } from "./layer/layer-state";
import { createOpenGate, type SceneStatus } from "./layer/open-gate";
import type { ShelfEngine } from "./reading/shelf-engine";
import type { WallEngine } from "./watching/wall-types";

const KINDS: readonly LayerKind[] = ["reading", "watching"];
/** A layer that is open on a scene that has not drawn this long after it opened gives up on 3D (a deep link, a slow scene). */
const SCENE_GIVE_UP_MS = 1500;

type PerKind<T> = Record<LayerKind, T>;

/** The block's box: where the scene is drawn small (interest-blocks.tsx `.blk-box`). */
function boxOf(kind: LayerKind): HTMLElement | null {
  return document.getElementById(BLOCK_ID[kind])?.querySelector<HTMLElement>(".blk-box") ?? null;
}

/**
 * What the two home boxes need beside the engines (spec 6.1): each scene's own element (`homes`, client only), how ready each
 * scene is, which scenes run (their box is on screen, or their layer is open, and the tab is visible), the docked frame each
 * engine draws into (the box's size, kept up to date while the layer is closed), and what a click on a block does while its scene
 * is not ready (open-gate.ts). The layer's own move is layer/move-driver.ts.
 */
export function useBoxScenes(
  layer: LayerState,
  engines: PerKind<ShelfEngine | WallEngine | null>,
  openLayer: (kind: LayerKind, from: HTMLElement) => void,
) {
  const [homes] = useState<PerKind<HTMLElement> | null>(() =>
    typeof document === "undefined"
      ? null
      : { reading: makeScene("reading"), watching: makeScene("watching") },
  );
  const [status, setStatus] = useState<PerKind<SceneStatus>>({
    reading: "pending",
    watching: "pending",
  });
  const [gaveUp, setGaveUp] = useState<PerKind<boolean>>({ reading: false, watching: false });
  const statusRef = useRef(status);
  const gateRef = useRef<ReturnType<typeof createOpenGate> | null>(null);

  const setOne = useCallback((kind: LayerKind, to: SceneStatus) => {
    // a scene that has fallen back to the plain grid never goes back to 3D
    if (statusRef.current[kind] === to || statusRef.current[kind] === "plain") return;
    statusRef.current = { ...statusRef.current, [kind]: to };
    setStatus(statusRef.current);
    gateRef.current?.settled(kind);
  }, []);
  const onDrawn = useCallback(
    (kind: LayerKind) => {
      homes?.[kind].setAttribute("data-drawn", "");
      setOne(kind, "ready");
    },
    [homes, setOne],
  );
  const onPlain = useCallback(
    (kind: LayerKind) => {
      homes?.[kind].setAttribute("data-plain", "");
      setOne(kind, "plain");
    },
    [homes, setOne],
  );

  // A click on a block: the layer opens at once when the scene is ready (or plain); else the block shows its pressed state
  // and waits up to 400 ms for the scene, then opens to the plain grid.
  const latestOpen = useRef(openLayer);
  useEffect(() => {
    latestOpen.current = openLayer;
  });
  useEffect(() => {
    const gate = createOpenGate({
      status: (kind) => statusRef.current[kind],
      open: (kind, plain) => {
        const block = document.getElementById(BLOCK_ID[kind]);
        if (!block) return;
        if (plain && statusRef.current[kind] !== "plain")
          setGaveUp((g) => ({ ...g, [kind]: true }));
        latestOpen.current(kind, block);
      },
      press: (kind, on) => {
        const block = document.getElementById(BLOCK_ID[kind]);
        if (on) block?.setAttribute("data-pressed", "");
        else block?.removeAttribute("data-pressed");
      },
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
    });
    gateRef.current = gate;
    return () => {
      gate.cancel();
      gateRef.current = null;
    };
  }, []);
  const onOpen = useCallback((kind: LayerKind) => gateRef.current?.request(kind), []);

  // an open layer whose scene has not drawn gives up on 3D after a while (a deep link before the scene is built)
  useEffect(() => {
    const kind = layer.kind;
    if (!kind || layer.phase !== "open" || status[kind] !== "pending") return;
    const t = window.setTimeout(() => setGaveUp((g) => ({ ...g, [kind]: true })), SCENE_GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [layer.kind, layer.phase, status]);

  // which boxes are on screen, and whether the tab is visible
  const [seen, setSeen] = useState<PerKind<boolean>>({ reading: false, watching: false });
  useEffect(() => {
    const kindOf = new Map<Element, LayerKind>();
    const io = new IntersectionObserver((entries) => {
      setSeen((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          const kind = kindOf.get(e.target);
          if (kind) next[kind] = e.isIntersecting;
        }
        return next.reading === prev.reading && next.watching === prev.watching ? prev : next;
      });
    });
    for (const kind of KINDS) {
      const el = boxOf(kind);
      if (!el) continue;
      kindOf.set(el, kind);
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const on = () => setTabVisible(!document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  const layerClosed = layer.phase === "closed";
  const run = useMemo<PerKind<boolean>>(() => {
    const one = (kind: LayerKind) => tabVisible && (layerClosed ? seen[kind] : layer.kind === kind);
    return { reading: one("reading"), watching: one("watching") };
  }, [tabVisible, layerClosed, layer.kind, seen]);

  // the docked frame: while the layer is closed, each engine draws into its box's size (the layer's move owns it otherwise)
  useLayoutEffect(() => {
    if (!layerClosed) return;
    const off: Array<() => void> = [];
    for (const kind of KINDS) {
      const engine = engines[kind];
      const box = boxOf(kind);
      if (!engine || !box) continue;
      engine.setDocked(true);
      const set = () => {
        const r = box.getBoundingClientRect();
        if (r.width > 0 && r.height > 0)
          engine.setFrame({ left: 0, top: 0, width: r.width, height: r.height }, { place: false });
      };
      set();
      const ro = new ResizeObserver(set);
      ro.observe(box);
      off.push(() => ro.disconnect());
    }
    return () => off.forEach((f) => f());
  }, [engines, layerClosed]);

  return { homes, status, gaveUp, run, onDrawn, onPlain, onOpen };
}
