/**
 * The wall page's own geometry (spec 6.5), pure: the safe area from what is on screen, where the
 * plain grid of links puts a tile so it sits where the engine draws it, and which link an arrow key
 * moves to. No DOM: everything here has a vitest test.
 */

import { tileRect, type Grid, type Rect, type Safe } from "./gallery-math";

/** The 4% margin of the spec, on the sides and as the least above and below. */
export const WALL_MARGIN = 0.04;
/** Air kept between the grid and the heading or the dock: the drift (6 px) and a little more. */
export const WALL_GAP_PX = 12;

/**
 * The safe area of a wall: the grid keeps the margin from every edge, and clears the heading (its bottom
 * edge, px from the top) and the dock (the px it takes from the bottom, its open second row included) by
 * `WALL_GAP_PX`. The bands are not added to the 4% margin (the owner asked for far smaller margins): each
 * side is the larger of the two.
 */
export function wallSafe(vw: number, vh: number, headingBottom: number, dockBand: number): Safe {
  return {
    top: Math.max(WALL_MARGIN * vh, headingBottom + WALL_GAP_PX),
    bottom: Math.max(WALL_MARGIN * vh, dockBand + WALL_GAP_PX),
    side: WALL_MARGIN * vw,
  };
}

/**
 * Where the plain grid of links puts tile `i`: its layout rectangle, so the grid of links and the engine's picture
 * agree to the pixel and the swap moves nothing visible. `drift` is the engine's offset when it is not at rest (default none).
 */
export function fallbackBox(g: Grid, i: number, drift = { x: 0, y: 0 }): Rect {
  const r = tileRect(g, i);
  return { x: r.x + drift.x, y: r.y + drift.y, w: r.w, h: r.h };
}

/**
 * The tile an arrow key moves to from tile `i` in a grid of `cols` columns and `count` tiles: left and right
 * by one, up and down by a row (the last row may be short: down from above a missing slot goes to the last
 * tile), Home and End to the first and last. Stops at the edges. Returns `i` for any other key.
 */
export function arrowTarget(key: string, i: number, cols: number, count: number): number {
  const last = count - 1;
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, i - 1);
    case "ArrowRight":
      return Math.min(last, i + 1);
    case "ArrowUp":
      return i - cols >= 0 ? i - cols : i;
    case "ArrowDown":
      return Math.floor(i / cols) < Math.ceil(count / cols) - 1 ? Math.min(last, i + cols) : i;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return i;
  }
}
