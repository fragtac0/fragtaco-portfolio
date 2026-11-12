import type { SiteBook } from "~/types";
import { EDGE_COLOUR, needsEdge, type SpineColours, type SpineStyle } from "./spine-styles";

/**
 * Paints a designed spine: the book's real title and author, set along the spine reading top to
 * bottom, in one of five styles (spine-styles.ts), in the colours made from its cover. Flat and
 * true to colour (the row is unlit). System font stacks only, no font files; serif is allowed
 * here because a spine is book art, not interface. The canvas is the spine as it stands on screen
 * (width across the spine, height top to bottom); everything is in shares of those two sizes, so
 * the same design is sharp at any pixel density. Client only (it takes a canvas context), but
 * `layoutTitle` and `splitLines` are pure and tested.
 */

export type SpineSize = { w: number; h: number };
type DrawBook = Pick<SiteBook, "title" | "author">;

/** A measuring function: the length in pixels along the spine of `text` set at font size `size`. */
export type Measure = (text: string, size: number) => number;

export type TitleLayout = { lines: string[]; size: number };

/** Two lines stand this far apart, in font sizes. */
const LINE_GAP = 1.08;
/** The title never takes more than this share of the spine's width across both lines. */
const FILL_ACROSS = 0.86;
/** A one line title steps down to this share of its full size before it wraps to two lines. */
const WRAP_BELOW = 0.6;
const STEP = 0.04;

/** The best split of `title` into two lines at a word break: the one whose longer line is shortest. Null for one word. */
export function splitLines(title: string, measure: Measure): [string, string] | null {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return null;
  let best: [string, string] | null = null;
  let bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const len = Math.max(measure(a, 100), measure(b, 100));
    if (len < bestLen) {
      bestLen = len;
      best = [a, b];
    }
  }
  return best;
}

/**
 * How to set a title: one line as large as `full` (the size that fills the spine's width) if it fits
 * `length`, stepping down to 60% of `full` before it gives up; then two lines, each as large as
 * they can be across `w` and as will fit `length`, shrinking until they do. A title of one word that
 * is still too long keeps shrinking (never below `floor`).
 */
export function layoutTitle(
  title: string,
  measure: Measure,
  p: { w: number; length: number; full: number; floor: number },
): TitleLayout {
  for (let s = p.full; s >= p.full * WRAP_BELOW - 1e-6; s -= p.full * STEP) {
    if (measure(title, s) <= p.length) return { lines: [title], size: s };
  }
  const two = splitLines(title, measure);
  if (!two) {
    let s = p.full * WRAP_BELOW;
    while (s > p.floor && measure(title, s) > p.length) s -= p.full * STEP;
    return { lines: [title], size: Math.max(p.floor, s) };
  }
  let s = Math.min(p.full, (FILL_ACROSS * p.w) / (2 * LINE_GAP));
  const longest = () => Math.max(measure(two[0], s), measure(two[1], s));
  while (s > p.floor && longest() > p.length) s -= p.full * STEP * 0.5;
  return { lines: two, size: Math.max(p.floor, s) };
}

type Face = {
  family: string;
  /** Title weight and author weight. */
  weight: [number, number];
  italic: boolean;
  caps: boolean;
  /** Letter spacing in font sizes. */
  track: number;
  /** Letters are squeezed to this share of their width (a condensed face from any sans). */
  squash: number;
  /** The full title size, in shares of the spine's width. */
  fill: number;
  /** Where the lettering runs, in shares of the spine's length: from `top` to `end`. */
  top: number;
  end: number;
};

const SANS = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
const SERIF = 'Georgia, "Times New Roman", Times, "Liberation Serif", serif';
const MONO = '"Courier New", Courier, "Liberation Mono", monospace';

/** The five styles, indexed by `SpineStyle`. */
const FACES: readonly Face[] = [
  // 0 heavy condensed capitals
  { family: SANS, weight: [900, 700], italic: false, caps: true, track: 0.02, squash: 0.72, fill: 0.74, top: 0.075, end: 0.93 },
  // 1 classic serif capitals between rules
  { family: SERIF, weight: [700, 400], italic: false, caps: true, track: 0.08, squash: 1, fill: 0.5, top: 0.125, end: 0.875 },
  // 2 italic serif title
  { family: SERIF, weight: [400, 400], italic: true, caps: false, track: 0, squash: 1, fill: 0.6, top: 0.07, end: 0.93 },
  // 3 typewriter
  { family: MONO, weight: [700, 400], italic: false, caps: false, track: 0, squash: 1, fill: 0.5, top: 0.1, end: 0.92 },
  // 4 light wide-spaced capitals
  { family: SANS, weight: [300, 300], italic: false, caps: true, track: 0.34, squash: 1, fill: 0.44, top: 0.09, end: 0.91 },
];

