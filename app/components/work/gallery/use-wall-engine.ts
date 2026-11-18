import { useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { createGallery } from "./gallery-engine";
import type { Gallery } from "./gallery-types";
import type { Safe } from "./gallery-math";

/** How long the wall waits for its engine once three.js has been requested (the page has arrived and the wall is measured). If the engine is not running by then (three.js still downloading on a bad connection), the plain grid of links becomes the wall for that visit and the engine is given up (R74). */
export const ENGINE_WAIT_MS = 5000;

type Options = {
  /** The empty element the canvas is put in. React never renders children into it. */
  host: RefObject<HTMLElement>;
  /** False until the page change is over: nothing starts before it. */
  arrived: boolean;
  /** False until the wall has been measured. */
  measured: boolean;
  srcs: string[];
  /** The local art of each tile, same order as `srcs`: its stand-in until its picture is in, and for good if it never comes. */
  arts: string[];
  aspect: number;
  reduced: boolean;
  /** The wall was already showing as plain links when it was measured (a slow first load): the engine draws whole tiles at once and the links fade out under them. Read when the engine is about to draw its first frame. */
  instant: boolean;
  /** Asked again at every resize of the engine. */
  safe: () => Safe;
  onHover(i: number | null): void;
  onActivate(i: number): void;
};

/**
 * Mounts the gallery engine on a fresh canvas once the page has arrived and the wall is measured, and
 * frees it on cleanup (a destroyed engine loses its GL context, so a canvas is never reused: the canvas is
 * made in the effect and removed in the cleanup, which also holds for React's double effect in dev). Returns
 * `live` (the engine is running), `drawn` (it has drawn its first frame: the links are the list only from then on)
 * and the engine (for `focus` and `resize`).
 * A null engine (no WebGL, three failed) or a lost context leaves `live` false and sets `failed`: the plain grid of links
 * is then the wall. Until one of the two is known the links stay out of sight, so the wall's arrival is the first thing seen;
 * the wait for the engine to start is bounded (`ENGINE_WAIT_MS`), after which the plain grid is the wall for good.
 */
export function useWallEngine(o: Options): { live: boolean; drawn: boolean; failed: boolean; api: RefObject<Gallery | null> } {
  const [live, setLive] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const api = useRef<Gallery | null>(null);
  // the callbacks and the safe area change without restarting the engine
  const latest = useRef(o);
  useEffect(() => {
    latest.current = o;
  });
  const { arrived, measured, aspect, reduced } = o;
  const key = o.srcs.join("\n");

  useEffect(() => {
    const host = latest.current.host.current;
    if (!arrived || !measured || !host) return;
    let cancelled = false;
    setFailed(false);
    const canvas = document.createElement("canvas");
    canvas.className = "wall-canvas";
    host.appendChild(canvas);
    const late = window.setTimeout(() => {
      if (cancelled || api.current) return;
      cancelled = true; // the engine is given up: when it does come, it is freed (below)
      setFailed(true);
    }, ENGINE_WAIT_MS);
    const stop = () => {
      window.clearTimeout(late);
      cancelled = true;
      api.current?.destroy();
      api.current = null;
      canvas.remove();
      setLive(false);
      setDrawn(false);
    };
    // the browser took the context away: the plain grid is the wall from now on. It is put on screen in this same task
    // (flushSync) before the canvas goes, so there is no frame with neither.
    const lost = () => {
      flushSync(() => setFailed(true));
      stop();
    };
    void createGallery(canvas, {
      items: latest.current.srcs.map((src, i) => ({ src, art: latest.current.arts[i] ?? src })),
      aspect,
      reduced,
      instant: () => latest.current.instant,
      onDrawn: () => {
        if (!cancelled) setDrawn(true);
      },
      safe: () => latest.current.safe(),
      onHover: (i) => latest.current.onHover(i),
      onActivate: (i) => latest.current.onActivate(i),
      onLost: lost,
    }).then((gallery) => {
      window.clearTimeout(late);
      if (cancelled) {
        gallery?.destroy(); // the page left, or the wait ran out, while three was loading
        canvas.remove();
        return;
      }
      if (!gallery) {
        canvas.remove(); // no WebGL: the plain grid is the wall
        setFailed(true);
        return;
      }
      api.current = gallery;
      setLive(true);
    });
    return stop;
    // `key` stands for the list of pictures
  }, [arrived, measured, key, aspect, reduced]);

  return { live, drawn, failed, api };
}
