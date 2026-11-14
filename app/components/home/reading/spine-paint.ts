import type { SiteBook } from "~/types";
import { clothGrain, shade } from "./spine-cloth";
import { drawEmblem } from "./spine-emblems";
import {
  AUTHOR_FONT,
  familyList,
  parseFont,
  stretchOf,
  titleText,
  trackOf,
  type ParsedFont,
  type SeriesDesign,
} from "./spine-series";
import { EDGE_COLOUR, needsEdge } from "./spine-styles";

/**
 * Paints a spine of the series (round 7 spec 8.2) onto a 2D canvas: cloth with its grain and the
 * rounded shading, the emblem at the head, the title down the spine, the author, and the shared ring
 * mark at the foot. The design is laid out in the series' own drawing units (a spine 32 to 72 units
 * wide, as in the round 7 preview) and the whole drawing is scaled by `u`, the canvas width over the
 * drawing width of that book, so the type grows and shrinks with the spine's width and the same
 * painter serves the 3D shelf and the small shelf on the home page. The lettering reads top to
 * bottom. Client only (a canvas context); `planSpine` is pure and tested.
 */

export type PaintBook = Pick<SiteBook, "title" | "author" | "pages">;

export type PaintOptions = {
  /** The device pixel ratio the canvas is made for (default 1): the hairline edge follows it. */
  dpr?: number;
  /** The author is never set under this many CSS pixels (default 10; the small shelf asks for less). */
  authorMinCss?: number;
};

/** Default author floor in CSS pixels. */
export const AUTHOR_MIN_CSS_PX = 10;

/** How wide the series draws a book's spine, in drawing units: from its pages, 32 to 72. */
export const drawingWidth = (pages: number): number =>
  Math.round(Math.max(32, Math.min(72, pages * 0.105 + 20)));

// the series' fixed measures, in drawing units
const HEAD = 16; // above the emblem
const GAP_RULE = 12; // between a rule pair and the emblem or the mark
const MARK = 13; // the ring mark's size
const MARK_FOOT = 14; // under the mark
const AUTHOR_FOOT = 12; // under the author
const TITLE_PAD = 8; // the title keeps this far from what is above and below it
/** The share of the spine's width the title's lines may take across. */
const ACROSS = 0.92;
/** The author takes at most this share of the spine's length (unless the floor forces more). */
const AUTHOR_SHARE = 0.42;

export type Measure = (text: string, size: number) => number;

export type SpinePlan = {
  /** Drawing units to canvas pixels. */
  u: number;
  /** The spine's size in drawing units. */
  vw: number;
  vh: number;
  block: { h: number } | null;
  emblem: { x: number; y: number; size: number } | null;
  rules: { y: number; h: number; a: number }[];
  mark: { cx: number; cy: number };
  title: { lines: string[]; size: number; lineHeight: number; centre: number; length: number };
  author: { text: string; size: number; top: number };
};

const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * The layout of a spine `w` by `h` canvas pixels, in drawing units. `title` and `author` measure a
 * string's length along the spine at a font size in drawing units (the two faces differ). Pure.
 */
