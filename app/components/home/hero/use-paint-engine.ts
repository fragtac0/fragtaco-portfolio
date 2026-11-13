import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { hasWebGL } from "../../../lib/webgl-support";
import { createImageFallback } from "./image-fallback";
import { prefersReducedMotion, type HeroRuntime, type HeroView } from "./hero-runtime";
import { paintStep } from "./paint-gate";
import { createPaint, type PaintEngine } from "./paint-engine";

type Options = Pick<HeroRuntime, "rootRef" | "engineRef" | "parkedRef"> & {
  hostRef: RefObject<HTMLDivElement>;
  /** The blur to apply as soon as the engine exists (a card may be open already). */
  blurRef: MutableRefObject<0 | 1>;
  /** False while a page change is running: the engine starts when it is over (see usePageArrived). */
  settled: boolean;
};

/**
 * The painting engine and its draw loop. R6: a fresh canvas per effect run, because dispose()
 * loses its context. No WebGL (or `?nogl=1`): a plain <img> with a CSS crossfade, and the card
 * blur is the tint. The loop draws only when something moves (see paint-gate). Returns the page
 * visibility the painting cycle reads.
 */
export function usePaintEngine({ rootRef, hostRef, engineRef, parkedRef, blurRef, settled }: Options) {
  const viewRef = useRef<HeroView>({ pageVisible: true, heroOn: true });

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    // Starting WebGL (context, shaders) is the heavy part of arriving on this page: it waits for the page
    // change to be over. Meanwhile the remembered painting's still frame (hero.tsx) is what shows.
    if (!settled || !root || !host) return;
    const reduced = prefersReducedMotion();

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    // An opaque context is black until its first draw: with a still frame up, keep the canvas out of sight
    // until it holds the painting (below), so the still is never covered by the bare black.
    const still = host.querySelector<HTMLElement>(".paint-still");
    if (still && !still.hidden) canvas.style.visibility = "hidden";
    host.appendChild(canvas);
    let engine = hasWebGL() ? createPaint(canvas, { reducedMotion: reduced }) : null;
    if (engine) {
      root.dataset.gl = "on";
    } else {
      canvas.remove();
      root.dataset.gl = "off";
      engine = createImageFallback(host, { reducedMotion: reduced });
    }
    const paint: PaintEngine = engine;
    engineRef.current = paint;
    if (blurRef.current) paint.setBlur(blurRef.current);

    const view = viewRef.current;
    view.pageVisible = !document.hidden;
    view.heroOn = true;
    let lastDraw = 0;
    const onVisibility = () => {
      view.pageVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    // the last entry is the newest: a batch can hold several for the one target
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) view.heroOn = last.isIntersecting;
    });
    observer.observe(root);
    let raf = requestAnimationFrame(function loop(now) {
      raf = requestAnimationFrame(loop);
      const step = paintStep({
        pageVisible: view.pageVisible,
        heroOn: view.heroOn,
        layerOpen: parkedRef.current.layer,
        cardOpen: parkedRef.current.card,
        active: paint.busy() || paint.moving(),
        sinceLastDraw: now - lastDraw,
        // the still is the page's only picture until the engine has one: never cover it with the bare ground
        holdForPicture: !!still && !still.hidden && !paint.hasPicture(),
      });
      if (step === "park") {
        paint.pause(now);
        return;
      }
      paint.resume(now);
      if (step === "wait") return;
      lastDraw = now;
      paint.draw(now);
      // the painting is on the canvas: show it, and the still frame it replaces can go a frame later (hidden,
      // not removed: React owns it)
      if (still && !still.hidden && paint.hasPicture()) {
        canvas.style.visibility = "";
        requestAnimationFrame(() => (still.hidden = true));
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      paint.dispose();
      canvas.remove();
      engineRef.current = null;
    };
  }, [rootRef, hostRef, engineRef, parkedRef, blurRef, settled]);

  return viewRef;
}
