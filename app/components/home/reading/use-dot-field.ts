import { useEffect, type RefObject } from "react";
import { paintDots } from "./dot-field";

/** About 20 redraws a second. */
export const DOT_FRAME_MS = 50;
/** The field is drawn at the device's pixel ratio, up to this. */
const DOT_DPR_MAX = 2;

/**
 * Draws the dot field (dot-field.ts) onto `ref`'s canvas, at the canvas's own CSS size (so it fills
 * whatever frame it is put in). A still frame is drawn whenever the size changes, so a canvas that is
 * on screen is never empty; while `running` and the tab is visible the field is redrawn about 20
 * times a second (also under reduced motion: the swell is slow and barely visible). The loop stops
 * when `running` turns false or the tab is hidden. No React state is touched per frame.
 */
export function useDotField(ref: RefObject<HTMLCanvasElement>, running: boolean): void {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    let w = 0;
    let h = 0;
    const paint = () => {
      if (w && h) paintDots(c, w, h, performance.now() / 1000);
    };
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DOT_DPR_MAX);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < DOT_FRAME_MS) return;
      last = now;
      paint();
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (running && !document.hidden) raf = requestAnimationFrame(loop);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ref, running]);
}
