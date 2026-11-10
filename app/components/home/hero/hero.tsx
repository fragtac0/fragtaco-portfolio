import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import type { SiteHeroPainting } from "../../../types";
import "./hero.css";
import { prefersReducedMotion } from "./hero-runtime";
import type { PaintEngine } from "./paint-engine";
import Lockup from "./lockup";
import { useLoader } from "./use-loader";
import { usePaintEngine } from "./use-paint-engine";
import { usePaintingCycle } from "./use-painting-cycle";

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

  const runtime = { rootRef, engineRef, parkedRef, dataRef };
  const viewRef = usePaintEngine({ ...runtime, hostRef, blurRef });
  const cycleRef = usePaintingCycle({ ...runtime, viewRef });
  useLoader({ ...runtime, cycleRef, onReadyRef });

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
        <div className="paint-host" ref={hostRef} aria-hidden="true" />
        <div className="tex" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
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
