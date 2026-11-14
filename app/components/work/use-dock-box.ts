import { useEffect, useState } from "react";
import { usePageSettled } from "../../lib/use-page-settled";
import { DOCK_SELECTOR } from "../experience/keep-out";
import { sameRect, settleDock, type Rect } from "./ring-keep-out";

/** Times (100 ms apart) it waits for the dock to stop opening or moving before it reads it anyway. */
const MAX_WAITS = 20;

/**
 * The dock's glass as it is on the screen (R117: measured at run time, as `experience/keep-out.ts` does), rounded outward to a few
 * pixels (`settleDock`), or null until it has been read for this size of screen. It is read only once the page change is over and
 * the dock has stopped opening (its second row grows over 400 ms: reading it halfway would plan the rings round a short dock), and again
 * when the screen is resized or the fonts arrive. A dock that is hidden or off the screen is not read. The rings use the
 * nominal dock (`nominalDock`) until then, so nothing is planned twice unless the dock is really a different size.
 */
export function useDockBox(vw: number, vh: number): Rect | null {
  const settled = usePageSettled();
  const [read, setRead] = useState<{ box: Rect; vw: number; vh: number } | null>(null);

  useEffect(() => {
    if (!settled) return;
    let timer = 0;
    let waits = 0;
    let gone = false;
    const measure = () => {
      if (gone) return;
      const glass = document.querySelector<HTMLElement>(DOCK_SELECTOR);
      if (!glass) return;
      const moving = glass.dataset.rowOpen === "false" || glass.getAnimations({ subtree: true }).length > 0;
      if (moving && waits++ < MAX_WAITS) {
        window.clearTimeout(timer);
        timer = window.setTimeout(measure, 100);
        return;
      }
      const r = glass.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0) || r.bottom > window.innerHeight + 1) return;
      const box = settleDock({ l: r.left, t: r.top, r: r.right, b: r.bottom });
      setRead((prev) => (prev && prev.vw === vw && prev.vh === vh && sameRect(prev.box, box) ? prev : { box, vw, vh }));
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      gone = true;
      window.clearTimeout(timer);
    };
  }, [settled, vw, vh]);

  return read && read.vw === vw && read.vh === vh ? read.box : null;
}
