import { useEffect, useRef, type RefObject } from "react";
import { paintDots } from "./dot-field";

/** About 20 redraws a second. */
const DOT_FRAME_MS = 50;
/** The field is drawn at the device's pixel ratio, up to this. */
const DOT_DPR_MAX = 2;
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Draws the dot field (dot-field.ts) onto `ref`'s canvas, at the canvas's own CSS size (so it fills
 * whatever frame it is put in). Two effects: the first sizes the canvas (when its CSS box changes, and
 * when the device pixel ratio changes without the box changing, e.g. a move to another screen) and
 * paints a still frame each time, so a canvas that is on screen is never empty; the second runs the
 * loop, about 20 redraws a second while `running` and the tab is visible. Under reduced motion there
 * is no loop: the field is painted once and held still, and a change of the preference is followed
 * (the loop starts or stops at once). No React state is touched per frame.
 */
export function useDotField(ref: RefObject<HTMLCanvasElement>, running: boolean): void {
  // the sizing effect's painter, for the loop effect (null while there is no canvas)
  const paint = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;
    let key = "";
    let w = 0;
    let h = 0;
    const draw = () => {
      if (w && h) paintDots(c, w, h, performance.now() / 1000);
    };
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DOT_DPR_MAX);
      const next = `${canvas.clientWidth}x${canvas.clientHeight}@${dpr}`;
      if (next === key) return; // assigning a canvas size clears it: only do it for a real change
      key = next;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    paint.current = draw;
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    // the pixel ratio changed: `(resolution: Xdppx)` stops matching, so a fresh query is armed each time
    let dprQuery: MediaQueryList | null = null;
    const onDpr = () => {
      fit();
      watchDpr();
    };
    const watchDpr = () => {
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener("change", onDpr, { once: true });
    };
    watchDpr();
    return () => {
      paint.current = null;
      ro.disconnect();
      dprQuery?.removeEventListener("change", onDpr);
    };
  }, [ref]);

  useEffect(() => {
    const reduced = window.matchMedia(REDUCED);
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < DOT_FRAME_MS) return;
      last = now;
      paint.current?.();
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (running && !document.hidden && !reduced.matches) raf = requestAnimationFrame(loop);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      cancelAnimationFrame(raf);
    };
  }, [running]);
}
