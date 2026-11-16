import { useLocation } from "@remix-run/react";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

// A layout effect where there is a DOM (React warns about it on the server): the row is scrolled to its current tab in the page's first commit
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface DockRow {
  /** Whether the second row is open: true whenever the current page has one (a page change never closes it). */
  open: boolean;
  glassRef: RefObject<HTMLDivElement>;
  rowRef: RefObject<HTMLDivElement>;
  navRef: RefObject<HTMLElement>;
}

/**
 * The dock's second row. It keeps its state across a page change (round 7 change-arrival spec 5.2): `open` is true whenever
 * the current page has the row (`enabled`), so the dock is the same box in the picture of the page being left and in the live
 * page, and the pages that have the row (the rings, the two walls, My experience) change under a dock that does not move.
 * From Home (one row) to a page with the row, and back, the dock changes shape once, in the change's own morph of the dock's
 * group (page-transition.css), during the reveal. Nothing grows after a change: there is no closing before it, no 140 ms wait and
 * no opening after it. Focus inside the row stays where it is when the row stays (the work layout keeps one dock across the
 * rings and the walls; between the rings and My experience the dock is made again and `restoreDockFocus` puts it back).
 */
export function useDockRow(enabled: boolean): DockRow {
  const glassRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // On a narrow screen the row scrolls sideways: keep the current tab fully in view (it was cut at 320 px: "My experi").
  // In the first commit, and again when the fonts or the screen change.
  useIsoLayoutEffect(() => {
    if (!enabled) return;
    const reveal = () => {
      const scroller = rowRef.current?.querySelector<HTMLElement>(".dock-row-clip > div");
      const tab = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!scroller || !tab || scroller.scrollWidth <= scroller.clientWidth + 1) return;
      const box = scroller.getBoundingClientRect();
      const at = tab.getBoundingClientRect();
      const gap = 8;
      if (at.right > box.right - gap) scroller.scrollLeft += at.right - box.right + gap;
      else if (at.left < box.left + gap) scroller.scrollLeft -= box.left + gap - at.left;
    };
    reveal();
    window.addEventListener("resize", reveal);
    void document.fonts?.ready.then(reveal);
    return () => window.removeEventListener("resize", reveal);
  }, [enabled, pathname]);

  return { open: enabled, glassRef, rowRef, navRef };
}
