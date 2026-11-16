import { ledgeHeight } from "./ledge";

/**
 * How the reading box frames the shelf (round 7 second look, spec 6; Task 30). The shelf is always drawn as the open page's picture
 * (a window sized stage, fitted by `flatFrame`); a frame only chooses which part of that picture it shows, and it may show a part
 * larger than the window. Docked in its box the frame shows the whole row on its ledge, as large as fits but never larger than the open
 * page draws it (`containFraming`, scale at most 1: RB10); over the opening the framing eases to the open page's own (the whole window,
 * scale 1) and closing is the same backwards, so at every size and at every t the scale only grows with t. Pure: the
 * engine's camera and DOM work is shelf-frame.ts.
 *
 * Everything is in pixels of the open page's picture unless it says the frame's. `t` is the move's position: 0 the box, 1 the
 * open page (the eased position the frame itself is at, `frameAt`).
 */

/** Breadth and height of a frame or window, in CSS pixels. */
export type Size = { w: number; h: number };
/** A rectangle of the open page's picture. */
export type Rect = { x: number; y: number; w: number; h: number };

/**
 * The shelf's extent in the open page's picture: `top` the tallest book's top, `bottom` the line the books stand on (the ledge's top
 * edge), `ledgeBottom` the foot of the ledge's front face, `left` and `right` the ledge's reach (it runs a little past the row).
 */
export type Row = { top: number; bottom: number; left: number; right: number; ledgeBottom: number };

/** The framing: the frame's pixels per picture pixel, and the point of the picture at the frame's centre. */
export type Framing = { scale: number; cx: number; cy: number };

/** What is kept clear round the shelf in its box: of the box's height above the tallest book (spec 6: at least 6%) and below the ledge, and of its width at each side. */
export const TOP_PAD = 0.07;
export const BOTTOM_PAD = 0.05;
export const SIDE_PAD = 0.03;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const mix = (a: number, b: number, e: number) => (1 - e) * a + e * b;

/**
 * The shelf's row in a `vw` by `vh` picture fitted by `flatFrame` (`scale` CSS pixels per world unit, the books' feet at `baseRow`, the ledge
 * `reach` world units wide), the camera at world x `cam` (the row slides the other way). `tallest` is the tallest book's height in world units.
 */
export function windowRow(p: {
  vw: number;
  vh: number;
  scale: number;
  baseRow: number;
  reach: number;
  tallest: number;
  cam?: number;
}): Row {
  const half = (p.reach * p.scale) / 2;
  const mid = p.vw / 2 - (p.cam ?? 0) * p.scale;
  return {
    left: mid - half,
    right: mid + half,
    top: p.baseRow - p.tallest * p.scale,
    bottom: p.baseRow,
    ledgeBottom: p.baseRow + ledgeHeight(p.vh, p.baseRow),
  };
}

/**
 * The framing that puts the whole row, ledge included, inside a `frame`-sized box, as large as fits: the books and the ledge keep
 * `TOP_PAD`, `BOTTOM_PAD` and `SIDE_PAD` clear, and what is left over is shared so the shelf sits in the middle of that room. The scale
 * is at most 1 (RB10): the box never draws the row larger than the open page does (its textures are painted for that size, and the
 * opening would shrink the books), so a box that has room to spare (a landscape phone) shows the open page's row, centred, a little
 * smaller than the room allows.
 */
export function containFraming(frame: Size, row: Row): Framing {
  const availW = frame.w * (1 - 2 * SIDE_PAD);
  const availH = frame.h * (1 - TOP_PAD - BOTTOM_PAD);
  const scale = Math.min(1, availW / (row.right - row.left), availH / (row.ledgeBottom - row.top));
  const bandMid = frame.h * (TOP_PAD + (1 - TOP_PAD - BOTTOM_PAD) / 2);
  return {
    scale,
    cx: (row.left + row.right) / 2,
    cy: (row.top + row.ledgeBottom) / 2 + (frame.h / 2 - bandMid) / scale,
  };
}

/**
 * The framing at `t` of a move that starts in a `box`-sized frame and ends in the `win` window: the box's own (`containFraming`) at 0 and
 * exactly the open page's at 1 (scale 1, the window's middle). The scale eases geometrically (the same zoom rate the whole way) and
 * the centre in a straight line, so it is monotonic (the box's scale is at most 1, so it only grows with t) and has no step at either end.
 */
export function shelfFraming(box: Size, win: Size, row: Row, t: number): Framing {
  const e = clamp01(t);
  const at = containFraming(box, row);
  return {
    scale: Math.pow(at.scale, 1 - e),
    cx: mix(at.cx, win.w / 2, e),
    cy: mix(at.cy, win.h / 2, e),
  };
}

/** The part of the picture a `frame` shows under `fr` (it may stick out of the window). */
export function framingRect(fr: Framing, frame: Size): Rect {
  const w = frame.w / fr.scale;
  const h = frame.h / fr.scale;
  return { x: fr.cx - w / 2, y: fr.cy - h / 2, w, h };
}

/** The frame's size at `t` of a move from `box` to `win` (the straight line `frameAt` draws). */
export function frameSizeAt(box: Size, win: Size, t: number): Size {
  const e = clamp01(t);
  return { w: mix(box.w, win.w, e), h: mix(box.h, win.h, e) };
}

/** The steps over the move that the dot field's reach is taken over. */
const REGION_STEPS = 20;

/**
 * The part of the picture the dot field must be painted over to cover the frame all through the move: from the picture's far left
 * and right and top that the frame ever shows, down to the line the books stand on (the field stops there). Fixed for a box and a window,
 * so its canvas keeps one size while the frame moves.
 */
export function dotRegion(box: Size, win: Size, row: Row): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  for (let i = 0; i <= REGION_STEPS; i++) {
    const t = i / REGION_STEPS;
    const r = framingRect(shelfFraming(box, win, row, t), frameSizeAt(box, win, t));
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
  }
  // a whole pixel of room each side, so a rounded edge never shows a seam
  const x = Math.floor(x0) - 1;
  const y = Math.floor(y0) - 1;
  return { x, y, w: Math.ceil(x1) + 1 - x, h: row.bottom - y };
}

/**
 * How fine the dot field is painted while it is framed, as a share of the pixel ratio the open page paints it at: the field is shown at the
 * framing's scale (the dots, 0.8 to 1.7 px across and 2 to 10% cream, are tiny textures), so its canvas is painted at about that scale and a
 * little over, never under `DOT_RES_MIN`; the region it covers (`dotRegion`) is larger than the window, so painting it at full size is
 * several times the work of the box's own canvas before (the first frame on screen at 4 times slower CPU).
 */
export const DOT_RES_MIN = 0.25;
export const dotRes = (scale: number): number => Math.min(1, Math.max(DOT_RES_MIN, scale * 1.25));

/** A box of the picture in the frame's pixels. */
export type Box = { left: number; right: number; top: number; bottom: number };

/** Every book's box and the ledge's, in the frame's pixels under `fr` (the check of spec 6: all inside the frame). */
export function projectRow(
  row: Row,
  books: Box[],
  fr: Framing,
  frame: Size,
): { books: Box[]; ledge: Box } {
  const rect = framingRect(fr, frame);
  const to = (b: Box): Box => ({
    left: (b.left - rect.x) * fr.scale,
    right: (b.right - rect.x) * fr.scale,
    top: (b.top - rect.y) * fr.scale,
    bottom: (b.bottom - rect.y) * fr.scale,
  });
  return {
    books: books.map(to),
    ledge: to({ left: row.left, right: row.right, top: row.bottom, bottom: row.ledgeBottom }),
  };
}
