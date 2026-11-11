import { useEffect, useRef, type MutableRefObject } from "react";
import type { SiteHeroPainting } from "../../../types";
import { createTimers, must, type HeroRuntime, type HeroView } from "./hero-runtime";
import { loadImage, supportsWebp, whenWebpKnown } from "../../../utils/load-image";
import type { PaintMeta } from "./paint-engine";
import {
  firstPaintingSrc,
  makeOrder,
  nextDelayMs,
  nextRevealTry,
  paintingSrc,
  parseFocal,
  pickNext,
  RECENT_KEY,
  RECENT_LIMIT,
} from "./painting-cycle";
import { prepareBitmap } from "./paint-bitmaps";
import { recallPainting, rememberPainting } from "./painting-memory";

/** The plain crossfade from the blurred placeholder to the sharp painting. */
const PLACEHOLDER_FADE_MS = 400;
/** A painting change: the liquid-glass sweep. */
const SWAP_MS = 2800;

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

type Remembered = NonNullable<ReturnType<typeof recallPainting>>;

export type FoundPainting = { img: HTMLImageElement; k: number };

/** The hero is showing the blurred placeholder; `arrived` is a sharp painting waiting for its reveal to end. */
type OpenPlaceholder = { over: boolean; arrived: FoundPainting | null };

/** What the loader drives: the first painting, and the cycle that carries on from it. */
export type PaintingCycle = {
  /** How many paintings there are. */
  count: number;
  /** The painting remembered from the last visit to the home route (position 0), or null. */
  recalled: () => FoundPainting | null;
  /** Prepares a painting for a cheap upload (the remembered one, which comes back without a load). */
  prepare: (img: HTMLImageElement) => Promise<void>;
  /**
   * The first painting in the order: the one the head preload fetched (same URL, when the browser
   * can show WebP), or the remembered image. Resolves null when there is none or it fails.
   */
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
  /**
   * The skipped loader's first painting when nothing is remembered: the blurred placeholder
   * (when the response carries one) as soon as it decodes, then a 400 ms crossfade to the sharp
   * painting when it arrives. Resolves true once something is on screen.
   */
  presentFirst: () => Promise<boolean>;
  /**
   * The loader's reveal when the sharp painting is late: the liquid-glass reveal (`ms`) opens on
   * the first painting's blurred placeholder instead. Resolves true once it is on screen, false
   * when there is no placeholder or it fails to load. Does not preload the next painting: the
   * network is busy with the sharp one.
   */
  revealPlaceholder: (ms: number) => Promise<boolean>;
  /**
   * After `revealPlaceholder`: when the sharp painting arrives (and the reveal has finished) it
   * crossfades in over 400 ms. Ignored once the cycle has moved on to another painting.
   */
  upgradeWhenLoaded: (pending: Promise<FoundPainting | null>) => void;
  /**
   * The reveal for a painting that arrives late with no placeholder to open on: reveals it when it
   * arrives, unless the cycle has already moved on to another painting by then.
   */
  presentLate: (pending: Promise<FoundPainting | null>, ms: number) => void;
  /** Starts the timer for the next swap (ten seconds unless `ms` is given). */
  scheduleNext: (ms?: number) => void;
};

type Options = Pick<HeroRuntime, "rootRef" | "engineRef" | "parkedRef" | "dataRef"> & {
  viewRef: MutableRefObject<HeroView>;
  /** False while a page change is running: there is no engine yet, and the cycle starts with it. */
  settled: boolean;
};

/**
 * The painting cycle: which painting is shown first (the one remembered from the last visit, else
 * the server's pick), the order after it, the caption, preloading the next one, and the swap timer
 * that waits while the page, the hero, a card or a layer is not in front. The order is per
 * component lifetime (StrictMode runs the effect twice: both runs show and fetch the same
 * painting). Every painting shown goes into the recent list and the painting memory. Returns a ref
 * the loader reads.
 */
