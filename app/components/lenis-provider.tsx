import Lenis from "lenis";
import { useEffect } from "react";
import { setActiveLenis } from "../lib/lenis-instance";

export default function LenisProvider() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let frameId: number | null = null;

    const start = () => {
      lenis = new Lenis({
        lerp: 0.1,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
      });
      setActiveLenis(lenis);

      const raf = (time: number) => {
        lenis?.raf(time);
        frameId = window.requestAnimationFrame(raf);
      };
      frameId = window.requestAnimationFrame(raf);
    };

    const stop = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      lenis?.destroy();
      lenis = null;
      setActiveLenis(null);
    };

    // Fully disabled under prefers-reduced-motion: reduce -> 100% native scroll.
    if (!media.matches) {
      start();
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        stop();
      } else {
        start();
      }
    };

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
      stop();
    };
  }, []);

  return null;
}
