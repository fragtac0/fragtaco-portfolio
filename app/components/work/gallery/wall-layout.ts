/**
 * The wall page's own geometry (spec 6.5), pure: the safe area from what is on screen, where the
 * plain grid of links puts a tile so it sits where the engine draws it (the barrel warp included), and
 * which link an arrow key moves to. No DOM: everything here has a vitest test.
 */

import { warp, tileRect, type Grid, type Rect, type Safe } from "./gallery-math";

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
 * Where the plain grid puts tile `i`: its layout rectangle seen through the barrel warp, as a box (the
 * warped left and right edges at the tile's middle height, the warped top and bottom at its middle
 * width), so the grid of links and the engine's picture agree to a pixel or two and the swap moves
 * nothing visible. `drift` is the engine's offset when it is not at rest (default none).
 */
export function fallbackBox(g: Grid, i: number, vw: number, vh: number, drift = { x: 0, y: 0 }): Rect {
  const r = tileRect(g, i);
  const cx = r.x + r.w / 2 + drift.x;
  const cy = r.y + r.h / 2 + drift.y;
  const [left] = warp(r.x + drift.x, cy, vw, vh);
  const [right] = warp(r.x + r.w + drift.x, cy, vw, vh);
  const [, top] = warp(cx, r.y + drift.y, vw, vh);
  const [, bottom] = warp(cx, r.y + r.h + drift.y, vw, vh);
  return { x: left, y: top, w: right - left, h: bottom - top };
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
