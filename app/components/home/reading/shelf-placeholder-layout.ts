import type { SiteBook } from "~/types";
import { bookSize, flatFrame, initialCamX, LINE_PX, NARROW_PX, SHELF_GAP } from "./shelf-math";

export type PlaceholderLayout = {
  /** One flat bar per book: left edge and size in px, relative to the stage. */
  bars: { left: number; width: number; height: number }[];
  /** The line the bars stand on, in px from the stage's top. */
  floor: number;
  /** The hairline the bars stand on, in px relative to the stage. */
  line: { left: number; top: number; width: number; height: number };
};

/**
 * Where the flat placeholder stands, so the 3D shelf can replace it without anything jumping. It
 * reads the same frame the 3D shelf is fitted to (`flatFrame`): the same scale, the same row
 * (spine thickness times scale for a width, trim height times scale for a height, the same gaps),
 * the same line the feet stand on and the same hairline under them. On a narrow stage the camera
 * starts at the row's left end, so the row is shifted to match. Null until the stage has a size.
 */
export function placeholderLayout(
  books: readonly SiteBook[],
  stage: { w: number; h: number },
  /** Where the layer's header ends, in px from the stage's top (`headerBottom`). */
  top: number,
): PlaceholderLayout | null {
  if (books.length === 0 || stage.w <= 0 || stage.h <= 0) return null;
  const sizes = books.map(bookSize);
  const span = sizes.reduce((sum, s) => sum + s.T, 0) + SHELF_GAP * (books.length - 1);
  const tallest = Math.max(...sizes.map((s) => s.H));
  const f = flatFrame({ vw: stage.w, vh: stage.h, span, tallest, top });
  // the 3D camera's first x (the engine's `initialCamX`): the left end on a narrow stage
  const camX = initialCamX(f.maxX, stage.w < NARROW_PX);
  const centre = stage.w / 2 - camX * f.scale;
  let left = centre - (span * f.scale) / 2;
  const bars = sizes.map((s) => {
    const bar = { left, width: s.T * f.scale, height: s.H * f.scale };
    left += bar.width + SHELF_GAP * f.scale;
    return bar;
  });
  const lineW = f.reach * f.scale;
  return {
    bars,
    floor: f.baseRow,
    line: { left: centre - lineW / 2, top: f.baseRow, width: lineW, height: LINE_PX },
  };
}
