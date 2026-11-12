import { clamp, LIFT } from "./shelf-math";

/**
 * Where a lifted book goes and where its note stands, in CSS pixels on the stage. Pure: the open
 * path (shelf-open.ts) measures the stage, the book and the note, asks here, and turns the answer
 * into world units for the pose.
 *
 * The book first rises straight up by 38% of its height (`lift`), but never so far that its top
 * leaves the layer (`MARGIN` from the top). Then it turns to its cover, which is wider than the
 * spine: on a wide screen the book and the note card (beside it) are kept inside the stage, the
 * book moving sideways only as far as that needs, and shrunk if the pair is still too wide; on a
 * narrow screen the card is a sheet along the bottom, so the book stays above it (and under the
 * header), shrunk to fit.
 */

/** The least space between the lifted book and the layer's edge, in CSS pixels. */
export const MARGIN = 8;
/** The space kept between a narrow screen's note sheet and the book above it. */
export const SHEET_GAP = 12;
/** The smallest the lifted book is ever drawn, as a share of its size in the row. */
export const MIN_OPEN_SCALE = 0.2;

/** A stage this high or less is a landscape phone: the note card is compact (reading.css) and stays under the header. */
export const SHORT_PX = 520;

/**
 * The note stands beside the book on a wide screen, and on a landscape phone (at least 640 px wide but
 * not taller than 520, where a sheet along the bottom would leave the book no room); otherwise it
 * is a sheet along the bottom (reading.css has the same two media queries).
 */
export function sideBySide(vw: number, vh: number): boolean {
  return vw > 860 || (vw >= 640 && vh <= SHORT_PX);
}

export type LiftInput = {
  vw: number;
  vh: number;
  /** The row: the book's centre column and the pixel row of its top, as it stands. */
  rowX: number;
  rowTop: number;
  /** The book's height as it stands in the row, and its width turned to its cover, both in px. */
  rowH: number;
  coverW: number;
  /** The layer's header ends here, and the books' feet are on this row. */
  headBottom: number;
  baseRow: number;
  wide: boolean;
  /** The note card: its size and (wide) the gap between it and the book. */
  note: { w: number; h: number };
  gap: number;
};

export type LiftOut = {
  /** How far the book rises, straight up (px). */
  lift: number;
  /** The final centre of the book and its size against the row's (1 or less). */
  cx: number;
  cy: number;
  scale: number;
  /** Wide only: the note card's left edge and its centre line (px). Null on a narrow screen. */
  note: { left: number; centreY: number } | null;
};

/** Where the book stops: 1 or less of its row size, centred as far as it can be on `rowX` and `lifted`. */
export function liftLayout(p: LiftInput): LiftOut {
  const lift = clamp(LIFT * p.rowH, 0, Math.max(0, p.rowTop - MARGIN));
  const liftedCentre = p.rowTop - lift + p.rowH / 2;
  const sheetTop = p.vh - 16 - p.note.h - SHEET_GAP;
  const areaTop = p.wide ? MARGIN : Math.min(p.headBottom, sheetTop - 40);
  const areaBottom = p.wide ? p.vh - MARGIN : sheetTop;
  const availW = p.wide ? p.vw - 2 * MARGIN - p.gap - p.note.w : p.vw - 2 * MARGIN;
  const scale = clamp(
    Math.min(1, availW / p.coverW, (areaBottom - areaTop) / p.rowH),
    MIN_OPEN_SCALE,
    1,
  );
  const w = p.coverW * scale;
  const h = p.rowH * scale;
  const cy = clamp(liftedCentre, areaTop + h / 2, Math.max(areaTop + h / 2, areaBottom - h / 2));
  if (!p.wide) {
    return { lift, cx: clamp(p.rowX, MARGIN + w / 2, p.vw - MARGIN - w / 2), cy, scale, note: null };
  }
  // the pair is book and card side by side; the card goes to the side the book needs to move least for
  const total = w + p.gap + p.note.w;
  const x0 = (preferred: number) => clamp(preferred, MARGIN, Math.max(MARGIN, p.vw - MARGIN - total));
  const right = x0(p.rowX - w / 2);
  const left = x0(p.rowX - w / 2 - p.gap - p.note.w);
  const cardRight = Math.abs(right - (p.rowX - w / 2)) <= Math.abs(left - (p.rowX - w / 2 - p.gap - p.note.w));
  // the card stays clear of the header's Close button when the stage is short (a landscape phone)
  const noteH = p.note.h;
  const noteTop = p.vh <= SHORT_PX ? Math.max(MARGIN, p.headBottom) : MARGIN;
  const centreY = clamp(cy, noteTop + noteH / 2, Math.max(noteTop + noteH / 2, p.vh - MARGIN - noteH / 2));
  return cardRight
    ? { lift, cx: right + w / 2, cy, scale, note: { left: right + w + p.gap, centreY } }
    : { lift, cx: left + p.note.w + p.gap + w / 2, cy, scale, note: { left, centreY } };
}
