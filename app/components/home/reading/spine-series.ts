import { spineColours, type SpineColours } from "./spine-styles";

/**
 * The spine series (round 7 spec 8.2): fourteen designs, one per book, drawn as one family. Each has a
 * cloth colour, one foil ink, a small emblem for what the book is about, the way its title is set, and
 * the shared ring mark at the foot (spine-paint.ts). Pure data and parsing, no canvas. A book without
 * an entry gets the series' plain style from its cover's colours (`plainSeries`). The sizes in `font`
 * are the series' own drawing units (a spine 32 to 72 units wide), scaled to the spine on screen.
 */

export type EmblemId =
  | "none"
  | "blink"
  | "hourglass"
  | "film"
  | "splice"
  | "arc"
  | "cat"
  | "dot"
  | "cut"
  | "share"
  | "eye"
  | "panels"
  | "aa"
  | "grid"
  | "handle";

export type SeriesDesign = {
  /** The cloth the spine is bound in. */
  cloth: string;
  /** The one foil ink: emblem, title, author, rules and the mark at the foot. */
  foil: string;
  emblem: EmblemId;
  /** The title's face as a CSS font shorthand in drawing units, e.g. `italic 500 19px "Bodoni Moda"`. */
  font: string;
  /** Width of the face as a percentage (`"62%"`, `"125%"`), for a face with a width axis. */
  stretch?: string;
  upper?: boolean;
  lower?: boolean;
  /** Letter spacing in em, as CSS (`"0.2em"`). */
  track?: string;
  /** The title set on these lines instead of on one. */
  lines?: string[];
  /** A pair of rules under the emblem and above the author. */
  rules?: boolean;
  /** The emblem on a block of colour across the top of the spine, with its own ink. */
  block?: { fill: string; ink: string };
  /** The emblem's size in drawing units (default 20). */
  emSize?: number;
};

export const SERIES: Record<string, SeriesDesign> = {
  "in-the-blink-of-an-eye": { cloth: "#e9e1cf", foil: "#1c1a17", emblem: "blink", font: 'italic 500 19px "Bodoni Moda"' },
  "sculpting-in-time": { cloth: "#23343c", foil: "#cdd6d8", emblem: "hourglass", font: '600 16px "Archivo"', stretch: "62%", upper: true, track: "0.2em", rules: true },
  "making-movies": { cloth: "#cf3f1e", foil: "#f7ecd6", emblem: "film", font: '900 19px "Archivo"', stretch: "125%", upper: true, track: "0.02em" },
  "on-film-editing": { cloth: "#161514", foil: "#d7b26c", emblem: "splice", font: '400 19px "Young Serif"', rules: true },
  story: { cloth: "#1e3b2d", foil: "#dcbb78", emblem: "arc", font: '800 46px "Bodoni Moda"', upper: true, track: "0.1em", emSize: 30 },
  "save-the-cat": { cloth: "#d69c22", foil: "#1a1714", emblem: "cat", font: '700 16px "Unbounded"' },
  "the-creative-act": { cloth: "#cdc7ba", foil: "#1a1917", emblem: "dot", font: '400 24px "Space Grotesk"', track: "0.01em", emSize: 34 },
  "steal-like-an-artist": { cloth: "#121212", foil: "#f4f1e8", emblem: "cut", font: '600 13px "IBM Plex Mono"', upper: true, track: "0.08em" },
  "show-your-work": { cloth: "#f0bf2e", foil: "#141414", emblem: "share", font: '600 15px "IBM Plex Mono"', upper: true, track: "0.06em" },
  "ways-of-seeing": { cloth: "#2944a6", foil: "#f3ead6", emblem: "eye", font: '600 21px "Newsreader"' },
  "understanding-comics": { cloth: "#a8c3d2", foil: "#15223e", emblem: "panels", font: '800 19px "Archivo"', stretch: "90%", rules: true },
  "thinking-with-type": { cloth: "#efe7d6", foil: "#d23a1c", emblem: "aa", font: '600 22px "Bodoni Moda"', lower: true, emSize: 30 },
  "grid-systems-in-graphic-design": { cloth: "#f1eee6", foil: "#161616", emblem: "grid", font: '500 14px "Archivo"', lines: ["Grid Systems in", "Graphic Design"], block: { fill: "#d5311b", ink: "#ffffff" } },
  "the-design-of-everyday-things": { cloth: "#1f5c5e", foil: "#f1e6cf", emblem: "handle", font: '600 18px "Space Grotesk"', lines: ["The Design of", "Everyday Things"] },
};