/** The title takes this share of the lettering's length and the author the last part, with a gap between. */
const TITLE_SHARE = 0.68;
const AUTHOR_SHARE = 0.25;

/** The longest and shortest title size the spine allows, in shares of its width. */
const MIN_SIZE = 0.16;

const fontOf = (f: Face, weight: number, size: number): string =>
  `${f.italic ? "italic " : ""}${weight} ${size.toFixed(2)}px ${f.family}`;

/** A text measurer for a face on this context; letter spacing and squeeze count in the length. */
function measurer(x: CanvasRenderingContext2D, f: Face, weight: number | ((size: number) => number)): Measure {
  return (text, size) => {
    x.font = fontOf(f, typeof weight === "number" ? weight : weight(size), size);
    const n = [...text].length;
    return (x.measureText(text).width + f.track * size * Math.max(0, n - 1)) * f.squash;
  };
}

/** One line of lettering with its left end at `u` along the spine, centred on `v` across it. */
function setLine(
  x: CanvasRenderingContext2D,
  f: Face,
  weight: number,
  text: string,
  size: number,
  u: number,
  v: number,
  align: "left" | "right",
  length: number,
): void {
  x.font = fontOf(f, weight, size);
  x.textAlign = "left";
  x.textBaseline = "alphabetic";
  const base = v + size * (f.caps ? 0.36 : 0.3);
  const left = align === "left" ? u : u - length;
  x.save();
  x.translate(left, base);
  x.scale(f.squash, 1);
  if (f.track === 0) {
    x.fillText(text, 0, 0);
  } else {
    let at = 0;
    for (const ch of text) {
      x.fillText(ch, at, 0);
      at += x.measureText(ch).width + f.track * size;
    }
  }
  x.restore();
}

/** The author is never set smaller than this, in CSS pixels (times the pixel ratio on the canvas). */
export const AUTHOR_MIN_CSS_PX = 10;
/** Below this size, in CSS pixels, the author's name is set in a heavier weight so it stays legible. */
export const AUTHOR_HEAVY_BELOW_CSS_PX = 11;
/** The heavier weight: at least semibold (bold on a face with no semibold). */
const HEAVY = 600;

/**
 * The author's name as large as will fit `length`, between `full` and `floor` (`floor` wins over a
 * smaller `full`): the whole name down to 72% of `full` (never under `floor`), else the surname
 * down to `floor`, and at `floor` whatever the surname's length. The name is never set under `floor`.
 */
export function authorLayout(
  name: string,
  measure: Measure,
  p: { length: number; full: number; floor: number },
): { text: string; size: number } {
  const surname = name.trim().split(/\s+/).pop() ?? name;
  const full = Math.max(p.full, p.floor);
  for (const text of name === surname ? [name] : [name, surname]) {
    const lowest = text === name ? Math.max(full * 0.72, p.floor) : p.floor;
    for (let s = full; s >= lowest - 1e-6; s -= full * STEP) {
      const size = Math.max(s, p.floor);
      if (measure(text, size) <= p.length) return { text, size };
    }
  }
  return { text: surname, size: p.floor };
}

/** What `drawSpine` set: the title's and author's font sizes in canvas pixels, and the author's text and weight. */
export type SpineLayout = { titleSize: number; authorSize: number; authorText: string; authorWeight: number };

/**
 * Paints the spine of `book` in `style` and `colours` onto `ctx`, a context of a canvas `size.w` by
 * `size.h` pixels (the spine's own size on screen times `dpr`, the device pixel ratio, default 1).
 * The whole canvas is covered. The title is as large as the style's full size allows; if it does
 * not fit on one line it steps down to 60% of that full size and then wraps to two lines. The
 * author is never under 10 CSS pixels (`AUTHOR_MIN_CSS_PX`, times `dpr`): the surname is used
 * before the name would go smaller, and under 11 CSS pixels it is set heavier. A ground close to
 * the page ground gets a 1 CSS pixel light edge along both long sides (`needsEdge`). Returns what
 * it set.
 */
