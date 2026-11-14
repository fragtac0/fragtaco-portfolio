import { useEffect, type RefObject } from "react";
import type { SiteBook } from "../../../types";
import { paintSpine } from "../reading/spine-paint";
import { spineFontsReady, watchSpineFonts } from "../reading/spine-fonts";
import { designFor } from "../reading/spine-series";
import { spineColours } from "../reading/spine-styles";

/** The small shelf's author is set a little under the 3D shelf's 10 px floor: the block is a picture, not a page to read. */
export const MINI_AUTHOR_MIN_CSS = 5;
const MAX_DPR = 2;

/**
 * Paints the small shelf's spines with the same painter as the 3D shelf (spine-paint.ts), at their
 * size on screen: each `canvas[data-spine]` in the row is its spine's own size times the shelf's fit
 * (`--ms-fit`, set by use-mini-fit) times the pixel ratio. They are painted after the spine faces
 * are ready (until then the cloth stands in), again when the block is resized and again when a late
 * face arrives. Call after `useMiniFit` so a resize reads the new fit. No React state.
 */
export function useMiniSpines(
  artRef: RefObject<HTMLElement>,
  rowRef: RefObject<HTMLElement>,
  books: readonly SiteBook[],
  spines: readonly { width: number; height: number }[],
) {
  useEffect(() => {
    const art = artRef.current;
    const row = rowRef.current;
    if (!art || !row || books.length === 0) return;
    const designs = books.map((b) => designFor(b, spineColours({ dominant: b.color, secondary: b.color })));
    const letters = books.map((b) => `${b.title} ${b.author}`).join(" ");
    let ready = false;
    let done = "";
    const paint = (force: boolean) => {
      if (!ready) return;
      const fit = parseFloat(row.style.getPropertyValue("--ms-fit")) || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const key = `${fit.toFixed(3)}@${dpr}`;
      if (!force && key === done) return;
      done = key;
      row.querySelectorAll<HTMLCanvasElement>("canvas[data-spine]").forEach((c) => {
        const i = Number(c.dataset.spine);
        const book = books[i];
        const size = spines[i];
        const ctx = c.getContext("2d");
        if (!book || !size || !ctx) return;
        const w = Math.max(8, Math.round(size.width * fit * dpr));
        const h = Math.max(8, Math.round(size.height * fit * dpr));
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        paintSpine(ctx, w, h, book, designs[i], { dpr, authorMinCss: MINI_AUTHOR_MIN_CSS });
      });
    };
    let stopped = false;
    const stopWatch = watchSpineFonts(designs, letters, () => paint(true));
    void spineFontsReady(designs, letters).then(() => {
      if (stopped) return;
      ready = true;
      paint(true);
    });
    const ro = new ResizeObserver(() => paint(false));
    ro.observe(art);
    return () => {
      stopped = true;
      stopWatch();
      ro.disconnect();
    };
  }, [artRef, rowRef, books, spines]);
}
