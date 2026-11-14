import { blockPlan, centredPan, panRange, sizeOfPlan } from "./wall-block";
import type { WallState } from "./wall-types";

/**
 * Fitting the block to the canvas (spec 8.1): the plan for the canvas's size and what the wall's own
 * state does when that plan changes (a resize, a phone turned on its side). Pure: it reads and writes
 * the state it is given and touches nothing else, so the engine only has to read the canvas's size.
 *
 * Tile keys are "cx,cy" and a key's video is `cy * cols + cx`, so when the grid changes (a different
 * column count) the same key would name a different video. The chosen video, the keyboard's tile and
 * the hovered tile therefore follow their video (`idx`) into the new grid, and the pan puts the
 * chosen or keyboard tile back in view.
 */

type Cell = { cx: number; cy: number };

const cellOfIdx = (idx: number, cols: number): Cell => ({ cx: idx % cols, cy: Math.floor(idx / cols) });
const keyOf = (c: Cell) => `${c.cx},${c.cy}`;
const idxOfKey = (key: string, cols: number): number => {
  const [cx, cy] = key.split(",").map(Number);
  return cy * cols + cx;
};

/** The key of the same video in a grid of `cols` columns; unchanged when it is not a cell key. */
function rekey(key: string, fromCols: number, toCols: number): string {
  return /^\d+,\d+$/.test(key) ? keyOf(cellOfIdx(idxOfKey(key, fromCols), toCols)) : key;
}

const within = (p: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, p));

/**
 * Fits the wall's state to its canvas size (`st.vw` by `st.vh`) for `count` videos: works out the plan,
 * and when the grid (columns or rows) changed, keeps the chosen video, the keyboard's tile and the
 * hover on their videos and stands the block where that tile is in view (the block's middle when there
 * is none). When only the tiles' size changed, the old pan is clamped into the new range instead of
 * being thrown away. Returns whether the grid changed (the first fit counts).
 */
export function fitBlock(st: WallState, count: number): boolean {
  const old = st.plan;
  const plan = blockPlan(count, st.vw, st.vh);
  const gridChanged = plan.cols !== old.cols || plan.rows !== old.rows;
  st.plan = plan;
  st.size = sizeOfPlan(plan);
  if (plan.cols <= 0) return gridChanged;

  if (gridChanged && old.cols > 0) {
    const { choice, kbd } = st;
    if (choice) st.choice = { ...choice, key: keyOf(cellOfIdx(choice.idx, plan.cols)) };
    if (kbd) st.kbd = cellOfIdx(kbd.cy * old.cols + kbd.cx, plan.cols);
    if (st.hoverKey) st.hoverKey = rekey(st.hoverKey, old.cols, plan.cols);
  }
  if (gridChanged) st.vel.x = st.vel.y = 0;

  const { pan, vw, vh } = st;
  const rx = panRange(plan.width, vw);
  const ry = panRange(plan.height, vh);
  const focus: Cell | null = st.choice ? cellOfIdx(st.choice.idx, plan.cols) : st.kbd;
  const { pitchX, pitchY, cw, ch } = st.size;
  const centreOn = (c: Cell) => {
    pan.x = within(c.cx * pitchX + cw / 2 - vw / 2, rx);
    pan.y = within(c.cy * pitchY + ch / 2 - vh / 2, ry);
  };
  if (gridChanged) {
    if (focus) centreOn(focus);
    else [pan.x, pan.y] = centredPan(plan, vw, vh);
  } else {
    pan.x = within(pan.x, rx);
    pan.y = within(pan.y, ry);
    if (focus) {
      // the same grid at a new tile size: keep the focused tile on the screen
      const x = focus.cx * pitchX - pan.x;
      const y = focus.cy * pitchY - pan.y;
      if (x < 0 || x + cw > vw || y < 0 || y + ch > vh) centreOn(focus);
    }
  }
  return gridChanged;
}
