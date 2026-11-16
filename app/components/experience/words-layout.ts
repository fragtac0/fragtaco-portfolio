// Where My experience's words sit on a wide screen (round 7 second look, spec 7): the title block to the left of the mountain and the
// mountain's block to the right, both centred on the summit's row. Pure maths on the overview's frame (view.ts: where the cliff, the beads
// and the trail are on the stage), so the clearances are worked out and not guessed. The page measures its own blocks and hands the sizes in
// (use-words-layout.ts); a narrow or upright screen keeps the old places (no room beside the mountain).
import { SUMMIT_XY } from "./frame";
import { BEAD_REACH, TRAIL_REACH, overlaps, type Box } from "./keep-out";
import { overviewAt, type Look, type Stage } from "./view";

/** A wide screen: at least 900 px wide and wider than it is high. The same words as the stylesheet's media query (experience.css), which places the blocks before the page has measured anything. */
export const WIDE_MEDIA = "(min-width: 900px) and (min-aspect-ratio: 1001/1000)";
export const isWide = (stage: Stage): boolean => stage.w >= 900 && stage.w > stage.h;

/** The title block's right edge stays this far from the mountain's cliff at its rows, in pixels; the title shrinks toward `TITLE_MIN` to keep that. */
export const CLIFF_GAP = 24;
export const TITLE_MIN = 34;
/** The mountain's block stays this far from every bead, the trail and the switch, in pixels, and is at most this many characters wide. */
export const MARK_GAP = 32;
export const CAPTION_CHARS = 32;
/** A bead's touch target is 44 px: its half, round the bead's centre, is what the mountain's block keeps clear of (then `MARK_GAP` more). */
export const BEAD_HALF = 22;
/** The room kept at the screen's edges, and between the mountain's block and the dock, in pixels. */
export const EDGE = 12;
export const DOCK_ROOM = 6;

/** A point on the stage from a point of the map, for the overview's look. */
const place = (look: Look, stage: Stage) => (p: readonly [number, number]): [number, number] => overviewAt(look, stage, p[0], p[1]);

/** The summit's row on the stage (its y): the middle of the stage in the overview as framed, but read from the frame's maths. */
export const summitRow = (look: Look, stage: Stage): number => overviewAt(look, stage, SUMMIT_XY[0], SUMMIT_XY[1])[1];

/**
 * The leftmost x of a closed ring (a list of points) within the rows `top` to `bottom`: the ring's own points inside the rows and where its edges
 * cross the rows' two ends. Infinity when the ring does not reach those rows.
 */
export function ringLeftWithin(ring: readonly (readonly [number, number])[], top: number, bottom: number): number {
  let left = Infinity;

  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];

    if (ay >= top && ay <= bottom) left = Math.min(left, ax);
    for (const row of [top, bottom]) {
      if (ay !== by && (ay - row) * (by - row) <= 0) left = Math.min(left, ax + ((bx - ax) * (row - ay)) / (by - ay));
    }
  }

  return left;
}

/** The size a block takes at a title size (the page measures it). */
export type Measured = { w: number; h: number };

/**
 * The title block: the largest title size from `max` down to `TITLE_MIN` (whole pixels) at which the block, centred on `row` with its left at
 * `left`, ends at least `CLIFF_GAP` short of the cliff's leftmost x over its rows (`cliffLeft(top, bottom)`) and stays inside the screen and clear of the
 * dock. Null when even `TITLE_MIN` does not fit (the page keeps the old places). A block that fits at a size fits at every smaller one (it only gets
 * smaller, inside the bigger one), so the size is found by halving the range: a handful of measures, each a layout of the page.
 */
export function fitTitle(
  measure: (size: number) => Measured,
  at: { row: number; left: number; max: number; cliffLeft: (top: number, bottom: number) => number; stage: Stage; dock: Box | null },
): { size: number; box: Box } | null {
  const tried = (size: number): { size: number; box: Box } | null => {
    const { w, h } = measure(size);
    const box: Box = { l: at.left, t: at.row - h / 2, r: at.left + w, b: at.row + h / 2 };
    const inScreen = box.t >= EDGE && box.b <= at.stage.h - EDGE;
    const clear = box.r + CLIFF_GAP <= at.cliffLeft(box.t, box.b) && (at.dock === null || !overlaps(box, at.dock, DOCK_ROOM));

    return inScreen && clear ? { size, box } : null;
  };
  let best = tried(TITLE_MIN);

  if (best === null) return null;

  let [lo, hi] = [TITLE_MIN, Math.floor(at.max)];

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const got = tried(mid);

    if (got !== null) [lo, best] = [mid, got];
    else hi = mid - 1;
  }

  return best;
}