export function usePaintingCycle({
  rootRef,
  engineRef,
  parkedRef,
  dataRef,
  viewRef,
  settled,
}: Options): MutableRefObject<PaintingCycle | null> {
  const cycleRef = useRef<PaintingCycle | null>(null);
  const picksRef = useRef<{ order: number[]; memory: Remembered | null } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const paint = engineRef.current;
    if (!settled || !root || !paint) return;
    const { paintings: items, firstPaintingId } = dataRef.current;
    const n = items.length;
    const timers = createTimers();
    const { later, clear, atMost } = timers;
    const cap = must<HTMLElement>(root, ".caption");

    // First: the remembered painting if it is still in the list, else the server's pick (its
    // preload is in the HTML), else any.
    picksRef.current ??= (() => {
      if (n === 0) return { order: [], memory: null };
      const recalled = recallPainting();
      const remembered = recalled ? items.findIndex((p) => p.id === recalled.id) : -1;
      const server = items.findIndex((p) => p.id === firstPaintingId);
      const first = remembered >= 0 ? remembered : server >= 0 ? server : Math.floor(Math.random() * n);
      return { order: makeOrder(n, first, Math.random), memory: remembered >= 0 ? recalled : null };
    })();
    const { order, memory } = picksRef.current;
    const ids = items.map((p) => p.id);
    let oi = 0;
    let np = 0;
    let cycleT = 0;
    let nextImg: Promise<HTMLImageElement | null> = Promise.resolve(null);
    // set while the hero shows the blurred placeholder and the sharp painting has not replaced it
    let open: OpenPlaceholder | null = null;
    // counts the cycle's moves to another painting, so a late arrival can tell it is out of turn
    let moves = 0;
    // a painting is loaded, decoded and prepared for a cheap upload (paint-bitmaps) before anything waits on it
    const loadPainting = async (src: string) => {
      const img = await loadImage(src);
      if (img) await prepareBitmap(img);
      return img;
    };
    const dpr = () => window.devicePixelRatio || 1;
    const srcAt = (k: number) => paintingSrc(items[order[k]].file, window.innerWidth, dpr(), supportsWebp());
    // The first painting asks for what the preload in <head> fetched (see firstPaintingSrc).
    const firstSrc = (webp: boolean) => firstPaintingSrc(items[order[0]].file, window.innerWidth, dpr(), webp);

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
    const shown = (p: SiteHeroPainting, img: HTMLImageElement) => {
      remember(p.id);
      rememberPainting(p.id, img);
    };
    const preloadNext = () => {
      np = pickNext(order, oi, readRecent(), ids);
      nextImg = loadPainting(srcAt(np));
    };
    const scheduleNext = (ms = nextDelayMs()) => {
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
      open = null; // the cycle moves on: a sharp painting arriving now would be out of turn
      moves++;
      oi = np;
      // a painting that fails to load is skipped for the one after it
      for (let t = 0; !img && t < n - 1; t++) {
        oi = pickNext(order, oi, readRecent(), ids);
        img = await loadPainting(srcAt(oi));
        if (timers.isDisposed()) return;
      }
      if (!img) {
        preloadNext();
        return scheduleNext();
      }
      const p = items[order[oi]];
      // the next change is ten seconds after this one starts, not after it ends
      scheduleNext();
      paint.swap(img, metaOf(p), SWAP_MS, preloadNext);
      setCaption(p, true);
      shown(p, img);
    };
    const firstLoad = async () => {
      if (n === 0) return null;
      if (memory) {
        await prepareBitmap(memory.img);
        return memory.img;
      }
      return loadPainting(firstSrc(await whenWebpKnown()));
    };
    const firstLoaded: PaintingCycle["firstLoaded"] = async (first, maxWait, maxTries) => {
      for (let t = 0, k = nextRevealTry(t, n, maxTries); k !== null; k = nextRevealTry(++t, n, maxTries)) {
        const pending = k === 0 ? first : loadPainting(srcAt(k));
        const img = Number.isFinite(maxWait) ? await atMost(pending, maxWait) : await pending;
        if (timers.isDisposed()) return null;
        if (img) return { img, k };
      }
      return null;
    };
    const present: PaintingCycle["present"] = (found, ms) => {
      oi = found.k;
      const p = items[order[oi]];
      paint.reveal(found.img, metaOf(p), ms);
      setCaption(p);
      shown(p, found.img);
      preloadNext();
    };

    // The plain 400 ms fade from the placeholder to the sharp painting (a plain fade under reduced
    // motion too, on purpose: the engine keeps it at 400 ms).
    const crossfadeTo = (found: FoundPainting) => {
      oi = found.k;
      const p = items[order[oi]];
      paint.swap(found.img, metaOf(p), PLACEHOLDER_FADE_MS, preloadNext, { plain: true });
      if (found.k !== 0) setCaption(p, true);
      shown(p, found.img);
    };

    cycleRef.current = {
      count: n,
      recalled: () => (memory ? { img: memory.img, k: 0 } : null),
      prepare: (img) => prepareBitmap(img),
      firstLoad,
      firstLoaded,
      present,
      async presentFirst() {
        if (n === 0) return false;
        const first = items[order[0]];
        const sharp = firstLoaded(firstLoad(), Infinity, n);
        let placeholder = false;
        let settled = false;
        if (first.blur) {
          void loadImage(first.blur).then((blurImg) => {
            if (!blurImg || settled || timers.isDisposed()) return;
            placeholder = true;
            oi = 0;
            paint.reveal(blurImg, metaOf(first), 0);
            setCaption(first);
          });
        }
        const found = await sharp;
        settled = true;
        if (!found) return placeholder;
        if (!placeholder) {
          present(found, 0);
          return true;
        }
        crossfadeTo(found);
        return true;
      },
      async revealPlaceholder(ms) {
        const first = n > 0 ? items[order[0]] : null;
        if (!first?.blur) return false;
        const blurImg = await loadImage(first.blur);
        if (!blurImg || timers.isDisposed()) return false;
        const state: OpenPlaceholder = { over: false, arrived: null };
        open = state;
        oi = 0;
        paint.reveal(blurImg, metaOf(first), ms, () => {
          state.over = true;
          if (state.arrived && open === state) {
            open = null;
            crossfadeTo(state.arrived);
          }
        });
        setCaption(first);
        return true;
      },
      upgradeWhenLoaded(pending) {
        void pending.then((found) => {
          const state = open;
          if (!found || !state || timers.isDisposed()) return;
          if (!state.over) {
            state.arrived = found; // the reveal's end crossfades it
            return;
          }
          open = null;
          crossfadeTo(found);
        });
      },
      presentLate(pending, ms) {
        const at = moves;
        void pending.then((found) => {
          if (!found || timers.isDisposed() || moves !== at) return;
          present(found, ms);
        });
      },
      scheduleNext,
    };

    return () => {
      timers.dispose();
      cycleRef.current = null;
    };
  }, [rootRef, engineRef, parkedRef, dataRef, viewRef, settled]);

  return cycleRef;
}
