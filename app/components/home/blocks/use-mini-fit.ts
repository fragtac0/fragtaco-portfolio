import { useEffect, type RefObject } from "react";
import { miniShelfScale } from "./mini-previews";

/** The gap between spines in the mini shelf (blocks.css `.ms-row`), and the room it keeps below and above. */
export const MINI_GAP = 3;
const FLOOR = 44; /* the row sits this far above the preview's bottom edge */
const LIFT = 16; /* headroom for the hover lift */

/**
 * Sets `--ms-fit` on the mini shelf's row: the scale that spans the preview's inner width (its width
 * less its side padding) as far as the preview's height allows (`miniShelfScale`). Re-run
 * whenever the preview is resized. No React state: the value goes straight to the element.
 */
export function useMiniFit(
  artRef: RefObject<HTMLElement>,
  rowRef: RefObject<HTMLElement>,
  spines: readonly { w: number; h: number }[],
) {
  useEffect(() => {
    const art = artRef.current;
    const row = rowRef.current;
    if (!art || !row || spines.length === 0) return;
    const apply = () => {
      const css = getComputedStyle(art);
      const inner = art.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      const room = art.clientHeight - FLOOR - LIFT;
      row.style.setProperty("--ms-fit", String(miniShelfScale(spines, inner, room, MINI_GAP)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(art);
    return () => ro.disconnect();
  }, [artRef, rowRef, spines]);
}
