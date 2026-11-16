import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { SiteHeroPainting } from "../../../types";
import { holdFor, type Hold } from "../../../lib/arrival";
import { afterFrames, fadeLate } from "../../../lib/arrival-dom";
import { isChangeRunning } from "../../../lib/page-change";
import { usePageArrived } from "../../../lib/use-page-settled";
import { loadImage, whenWebpKnown } from "../../../utils/load-image";
import "./hero.css";
import { prefersReducedMotion } from "./hero-runtime";
import { firstPaintingSrc } from "./painting-cycle";
import { recallPainting, rememberPainting } from "./painting-memory";
import type { PaintEngine } from "./paint-engine";
import Lockup from "./lockup";
import { useLoader } from "./use-loader";
import { usePaintEngine } from "./use-paint-engine";
import { usePaintingCycle } from "./use-painting-cycle";

// Layout effects warn on the server; the effect that uses this never runs there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A plain picture of a painting for the page's first frame: the image's address and how it sits in the hero (the engine draws the same crop). */
interface Still {
  src: string;
  focal: string;
  zoom: number;
  /** True for the painting itself (remembered from the last visit, or loaded); false for the first painting's blurred placeholder. */
  sharp: boolean;
  painting: SiteHeroPainting;
}

export interface HeroHandle {
  /** Blurs the painting behind an open card (0 clears it). */
  setBlur(v: 0 | 1): void;
  /** A card or a layer is open: the painting stops changing, and the draw loop parks. */
  setParked(reason: "card" | "layer", on: boolean): void;
  /** The hero `<section>`, for listeners that live on it (wheel, touch, visibility). */
  root(): HTMLElement | null;
}

interface HeroProps {
  name: string;
  roles: string;
  paintings: SiteHeroPainting[];
  /** The painting the server picked and preloaded; shown first unless one is remembered. */
  firstPaintingId: string;
  /** A card is open: the lockup blurs and fades, the caption and cue dim. */
  softened: boolean;
  /** Fires once, when the loader finishes (or at once when it is skipped). */
  onReady: () => void;
  /** Rendered inside the section after the hero's own layers (the cards and their scrim). */
  children?: ReactNode;
}

/**
 * The home hero: a WebGL painting, the centred lockup, the loader that plays once per session,
 * and the painting cycle. Ported from the mockup's paint loop, cycle and playLoader. All of the
 * animation is imperative (classes on refs, a requestAnimationFrame loop); React renders the
 * pre-loader markup once and holds no per-frame state. The work lives in three hooks, which run
 * in this order: use-paint-engine (the engine and its loop), use-painting-cycle (which painting,
 * the caption, the swap timer) and use-loader (the intro timeline, which drives the other two).
 */