export function planSpine(
  book: PaintBook,
  design: SeriesDesign,
  w: number,
  h: number,
  m: { title: Measure; author: Measure },
  opts: PaintOptions = {},
): SpinePlan {
  const dw = drawingWidth(book.pages);
  const u = w / dw;
  const vw = dw;
  const vh = h / u;
  const dpr = opts.dpr ?? 1;
  const authorMin = ((opts.authorMinCss ?? AUTHOR_MIN_CSS_PX) * dpr) / u;

  // from the head down: the emblem (on its block, or alone), then a pair of rules
  const em = design.emSize ?? 20;
  let top = HEAD;
  let block: SpinePlan["block"] = null;
  let emblem: SpinePlan["emblem"] = null;
  if (design.block) {
    block = { h: vw + 14 };
    emblem = { x: (vw - em) / 2, y: (block.h - em) / 2, size: em };
    top = block.h;
  } else if (design.emblem !== "none") {
    emblem = { x: (vw - em) / 2, y: HEAD, size: em };
    top = HEAD + em;
  }
  const rules: SpinePlan["rules"] = [];
  if (design.rules) {
    rules.push({ y: top + GAP_RULE, h: 2, a: 0.9 }, { y: top + GAP_RULE + 5, h: 1, a: 0.6 });
    top += GAP_RULE + 6;
  }

  // from the foot up: the ring mark, then a pair of rules
  const mark = { cx: vw / 2, cy: vh - MARK_FOOT - MARK / 2 };
  let foot = vh - MARK_FOOT - MARK;
  if (design.rules) {
    rules.push({ y: foot - GAP_RULE - 2, h: 2, a: 0.9 }, { y: foot - GAP_RULE - 5 - 1, h: 1, a: 0.6 });
    foot -= GAP_RULE + 6;
  }

  // the author, as large as the series sets it unless the floor says more: the whole name, else the surname
  const authorText = book.author.toLocaleUpperCase();
  const surname = authorText.trim().split(/\s+/).pop() ?? authorText;
  const cap = Math.max(0, foot - AUTHOR_FOOT - top) * AUTHOR_SHARE;
  const size0 = Math.max(AUTHOR_FONT.size, authorMin);
  let author = { text: authorText, size: size0 };
  if (m.author(authorText, size0) > cap) {
    let s = size0;
    while (s > authorMin + 1e-6 && m.author(authorText, s) > cap) s = Math.max(authorMin, s - 0.4);
    author = { text: authorText, size: s };
    if (m.author(authorText, s) > cap && surname !== authorText) author = { text: surname, size: s };
  }
  const authorTop = foot - AUTHOR_FOOT - m.author(author.text, author.size);

  // the title, centred in what is left, shrunk until it fits along and across the spine
  const lines = titleText(book, design);
  const f = parseFont(design.font);
  const lineHeight = design.lines ? 1.15 : 1;
  const room = Math.max(8, authorTop - top - 2 * TITLE_PAD);
  const longest = (s: number) => Math.max(...lines.map((l) => m.title(l, s)));
  const along = room / Math.max(1, longest(f.size));
  const across = (ACROSS * vw) / (lines.length * lineHeight * f.size);
  const size = f.size * clampN(Math.min(1, along, across), 0.05, 1);
  return {
    u,
    vw,
    vh,
    block,
    emblem,
    rules,
    mark,
    title: { lines, size, lineHeight, centre: (top + authorTop) / 2, length: longest(size) },
    author: { text: author.text, size: author.size, top: authorTop },
  };
}

/** What a paint set, in canvas pixels: the title's and the author's font sizes and the author's text. */
export type SpineLayout = { titleSize: number; authorSize: number; authorText: string; lines: string[] };

// ---- type

const STRETCH_KEYWORDS: [number, string][] = [
  [50, "ultra-condensed"],
  [62.5, "extra-condensed"],
  [75, "condensed"],
  [87.5, "semi-condensed"],
  [100, "normal"],
  [112.5, "semi-expanded"],
  [125, "expanded"],
  [150, "extra-expanded"],
  [200, "ultra-expanded"],
];
const stretchKeyword = (pct: number): string =>
  STRETCH_KEYWORDS.reduce((a, b) => (Math.abs(b[0] - pct) < Math.abs(a[0] - pct) ? b : a))[1];

type Face = { f: ParsedFont; stretch: number; track: number; squash: number };

/** Sets the context's font for `face` at `size`; a context with no `fontStretch` squeezes the letters instead. */
function setFace(ctx: CanvasRenderingContext2D, face: Face, size: number, weight = face.f.weight): void {
  ctx.font = `${face.f.italic ? "italic " : ""}${weight} ${size.toFixed(2)}px ${familyList(face.f.family)}`;
  if (face.stretch !== 100 && "fontStretch" in ctx) {
    (ctx as unknown as { fontStretch: string }).fontStretch = stretchKeyword(face.stretch);
  }
}

const faceOf = (ctx: CanvasRenderingContext2D, d: SeriesDesign): Face => {
  const stretch = stretchOf(d);
  return {
    f: parseFont(d.font),
    stretch,
    track: trackOf(d),
    squash: stretch !== 100 && !("fontStretch" in ctx) ? stretch / 100 : 1,
  };
};

