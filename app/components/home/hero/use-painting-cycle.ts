import { useEffect, useRef, type MutableRefObject } from "react";
import type { SiteHeroPainting } from "../../../types";
import { createTimers, must, type HeroRuntime, type HeroView } from "./hero-runtime";
import { loadImage, supportsWebp } from "../../../utils/load-image";
import type { PaintMeta } from "./paint-engine";
import {
  makeOrder,
  nextDelayMs,
  nextRevealTry,
  paintingSrc,
  parseFocal,
  pickFirst,
  RECENT_KEY,
  RECENT_LIMIT,
} from "./painting-cycle";

/** Last painting ids shown this session, newest last. */
function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  try {
    const next = [...readRecent().filter((r) => r !== id), id].slice(-RECENT_LIMIT);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the pick still applies to this visit */
  }
}

const metaOf = (p: SiteHeroPainting): PaintMeta => ({ focal: parseFocal(p.focal), zoom: p.zoom });

export type FoundPainting = { img: HTMLImageElement; k: number };

/** What the loader drives: the first painting, and the cycle that carries on from it. */
export type PaintingCycle = {
  /** How many paintings there are. */
  count: number;
  /** Fetches the first painting in the order; resolves null when there is none or it fails. */
  firstLoad: () => Promise<HTMLImageElement | null>;
  /**
   * The first painting that loads, trying the next in the order when one fails or is too slow,
   * and giving up after `maxTries` (see nextRevealTry).
   */
  firstLoaded: (
    firstLoad: Promise<HTMLImageElement | null>,
    maxWait: number,
    maxTries?: number,
  ) => Promise<FoundPainting | null>;
  /** Reveals a loaded painting, sets its caption, remembers it and preloads the next. */
  present: (found: FoundPainting, ms: number) => void;
  /** Starts the timer for the next swap (a random delay unless `ms` is given). */
  scheduleNext: (ms?: number) => void;
};

type Options = Pick<HeroRuntime, "rootRef" | "engineRef" | "parkedRef" | "dataRef"> & {
  viewRef: MutableRefObject<HeroView>;
};

/**
 * The painting cycle: which painting is shown first, the order after it, the caption, preloading
 * the next one, and the swap timer that waits while the page, the hero, a card or a layer is not
 * in front. The picks and the recent-list write are per component lifetime (StrictMode runs the
 * effect twice: both runs show and fetch the same painting). Returns a ref the loader reads.
 */
export function usePaintingCycle({
  rootRef,
  engineRef,
  parkedRef,
  dataRef,
  viewRef,
}: Options): MutableRefObject<PaintingCycle | null> {
  const cycleRef = useRef<PaintingCycle | null>(null);
  const picksRef = useRef<{ first: SiteHeroPainting | null; order: number[] } | null>(null);
  const rememberedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const paint = engineRef.current;
    if (!root || !paint) return;
    const { paintings: items } = dataRef.current;
    const n = items.length;
    const timers = createTimers();
    const { later, clear, atMost } = timers;
    const cap = must<HTMLElement>(root, ".caption");

    picksRef.current ??= (() => {
      const first = n > 0 ? pickFirst(items, readRecent(), Math.random) : null;
      return { first, order: first ? makeOrder(n, items.indexOf(first), Math.random) : [] };
    })();
    const { order } = picksRef.current;
    let oi = 0;
    let cycleT = 0;
    let nextImg: Promise<HTMLImageElement | null> = Promise.resolve(null);
    const srcAt = (k: number) =>
      paintingSrc(items[order[k]].file, window.innerWidth, window.devicePixelRatio || 1, supportsWebp());

    const setCaption = (p: SiteHeroPainting, animate = false) => {
      const fill = () => {
        must(root, ".caption .t").textContent = p.title;
        must(root, ".caption .a").textContent = `${p.artist}, ${p.year}`;
        cap.classList.remove("swap");
      };
      if (!animate) return fill();
      cap.classList.add("swap");
      later(600, fill);
    };
    const preloadNext = () => {
      nextImg = loadImage(srcAt((oi + 1) % n));
    };
    const scheduleNext = (ms = nextDelayMs(Math.random)) => {
      clear(cycleT);
      cycleT = later(ms, () => void nextPainting());
    };
    const nextPainting = async () => {
      if (paint.busy()) return scheduleNext(1500);
      const parked = parkedRef.current;
      const view = viewRef.current;
      if (!view.pageVisible || !view.heroOn || parked.layer || parked.card) return scheduleNext(2500);
      let img = await nextImg;
      if (timers.isDisposed()) return;
      oi = (oi + 1) % n;
      // a painting that fails to load is skipped for the one after it
      for (let t = 0; !img && t < n - 1; t++) {
        oi = (oi + 1) % n;
        img = await loadImage(srcAt(oi));
        if (timers.isDisposed()) return;
      }
      if (!img) {
        preloadNext();
        return scheduleNext();
      }
      const p = items[order[oi]];
      paint.swap(img, metaOf(p), 2800, () => {
        preloadNext();
        scheduleNext();
      });
      setCaption(p, true);
    };

    cycleRef.current = {
      count: n,
      firstLoad: () => (n > 0 ? loadImage(srcAt(0)) : Promise.resolve(null)),
      async firstLoaded(firstLoad, maxWait, maxTries) {
        for (let t = 0, k = nextRevealTry(t, n, maxTries); k !== null; k = nextRevealTry(++t, n, maxTries)) {
          const pending = k === 0 ? firstLoad : loadImage(srcAt(k));
          const img = Number.isFinite(maxWait) ? await atMost(pending, maxWait) : await pending;
          if (timers.isDisposed()) return null;
          if (img) return { img, k };
        }
        return null;
      },
      present(found, ms) {
        oi = found.k;
        const p = items[order[oi]];
        paint.reveal(found.img, metaOf(p), ms);
        setCaption(p);
        if (!rememberedRef.current) {
          rememberedRef.current = true;
          remember(p.id);
        }
        preloadNext();
      },
      scheduleNext,
    };

    return () => {
      timers.dispose();
      cycleRef.current = null;
    };
  }, [rootRef, engineRef, parkedRef, dataRef, viewRef]);

  return cycleRef;
}
