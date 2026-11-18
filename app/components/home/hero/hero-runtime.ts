import type { MutableRefObject, RefObject } from "react";
import type { SiteHeroPainting } from "../../../types";
import type { PaintEngine } from "./paint-engine";

/** What the hero hooks share: refs owned by `Hero`, filled by whichever hook runs first. */
export type HeroRuntime = {
  rootRef: RefObject<HTMLElement>;
  engineRef: MutableRefObject<PaintEngine | null>;
  /** A card or a layer is open: the painting stops changing, and the draw loop parks. */
  parkedRef: MutableRefObject<{ card: boolean; layer: boolean }>;
  /** The data the hero was mounted with (read once per effect run, not tracked). */
  dataRef: MutableRefObject<{ name: string; paintings: SiteHeroPainting[]; firstPaintingId: string }>;
};

/** Whether the page is on screen: written by the paint loop, read by the painting cycle. */
export type HeroView = { pageVisible: boolean; heroOn: boolean };

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The element for a selector the hero's own markup guarantees; throws when it is missing. */
export function must<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`hero: missing ${sel}`);
  return el;
}

export type Timers = {
  later: (ms: number, fn: () => void) => number;
  clear: (id: number) => void;
  /** Resolves with the promise's value, or null if `ms` pass first. */
  atMost: <T>(p: Promise<T | null>, ms: number) => Promise<T | null>;
  /** Clears every pending timer and marks the scope disposed. */
  dispose: () => void;
  isDisposed: () => boolean;
};

/** Timers that are all cleared together on unmount. */
export function createTimers(): Timers {
  let disposed = false;
  const timers = new Set<number>();
  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const clear = (id: number) => {
    window.clearTimeout(id);
    timers.delete(id);
  };
  return {
    later,
    clear,
    atMost: <T,>(p: Promise<T | null>, ms: number): Promise<T | null> =>
      new Promise((resolve) => {
        const id = later(ms, () => resolve(null));
        void p.then((v) => {
          clear(id);
          resolve(v);
        });
      }),
    dispose: () => {
      disposed = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    },
    isDisposed: () => disposed,
  };
}
