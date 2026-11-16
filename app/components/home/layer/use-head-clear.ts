import { useEffect, type RefObject } from "react";

/** How far the first row must start from the layer's top to clear the header: its bottom edge, in whole pixels, never negative. */
export function headClearPx(headBottom: number, layerTop: number): number {
  return Math.max(0, Math.ceil(headBottom - layerTop));
}

/**
 * Sets `--fb-top` on a plain grid's scroller (`.fb-scroll`): the layer header's bottom edge measured from the
 * layer's top (the window the open page fills), so the first row starts under the heading's title and count however
 * tall they are (a heading that wraps, a larger text size) instead of at a guessed offset.
 *
 * The grid lives in the box's scene element, which is carried into the layer when it opens, so there is no layer (and
 * no header) when this runs first. The header is looked up on every measure, and a measure runs when the scroller
 * changes size (box to window: the layer has arrived), when the header changes size and when the window does. The
 * measure is taken from the layer, not from the scroller, which mid-move sits in a scaled frame. layer.css falls back
 * to its estimate until a measure has run. No React state.
 */
export function useHeadClear(scrollRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let watched: Element | null = null;
    const ro = new ResizeObserver(() => set());
    function set() {
      const layer = el!.closest(".home-layer");
      const head = layer?.querySelector<HTMLElement>(".xp-head");
      if (!layer || !head) return;
      if (head !== watched) {
        if (watched) ro.unobserve(watched);
        ro.observe(head);
        watched = head;
      }
      const px = headClearPx(head.getBoundingClientRect().bottom, layer.getBoundingClientRect().top);
      el!.style.setProperty("--fb-top", `${px}px`);
    }
    set();
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, [scrollRef]);
}
