import { shuffled } from "../../../content/shuffle";
import type { TileSize } from "./wall-math";

/**
 * The video wall's shape (spec 8.1): one finite block of small tiles, in a fixed shuffled order, that
 * the pointer moves around and that stops softly at its edges. No wrap. Everything here is pure and
 * takes the viewport as a parameter (the engine passes its canvas size in), so the wall can later be
 * drawn into a frame smaller than the window.
 *
 * Block space: the block's top-left corner is (0, 0); tile (col, row) sits at
 * (col * pitchX, row * pitchY) and holds video `row * cols + col` of the (already shuffled) list. A
 * "pan" is the block-space position of the screen's top-left corner.
 */

/** The seed the wall's order is shuffled with, so every visit sees the same order. */
export const WALL_SEED = 109;

/** The videos in the wall's order: shuffled once, with the fixed seed. */
export const wallOrder = <T>(videos: readonly T[]): T[] => shuffled(videos, WALL_SEED);

/** No tile is narrower than this, px, however small the screen. */
export const MIN_TILE_W = 96;

/** Round 6's tile width at a screen width; the new tiles are about half of it. */
const roundSixWidth = (vw: number) => (vw < 700 ? vw / 2.15 : Math.min(380, Math.max(230, vw / 5.2)));

/** A tile's width, px: half of round 6's, never under `MIN_TILE_W`. */
export const tileWidthFor = (vw: number): number => Math.max(MIN_TILE_W, roundSixWidth(vw) / 2);

export type BlockPlan = {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  gap: number;
  /** The block's size, px (the last row/column carries no trailing gap). */
  width: number;
  height: number;
};

/** The tile size a plan stands for, in the shape the pose, hit-testing and spread maths use. */
export const sizeOfPlan = (p: Pick<BlockPlan, "tileW" | "tileH" | "gap">): TileSize => ({
  cw: p.tileW,
  ch: p.tileH,
  gap: p.gap,
  pitchX: p.tileW + p.gap,
  pitchY: p.tileH + p.gap,
});

const measure = (cols: number, rows: number, tileW: number, tileH: number, gap: number): BlockPlan => ({
  cols,
  rows,
  tileW,
  tileH,
  gap,
  width: cols > 0 ? cols * (tileW + gap) - gap : 0,
  height: rows > 0 ? rows * (tileH + gap) - gap : 0,
});

/** The most the tiles may grow, as a factor, to make the block cover a screen they only just fail to. */
export const MAX_GROW = 1.2;

/** The grid of `count` tiles of width `tileW` that suits a `vw` by `vh` screen best, and whether its block covers the screen both ways. */
function bestGrid(count: number, tileW: number, vw: number, vh: number): { plan: BlockPlan; covers: boolean; score: number } {
  const tileH = (tileW * 9) / 16;
  const gap = Math.ceil(tileW * 0.075);
  let best = measure(1, count, tileW, tileH, gap);
  let bestScore = -Infinity;
  let covers = false;
  for (let cols = 1; cols <= count; cols++) {
    const p = measure(cols, Math.ceil(count / cols), tileW, tileH, gap);
    const rx = p.width / vw;
    const ry = p.height / vh;
    const empty = p.cols * p.rows - count;
    // covering the screen both ways comes first; then the block's shape follows the screen's, and a
    // ragged last row costs a little
    const c = Math.min(rx, ry) >= 1;
    const score = (c ? 1000 : 100 * Math.min(rx, ry)) - Math.abs(Math.log(rx / ry)) - (0.4 * empty) / cols;
    if (score > bestScore) {
      bestScore = score;
      best = p;
      covers = c;
    }
  }
  return { plan: best, covers, score: bestScore };
}

/**
 * How `count` tiles are laid out for a `vw` by `vh` screen: tiles about half of round 6's (never under
 * 96 px wide) in the grid whose block is larger than the screen in both directions and shaped most
 * like it, with the fewest empty cells in the last row. If the block only just fails to cover the
 * screen, the tiles grow a little (at most `MAX_GROW`) until it does. Where the count cannot cover
 * the screen both ways (a very large screen, very few videos), the grid that covers it best.
 */
export function blockPlan(count: number, vw: number, vh: number): BlockPlan {
  const tileW = tileWidthFor(vw);
  const gap = Math.ceil(tileW * 0.075);
  if (!(count > 0) || !(vw > 0) || !(vh > 0)) return measure(0, 0, tileW, (tileW * 9) / 16, gap);
  const first = bestGrid(count, tileW, vw, vh);
  if (first.covers) return first.plan;
  for (let g = 1.02; g <= MAX_GROW + 1e-9; g += 0.02) {
    const grown = bestGrid(count, tileW * g, vw, vh);
    if (grown.covers) return grown.plan;
  }
  return first.plan;
}