const authorFace: Face = {
  f: { italic: false, weight: AUTHOR_FONT.weight, size: AUTHOR_FONT.size, family: AUTHOR_FONT.family },
  stretch: 100,
  track: AUTHOR_FONT.track,
  squash: 1,
};

function measurer(ctx: CanvasRenderingContext2D, face: Face): Measure {
  return (text, size) => {
    setFace(ctx, face, size);
    const n = [...text].length;
    return (ctx.measureText(text).width + face.track * size * Math.max(0, n - 1)) * face.squash;
  };
}

/** One line of lettering, its left end at (0, 0) of the turned frame, centred on the line across. */
function setLine(ctx: CanvasRenderingContext2D, face: Face, text: string, size: number, x: number, y: number): void {
  setFace(ctx, face, size);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(x, y);
  if (face.squash !== 1) ctx.scale(face.squash, 1);
  if (face.track === 0) {
    ctx.fillText(text, 0, 0);
  } else {
    let at = 0;
    for (const ch of text) {
      ctx.fillText(ch, at, 0);
      at += ctx.measureText(ch).width + face.track * size;
    }
  }
  ctx.restore();
}

/**
 * Paints the spine of `book` in `design` onto `ctx`, a context of a canvas `w` by `h` pixels (the
 * spine on screen times the pixel ratio). Covers the whole canvas. Returns what it set.
 */
export function paintSpine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  book: PaintBook,
  design: SeriesDesign,
  opts: PaintOptions = {},
): SpineLayout {
  const face = faceOf(ctx, design);
  ctx.save();
  const plan = planSpine(book, design, w, h, { title: measurer(ctx, face), author: measurer(ctx, authorFace) }, opts);
  const { u, vw, vh } = plan;

  // cloth and its grain are laid in canvas pixels, the rest in drawing units
  ctx.fillStyle = design.cloth;
  ctx.fillRect(0, 0, w, h);
  const tile = clothGrain();
  const pattern = tile ? ctx.createPattern(tile, "repeat") : null;
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.scale(u, u);
  shade(ctx, vw, vh);
  if (needsEdge(design.cloth)) {
    const e = Math.max(1, Math.round(opts.dpr ?? 1)) / u;
    ctx.fillStyle = EDGE_COLOUR;
    ctx.fillRect(0, 0, e, vh);
    ctx.fillRect(vw - e, 0, e, vh);
  }

  ctx.fillStyle = design.foil;
  if (plan.block && design.block) {
    ctx.fillStyle = design.block.fill;
    ctx.fillRect(0, 0, vw, plan.block.h);
  }
  if (plan.emblem) {
    const ink = design.block?.ink ?? design.foil;
    drawEmblem(ctx, design.emblem, plan.emblem.x, plan.emblem.y, plan.emblem.size, ink);
  }
  ctx.fillStyle = design.foil;
  for (const r of plan.rules) {
    ctx.globalAlpha = r.a;
    ctx.fillRect(0, r.y, vw, r.h);
  }

  // the ring mark at the foot
  ctx.globalAlpha = 1;
  ctx.strokeStyle = design.foil;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(plan.mark.cx, plan.mark.cy, MARK / 2 - 0.75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(plan.mark.cx, plan.mark.cy, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // the lettering turns to read from the head to the foot: the first line is the one on the right
  const t = plan.title;
  ctx.fillStyle = design.foil;
  ctx.save();
  ctx.translate(vw / 2, 0);
  ctx.rotate(Math.PI / 2);
  t.lines.forEach((line, i) => {
    const across = t.lines.length === 1 ? 0 : (i === 0 ? -1 : 1) * ((t.lineHeight * t.size) / 2);
    const len = measurer(ctx, face)(line, t.size);
    setLine(ctx, face, line, t.size, t.centre - len / 2, across);
  });
  ctx.globalAlpha = 0.92;
  setLine(ctx, authorFace, plan.author.text, plan.author.size, plan.author.top, 0);
  ctx.restore();
  ctx.restore();
  return {
    titleSize: t.size * u,
    authorSize: plan.author.size * u,
    authorText: plan.author.text,
    lines: t.lines,
  };
}
