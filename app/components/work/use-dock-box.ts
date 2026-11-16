import { useEffect, useLayoutEffect, useState } from "react";
import { DOCK_SELECTOR } from "../experience/keep-out";
import { sameRect, settleDock, type Rect } from "./ring-keep-out";

// Layout effects warn on the server, where nothing is measured.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The dock's glass as it is on the screen (R117: measured at run time, as `experience/keep-out.ts` does), rounded outward to a few
 * pixels (`settleDock`), or null until it has been read for this size of screen. It is read in the page's first commit (since R56 the
 * dock's second row is there from the start and never opens after a change, so the box does not move: a page that comes in through a
 * change has the rings planned round the real dock before the reveal), and again when the screen is resized or the fonts arrive. A dock that is
 * hidden or off the screen is not read. The rings use the nominal dock (`nominalDock`) until then, so nothing is planned twice unless
 * the dock is really a different size.
 */
export function useDockBox(vw: number, vh: number): Rect | null {
  const [read, setRead] = useState<{ box: Rect; vw: number; vh: number } | null>(null);

  useIsoLayoutEffect(() => {
    let gone = false;
    const measure = () => {
      if (gone) return;
      const glass = document.querySelector<HTMLElement>(DOCK_SELECTOR);
      if (!glass) return;
      const r = glass.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0) || r.bottom > window.innerHeight + 1) return;
      const box = settleDock({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      setRead((prev) => (prev && prev.vw === vw && prev.vh === vh && sameRect(prev.box, box) ? prev : { box, vw, vh }));
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      gone = true;
    };
  }, [vw, vh]);

  return read && read.vw === vw && read.vh === vh ? read.box : null;
}