/** The author's face and size, the same on every spine. */
export const AUTHOR_FONT = { weight: 500, size: 10, family: "IBM Plex Mono", track: 0.06 } as const;

/** What a book needs of its entry: its id and, for a book that names another design, `series`. */
type SeriesKey = { id: string; series?: string };

/** True for a book that has a designed spine of its own. */
export const hasSeries = (book: SeriesKey): boolean => (book.series ?? book.id) in SERIES;

/** The plain style of the series for a book with no entry: the cover's ground as cloth, its ink as foil. */
export function plainSeries(colours: SpineColours): SeriesDesign {
  return {
    cloth: colours.ground,
    foil: colours.ink,
    emblem: "none",
    font: '600 20px "Newsreader"',
    rules: true,
  };
}

/** The design a book wears: its entry in the series, or the plain style from `colours`. */
export function designFor(book: SeriesKey, colours: SpineColours): SeriesDesign {
  return SERIES[book.series ?? book.id] ?? plainSeries(colours);
}

/**
 * What a book is bound in, for every face of it that is not the spine (its generated cover, boards,
 * page edges, and the plain grid): the series' cloth and foil, so all faces of a book agree with its
 * spine (R90). A book with no entry gets the plain style from its own colour.
 */
export function bookLook(book: SeriesKey & { color: string }): { cloth: string; foil: string } {
  const { cloth, foil } = designFor(book, spineColours({ dominant: book.color, secondary: book.color }));
  return { cloth, foil };
}

export type ParsedFont = { italic: boolean; weight: number; size: number; family: string };

/** A series font shorthand taken apart. A shorthand that does not parse (never one of ours) gives a plain serif. */
export function parseFont(font: string): ParsedFont {
  const m = /^(italic )?(\d{3}) ([\d.]+)px "([^"]+)"$/.exec(font);
  if (!m) return { italic: false, weight: 500, size: 16, family: "Newsreader" };
  return { italic: !!m[1], weight: Number(m[2]), size: Number(m[3]), family: m[4] };
}

/** `"62%"` as 62 (the face's width axis), 100 when none is given. */
export const stretchOf = (design: SeriesDesign): number =>
  design.stretch ? parseFloat(design.stretch) : 100;

/** `"0.2em"` as 0.2. */
export const trackOf = (design: SeriesDesign): number => (design.track ? parseFloat(design.track) : 0);

const FALLBACK: Record<string, string> = {
  "Bodoni Moda": "serif",
  "Young Serif": "serif",
  Newsreader: "serif",
  Archivo: "sans-serif",
  Unbounded: "sans-serif",
  "Space Grotesk": "sans-serif",
  "IBM Plex Mono": "monospace",
};

/** The family list for a face, with a generic fallback of the same kind. */
export const familyList = (family: string): string => `"${family}", ${FALLBACK[family] ?? "serif"}`;

/** The text of the title as the design sets it (case applied). */
export function titleText(book: { title: string }, design: SeriesDesign): string[] {
  const lines = design.lines ?? [book.title];
  const set = (s: string) => (design.upper ? s.toLocaleUpperCase() : design.lower ? s.toLocaleLowerCase() : s);
  return lines.map(set);
}

/** The faces a design needs loaded before it is painted: title, author, and the emblem's letters. */
export function seriesFaces(design: SeriesDesign): string[] {
  const t = parseFont(design.font);
  const faces = [
    `${t.italic ? "italic " : ""}${t.weight} ${t.size}px "${t.family}"`,
    `${AUTHOR_FONT.weight} ${AUTHOR_FONT.size}px "${AUTHOR_FONT.family}"`,
  ];
  if (design.emblem === "aa") faces.push('600 17px "Bodoni Moda"');
  return faces;
}