const Hero = forwardRef<HeroHandle, HeroProps>(function Hero(
  { name, roles, paintings, firstPaintingId, softened, onReady, children },
  ref,
) {
  const rootRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PaintEngine | null>(null);
  const blurRef = useRef<0 | 1>(0);
  const parkedRef = useRef({ card: false, layer: false });
  const onReadyRef = useRef(onReady);
  const dataRef = useRef({ name, paintings, firstPaintingId });

  useEffect(() => {
    onReadyRef.current = onReady;
    dataRef.current = { name, paintings, firstPaintingId };
  });

  useImperativeHandle(
    ref,
    () => ({
      setBlur(v) {
        blurRef.current = v;
        engineRef.current?.setBlur(v);
      },
      setParked(reason, on) {
        parkedRef.current[reason] = on;
      },
      root() {
        return rootRef.current;
      },
    }),
    [],
  );

  // Arriving during a page change: the engine, the painting upload and the loader wait for it to be over
  // (the lag fix, see app/lib/page-change.ts). The painting remembered from the last visit is on screen
  // meanwhile, as a plain image, so the page's first picture already looks right. A first load (server
  // HTML and hydration) has nothing remembered and is never held back.
  // The engine starts a frame after the change is over and the painting goes up two frames after that, so
  // creating the context and compiling the shaders, and the upload, are different tasks.
  const engineGo = usePageArrived(1);
  const paintGo = usePageArrived(3);
  // Read once, when the page is made: a page made while a change runs is finished before the reveal (round 7 change-arrival spec 5.1).
  const [byChange] = useState(isChangeRunning);
  // The page's first picture, as a plain image: the painting remembered from the last visit, or, arriving
  // during a page change with nothing remembered, the first painting's blurred placeholder (a data URI, so
  // it is decoded in the same commit) until its sharp copy has loaded (below). Never the bare ground. A first load (server HTML) has neither.
  const [still] = useState((): Still | null => {
    if (typeof window === "undefined") return null;
    const recalled = recallPainting();
    const p = recalled ? paintings.find((q) => q.id === recalled.id) : undefined;
    if (recalled && p) return { src: recalled.img.currentSrc || recalled.img.src, focal: p.focal, zoom: p.zoom ?? 1, sharp: true, painting: p };
    const first = paintings.find((q) => q.id === firstPaintingId);
    if (byChange && first?.blur) return { src: first.blur, focal: first.focal, zoom: first.zoom ?? 1, sharp: false, painting: first };
    return null;
  });
  // The sharp first painting, once it has loaded, over its blurred placeholder (a page that came in through a change with nothing remembered).
  const [sharpStill, setSharpStill] = useState<Still | null>(null);
  // The reveal's hold on the sharp painting says whether it missed the reveal, however long after the change it comes (arrival.ts `Hold`)
  const paintingHold = useRef<Hold | null>(null);
  const faded = useRef(false);
  // a stable ref callback (React calls an inline one again on every render: a re-render during the reveal would restart the fade): it fades the painting in once
  const sharpRef = useCallback((img: HTMLImageElement | null) => {
    if (!img || faded.current || !paintingHold.current?.late) return;
    faded.current = true; // it came after the reveal began: it fades in over the placeholder
    fadeLate(img);
  }, []);
  // The caption is up in the page's first frame, with the words of the painting that is showing: it does not fade in after the change.
  const captionUp = byChange && still !== null;

  const runtime = { rootRef, engineRef, parkedRef, dataRef };
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!byChange || !still || !root) return;
    const words = (selector: string, text: string) => {
      const el = root.querySelector(selector);
      if (el) el.textContent = text;
    };
    words(".caption .t", still.painting.title);
    words(".caption .a", `${still.painting.artist}, ${still.painting.year}`);
    // the reveal waits for the sharp painting (decoded: the remembered one is already, a sharp copy of the first one is fetched)
    const done = still.sharp
      ? Promise.resolve()
      : (async () => {
          const img = await loadImage(firstPaintingSrc(still.painting.file, window.innerWidth, window.devicePixelRatio || 1, await whenWebpKnown()));
          if (!img || engineRef.current) return; // it did not come (the placeholder stays), or the engine has taken over and fades it in itself
          // the sharp painting goes over the placeholder (a fade over 200 ms when it comes after the reveal has begun) and is the painting the cycle starts with
          rememberPainting(still.painting.id, img);
          flushSync(() => setSharpStill({ ...still, src: img.currentSrc || img.src, sharp: true }));
        })();
    // one frame more, so what the page's effects set in its first frame (the lockup's resting state, the cue) is painted too
    paintingHold.current = holdFor("painting", done.then(() => afterFrames(1)));
  }, []);

  const viewRef = usePaintEngine({ ...runtime, hostRef, blurRef, settled: engineGo });
  const cycleRef = usePaintingCycle({ ...runtime, viewRef, settled: paintGo });
  useLoader({ ...runtime, cycleRef, onReadyRef, settled: paintGo, captionUp });

  // The first painting's blurred placeholder, as a CSS backdrop under the canvas. loader.css shows it
  // only when the page was unlocked by the head script's failsafe before this script joined.
  const first = paintings.find((p) => p.id === firstPaintingId);
  const backdrop = first?.blur
    ? ({ "--hero-blur": `url("${first.blur}")`, "--hero-focal": first.focal } as CSSProperties)
    : undefined;

  const scrollToBlocks = () => {
    const el = rootRef.current;
    if (!el) return;
    window.scrollTo({
      top: el.offsetTop + el.offsetHeight,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <section
      ref={rootRef}
      id="hero"
      className="home-hero"
      aria-label="Home"
      data-softened={softened ? "" : undefined}
    >
      <div className="hero-layer">
        <div className="paint-host" ref={hostRef} style={backdrop} aria-hidden="true">
          {still ? (
            <img
              className="paint-still"
              src={still.src}
              alt=""
              decoding="sync"
              style={{ objectPosition: still.focal, transform: `scale(${still.zoom})` }}
            />
          ) : null}
          {sharpStill ? (
            <img
              ref={sharpRef}
              className="paint-still"
              src={sharpStill.src}
              alt=""
              decoding="sync"
              style={{ objectPosition: sharpStill.focal, transform: `scale(${sharpStill.zoom})` }}
            />
          ) : null}
        </div>
        <div className="tex" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="hero-edge" aria-hidden="true" />
        <Lockup name={name} roles={roles} />
        <div className="caption">
          <span className="t" />
          <span className="a" />
        </div>
        <button type="button" className="cue" onClick={scrollToBlocks}>
          My Interests
        </button>
      </div>
      <div className="edge-glow l" aria-hidden="true" />
      <div className="edge-glow r" aria-hidden="true" />
      {children}
    </section>
  );
});

export default Hero;