export function drawSpine(
  ctx: CanvasRenderingContext2D,
  size: SpineSize,
  book: DrawBook,
  style: SpineStyle,
  colours: SpineColours,
  dpr = 1,
): SpineLayout {
  const { w, h } = size;
  const f = FACES[style];
  const hair = Math.max(1, Math.round(w / 36));
  ctx.save();
  ctx.fillStyle = colours.ground;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colours.ink;
  ctx.strokeStyle = colours.accent;
  ctx.lineWidth = hair;
  ctx.lineJoin = "miter";

  // the ornaments stand in the canvas' own frame, then the lettering turns to read top to bottom
  const top = h * f.top;
  const end = h * f.end;
  const run = end - top;
  const rule = (y: number, t = hair) => {
    ctx.fillStyle = colours.accent;
    ctx.fillRect(0, Math.round(y - t / 2), w, t);
  };
  if (style === 0) {
    ctx.fillStyle = colours.accent;
    ctx.fillRect(0, 0, w, h * 0.035);
    ctx.fillRect(0, h * 0.965, w, h * 0.035);
  } else if (style === 1) {
    for (const y of [0.05, 0.925]) {
      rule(h * y, hair * 2);
      rule(h * (y + 0.025), hair);
    }
  } else if (style === 4) {
    ctx.fillStyle = colours.accent;
    ctx.fillRect(Math.round(w * 0.14), 0, hair, h);
    ctx.fillRect(Math.round(w * 0.5 - w * 0.06), Math.round(h * 0.035), Math.round(w * 0.12), Math.round(w * 0.12));
  }

  if (needsEdge(colours.ground)) {
    const e = Math.max(1, Math.round(dpr));
    ctx.fillStyle = EDGE_COLOUR;
    ctx.fillRect(0, 0, e, h);
    ctx.fillRect(w - e, 0, e, h);
  }

  ctx.translate(w / 2, 0);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = colours.ink;
  const caps = (s: string) => (f.caps ? s.toLocaleUpperCase() : s);
  const title = caps(book.title);
  const measureTitle = measurer(ctx, f, f.weight[0]);
  const authorWeight = (size: number) =>
    size < AUTHOR_HEAVY_BELOW_CSS_PX * dpr ? Math.max(f.weight[1], HEAVY) : f.weight[1];
  const measureAuthor = measurer(ctx, f, authorWeight);
  const lay = layoutTitle(title, measureTitle, {
    w,
    length: run * TITLE_SHARE,
    full: f.fill * w,
    floor: MIN_SIZE * w,
  });
  const gap = lay.size * LINE_GAP;
  lay.lines.forEach((line, i) => {
    // the first line is the one on the right as the spine stands, the second to its left
    const v = lay.lines.length === 1 ? 0 : (i === 0 ? -1 : 1) * (gap / 2);
    setLine(ctx, f, f.weight[0], line, lay.size, top, v, "left", measureTitle(line, lay.size));
  });

  const au = authorLayout(caps(book.author), measureAuthor, {
    length: run * AUTHOR_SHARE,
    full: Math.min(w * 0.3, lay.size * 0.62),
    floor: AUTHOR_MIN_CSS_PX * dpr,
  });
  const auLen = measureAuthor(au.text, au.size);
  const auWeight = authorWeight(au.size);
  setLine(ctx, f, auWeight, au.text, au.size, end, 0, "right", auLen);

  // what sets the style apart, drawn in the turned frame
  if (style === 2) {
    // a short rule across the spine, halfway between the title and the author
    const u = top + run * (TITLE_SHARE + (1 - TITLE_SHARE - AUTHOR_SHARE) / 2);
    ctx.fillStyle = colours.accent;
    ctx.fillRect(u - hair / 2, -w * 0.18, hair, w * 0.36);
  } else if (style === 3) {
    const longest = Math.max(...lay.lines.map((l) => measureTitle(l, lay.size)));
    const pad = lay.size * 0.5;
    const across = (lay.lines.length * gap) / 2 + pad * 0.6;
    ctx.strokeStyle = colours.accent;
    ctx.strokeRect(top - pad, -across, longest + 2 * pad, 2 * across);
  }
  ctx.restore();
  return { titleSize: lay.size, authorSize: au.size, authorText: au.text, authorWeight: auWeight };
}

/** The source rectangle that fills a `dw` by `dh` canvas from an `sw` by `sh` picture, cropping the overflow evenly. */
export function coverCrop(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): { sx: number; sy: number; cw: number; ch: number } {
  const want = dw / dh;
  if (sw / sh > want) {
    const cw = sh * want;
    return { sx: (sw - cw) / 2, sy: 0, cw, ch: sh };
  }
  const ch = sw / want;
  return { sx: 0, sy: (sh - ch) / 2, cw: sw, ch };
}

/** Paints a real picture of the spine over the whole canvas (a book whose `spine` is set). */
export function drawSpinePhoto(
  ctx: CanvasRenderingContext2D,
  size: SpineSize,
  img: HTMLImageElement,
): void {
  const { sx, sy, cw, ch } = coverCrop(img.naturalWidth, img.naturalHeight, size.w, size.h);
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, size.w, size.h);
}
