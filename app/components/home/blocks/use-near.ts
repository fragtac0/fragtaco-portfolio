import { useEffect, useRef, type RefObject } from "react";
import { whenIdle } from "../../../utils/idle";
import type { LayerKind } from "../layer/layer-state";

/** A block comes "near" this far outside the viewport (mockup: rootMargin 240px 0px). */
const NEAR_MARGIN = "240px 0px";
/** The scene's prepare() starts in idle time, at the latest this long after the block comes near. */
const NEAR_IDLE_TIMEOUT_MS = 1200;

export type NearGate = {
  /** The block of `kind` is near: its callback is scheduled, once per kind. */
  hit(kind: LayerKind): void;
  /** Drops every callback that has not run yet. */
  cancel(): void;
};

/**
 * Fires `onNear` once per kind. `schedule` defers the call (idle time in the page, by hand in the
 * tests) and returns its cancel. A kind that is already scheduled or has fired is ignored.
 */
export function createNearGate(
  schedule: (run: () => void) => () => void,
  onNear: (kind: LayerKind) => void,
): NearGate {
  const fired = new Set<LayerKind>();
  const pending = new Map<LayerKind, () => void>();
  return {
    hit(kind) {
      if (fired.has(kind) || pending.has(kind)) return;
      pending.set(
        kind,
        schedule(() => {
          pending.delete(kind);
          fired.add(kind);
          onNear(kind);
        }),
      );
    },
    cancel() {
      for (const cancel of pending.values()) cancel();
      pending.clear();
    },
  };
}

/**
 * The previews only animate on screen (the `idle` class pauses them), and each scene starts
 * preparing, once, in idle time, when its block is near.
 */
export function useNear(
  blocks: ReadonlyArray<readonly [LayerKind, RefObject<HTMLElement>]>,
  onNear: (kind: LayerKind) => void,
) {
  const latest = useRef({ onNear });
  useEffect(() => {
    latest.current = { onNear };
  });

  useEffect(() => {
    const gate = createNearGate(
      (run) => whenIdle(run, NEAR_IDLE_TIMEOUT_MS),
      (kind) => latest.current.onNear(kind),
    );
    const kindOf = new Map<Element, LayerKind>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          e.target.classList.toggle("idle", !e.isIntersecting);
          const kind = kindOf.get(e.target);
          if (kind && e.isIntersecting) gate.hit(kind);
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    for (const [kind, ref] of blocks) {
      const el = ref.current;
      if (!el) continue;
      kindOf.set(el, kind);
      io.observe(el);
    }
    return () => {
      io.disconnect();
      gate.cancel();
    };
    // the refs are stable and the blocks are fixed for the page's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
