import type { SiteBook, SiteVideo } from "../../../types";

/** Spine ink from the spine's luminance (mockup: inkOn). Dark ink on light spines, light on dark. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.56 ? "#17120d" : "#f6f0e2";
}

/** One spine of the mini shelf: width from the page count, height from the trim height. */
export function miniSpine(book: SiteBook): {
  width: number;
  height: number;
  background: string;
  ink: string;
  band: boolean;
} {
  return {
    width: Math.round(14 + book.pages * 0.055),
    height: Math.round(book.heightIn * 21),
    background: book.color,
    ink: inkOn(book.color),
    band: book.style === "band",
  };
}

export const MINI_WALL_COLUMNS = 7;
export const MINI_WALL_ROWS = 5;

/**
 * The video ids of each mini wall column. Column c takes every third video from offset c * 5,
 * wrapping round the list, so neighbouring columns show different thumbnails. Each column's
 * images are rendered twice by the component so the CSS drift loops without a seam.
 */
export function miniWallColumns(
  videos: readonly Pick<SiteVideo, "id">[],
  columns = MINI_WALL_COLUMNS,
  rows = MINI_WALL_ROWS,
): string[][] {
  if (videos.length === 0) return [];
  return Array.from({ length: columns }, (_, c) =>
    Array.from({ length: rows }, (_, r) => videos[(c * rows + r * 3) % videos.length].id),
  );
}

/** Small thumbnails only: the mini wall never loads the big ones. */
export const miniThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** The mini shelf never grows past this, so a wide block does not blow the spines up. */
export const MINI_SHELF_MAX_SCALE = 1.6;

/**
 * The scale that makes the mini shelf's row (spines plus the gaps between them) span `innerWidth`,
 * capped at MINI_SHELF_MAX_SCALE. 1 when there is nothing to fit or no width is known yet.
 */
export function fitMiniShelf(spines: readonly { w: number }[], innerWidth: number, gap: number): number {
  if (spines.length === 0 || innerWidth <= 0) return 1;
  const row = spines.reduce((sum, s) => sum + s.w, 0) + gap * (spines.length - 1);
  if (row <= 0) return 1;
  return Math.min(MINI_SHELF_MAX_SCALE, innerWidth / row);
}

/**
 * The mini shelf's scale: the width fit (fitMiniShelf), held back so the tallest spine still fits
 * `availableHeight` (the preview's height above the plank, with room for the hover lift), and never
 * below 0.5. 1 when there is nothing to fit or no height is known yet.
 */
export function miniShelfScale(
  spines: readonly { w: number; h: number }[],
  innerWidth: number,
  availableHeight: number,
  gap: number,
): number {
  if (spines.length === 0 || availableHeight <= 0) return 1;
  const tallest = Math.max(...spines.map((s) => s.h));
  const byHeight = tallest > 0 ? availableHeight / tallest : Infinity;
  return Math.max(0.5, Math.min(fitMiniShelf(spines, innerWidth, gap), byHeight));
}