/**
 * The mountain's block: its top edge, for a block `h` tall that ends at `right`, `w` wide. As near the summit's row (`row`) as it can be: centred on
 * it where nothing is in the way, else moved up or down the least it needs (up on a tie) so that it overlaps none of `blocked` and stays inside `bounds`.
 * Null when no place is free.
 */
export function placeBlock(w: number, h: number, right: number, row: number, blocked: readonly Box[], bounds: Box): number | null {
  const free = (top: number) => {
    const box: Box = { l: right - w, t: top, r: right, b: top + h };

    return box.t >= bounds.t && box.b <= bounds.b && !blocked.some((b) => overlaps(box, b));
  };
  const centred = Math.round(row - h / 2);

  for (let d = 0; d <= bounds.b - bounds.t; d++) {
    if (free(centred - d)) return centred - d;
    if (free(centred + d)) return centred + d;
  }

  return null;
}

/** The map's marks the mountain's block keeps clear of: every bead, and the trail and its way ahead (every fourth sample), in map units. */
export type Marks = { beads: readonly (readonly [number, number])[]; lines: readonly (readonly (readonly [number, number])[])[] };

/** The boxes round the marks on the stage, `gap` pixels clear of a bead's touch target and of the line's reach. */
export function markBoxes(marks: Marks, look: Look, stage: Stage, gap = MARK_GAP): Box[] {
  const at = place(look, stage);
  const grow = ([x, y]: [number, number], reach: number): Box => ({ l: x - reach - gap, t: y - reach - gap, r: x + reach + gap, b: y + reach + gap });

  return [...marks.beads.map((p) => grow(at(p), Math.max(BEAD_HALF, BEAD_REACH))), ...marks.lines.flatMap((line) => line.filter((_, i) => i % 4 === 0).map((p) => grow(at(p), TRAIL_REACH)))];
}

export type WordsEnv = {
  stage: Stage;
  look: Look;
  /** The mountain's cliff, the beads and the lines, in map units. */
  cliff: readonly (readonly [number, number])[];
  marks: Marks;
  /** The page's gutter, and the boxes of the switch and the dock on the stage (null: none). */
  gutter: number;
  switchBox: Box | null;
  dock: Box | null;
  /** The title size the stylesheet gives (the most it can be), and the sizes the page measures: the title block at a size, and the mountain's block. */
  titleMax: number;
  measureTitle: (size: number) => Measured;
  caption: Measured;
};

export type WordsLayout =
  | { beside: false }
  | {
      beside: true;
      /** The title's size in px (at most `titleMax`, at least `TITLE_MIN`). */
      titleSize: number;
      /** Where the two blocks are on the stage, and how far the mountain's block is from being centred on the summit's row. */
      title: Box;
      caption: Box;
      captionDy: number;
    };

/** The layout of the words for a screen: beside the mountain on a wide screen where both blocks fit, else the old places. */
export function layoutWords(env: WordsEnv): WordsLayout {
  const { stage, look, gutter } = env;

  if (!isWide(stage)) return { beside: false };

  const row = summitRow(look, stage);
  const ring = env.cliff.map(place(look, stage));
  const title = fitTitle(env.measureTitle, { row, left: gutter, max: env.titleMax, cliffLeft: (t, b) => ringLeftWithin(ring, t, b), stage, dock: env.dock });

  if (title === null) return { beside: false };

  const { w, h } = env.caption;
  const right = stage.w - gutter;
  const near = (box: Box | null): Box[] => (box === null ? [] : [{ l: box.l - MARK_GAP, t: box.t - MARK_GAP, r: box.r + MARK_GAP, b: box.b + MARK_GAP }]);
  const blocked = [...markBoxes(env.marks, look, stage), ...near(env.switchBox), ...(env.dock === null ? [] : [{ l: env.dock.l, t: env.dock.t - DOCK_ROOM, r: env.dock.r, b: env.dock.b }])];
  const top = placeBlock(w, h, right, row, blocked, { l: 0, t: EDGE, r: stage.w, b: stage.h - EDGE });

  if (top === null) return { beside: false };

  return { beside: true, titleSize: title.size, title: title.box, caption: { l: right - w, t: top, r: right, b: top + h }, captionDy: top - Math.round(row - h / 2) };
}
