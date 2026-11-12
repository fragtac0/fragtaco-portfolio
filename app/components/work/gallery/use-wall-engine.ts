import { useEffect, useRef, useState, type RefObject } from "react";
import { createGallery } from "./gallery-engine";
import type { Gallery } from "./gallery-types";
import type { Safe } from "./gallery-math";

type Options = {
  /** The empty element the canvas is put in. React never renders children into it. */
  host: RefObject<HTMLElement>;
  /** False until the page change is over: nothing starts before it. */
  arrived: boolean;
  /** False until the wall has been measured. */
  measured: boolean;
  srcs: string[];
  aspect: number;
  reduced: boolean;
  /** Asked again at every resize of the engine. */
  safe: () => Safe;
  onHover(i: number | null): void;
  onActivate(i: number): void;
};

/**
 * Mounts the gallery engine on a fresh canvas once the page has arrived and the wall is measured, and
 * frees it on cleanup (a destroyed engine loses its GL context, so a canvas is never reused: the canvas is
 * made in the effect and removed in the cleanup, which also holds for React's double effect in dev). Returns
 * `live` (the engine is running: the plain grid gives way) and the engine (for `focus` and `resize`).
 * A null engine (no WebGL, three failed) or a lost context leaves `live` false and the plain grid stays.
 */
export function useWallEngine(o: Options): { live: boolean; api: RefObject<Gallery | null> } {
  const [live, setLive] = useState(false);
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
    const canvas = document.createElement("canvas");
    canvas.className = "wall-canvas";
    host.appendChild(canvas);
    const stop = () => {
      cancelled = true;
      api.current?.destroy();
      api.current = null;
      canvas.remove();
      setLive(false);
    };
    void createGallery(canvas, {
      items: latest.current.srcs.map((src) => ({ src })),
      aspect,
      reduced,
      safe: () => latest.current.safe(),
      onHover: (i) => latest.current.onHover(i),
      onActivate: (i) => latest.current.onActivate(i),
      onLost: stop,
    }).then((gallery) => {
      if (cancelled) {
        gallery?.destroy(); // the page left while three was loading
        return;
      }
      if (!gallery) {
        canvas.remove(); // no WebGL: the plain grid stays
        return;
      }
      api.current = gallery;
      setLive(true);
    });
    return stop;
    // `key` stands for the list of pictures
  }, [arrived, measured, key, aspect, reduced]);

  return { live, api };
}