/** How far the last part of an edge resists, px. */
export const SOFT_EDGE = 80;

/** The pan range on one axis: the block's edge may come in as far as the screen's middle third, no further. */
export function panRange(size: number, view: number): [number, number] {
  const lo = -view / 3;
  const hi = size - (2 * view) / 3;
  // a block much smaller than the screen has no range: it stays centred
  return hi >= lo ? [lo, hi] : [(size - view) / 2, (size - view) / 2];
}

/** One axis: the position unchanged inside the range, and the last `margin` px before an edge stretched over `2 * margin` of pull. */
function softAxis(p: number, lo: number, hi: number): number {
  const margin = Math.min(SOFT_EDGE, (hi - lo) / 2);
  if (margin <= 0) return lo;
  const resist = (e: number) => (e >= 2 * margin ? margin : e - (e * e) / (4 * margin));
  if (p > hi - margin) return hi - margin + resist(p - (hi - margin));
  if (p < lo + margin) return lo + margin - resist(lo + margin - p);
  return p;
}

/**
 * The pan the screen shows for a pulled pan `x`, `y`: unchanged inside the range, and with a soft stop
 * at the edges (the last 80 px resist, easing to a halt), so the block's edge never passes the screen's
 * middle third. Monotonic, so a pull always moves the wall the way it goes. A pull may go up to
 * `SOFT_EDGE` past the range (`pullLimits`); beyond it the result stays at the edge.
 */
export function clampPan(x: number, y: number, plan: BlockPlan, vw: number, vh: number): [number, number] {
  const [x0, x1] = panRange(plan.width, vw);
  const [y0, y1] = panRange(plan.height, vh);
  return [softAxis(x, x0, x1), softAxis(y, y0, y1)];
}

/** How far a pulled pan may be held, per axis: the range with `SOFT_EDGE` of pull beyond each end. */
export function pullLimits(plan: BlockPlan, vw: number, vh: number): { x: [number, number]; y: [number, number] } {
  const [x0, x1] = panRange(plan.width, vw);
  const [y0, y1] = panRange(plan.height, vh);
  const room = (lo: number, hi: number) => Math.min(SOFT_EDGE, (hi - lo) / 2);
  return {
    x: [x0 - room(x0, x1), x1 + room(x0, x1)],
    y: [y0 - room(y0, y1), y1 + room(y0, y1)],
  };
}

/** The pan that puts the block's middle in the screen's middle. */
export const centredPan = (plan: BlockPlan, vw: number, vh: number): [number, number] => [
  (plan.width - vw) / 2,
  (plan.height - vh) / 2,
];

/** The few pixels the whole block floats by at rest, at wall-clock `t` seconds (nothing when `t` stands still at 0). */
export function restFloat(t: number): [number, number] {
  return [Math.sin(t * 0.37) * 3 + Math.sin(t * 0.11 + 1) * 1.5, Math.cos(t * 0.29) * 2.5 + Math.sin(t * 0.13) * 1.5];
}

/** The most `restFloat` moves the block from rest on either axis, px. */
export const FLOAT_MAX = 4.5;

/**
 * The tile one step from (`cx`, `cy`) in direction (`dx`, `dy`), or the same tile when there is none
 * (the block's edge, or the empty end of the last row).
 */
export function stepTile(
  plan: Pick<BlockPlan, "cols" | "rows">,
  count: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): { cx: number; cy: number } {
  const nx = cx + Math.sign(dx);
  const ny = cy + Math.sign(dy);
  if (nx < 0 || ny < 0 || nx >= plan.cols || ny >= plan.rows) return { cx, cy };
  return ny * plan.cols + nx < count ? { cx: nx, cy: ny } : { cx, cy };
}

/** The order thumbnails start loading in: the videos nearest the block's middle first, so the tiles on screen fill in first. */
export function loadOrder(plan: Pick<BlockPlan, "cols" | "rows">, count: number): number[] {
  const mx = (plan.cols - 1) / 2;
  const my = (plan.rows - 1) / 2;
  const at = (i: number) => Math.hypot((i % plan.cols) - mx, Math.floor(i / plan.cols) - my);
  return Array.from({ length: Math.max(0, count) }, (_, i) => i).sort((a, b) => at(a) - at(b) || a - b);
}
