import { useEffect, type RefObject } from "react";

/**
 * Sets `--fb-top` on a plain grid's scroller (`.fb-scroll`): the layer header's bottom edge measured from the
 * scroller's top, so the first row starts under the heading's title and count however tall they are (a heading
 * that wraps, a larger text size) instead of at a guessed offset. Follows the header's size and the window's.
 * layer.css falls back to its estimate until this has run. No React state.
 */
export function useHeadClear(scrollRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = scrollRef.current;
    const head = el?.closest(".home-layer")?.querySelector<HTMLElement>(".xp-head");
    if (!el || !head) return;
    const set = () => {
      const bottom = head.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
      el.style.setProperty("--fb-top", `${Math.max(0, Math.ceil(bottom))}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(head);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, [scrollRef]);
}
