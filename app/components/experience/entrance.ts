// My experience's entrance (round 7 second look, spec 8): the made arrival of the words, the trail tracing itself, each milestone
// as the line reaches it, "now" and its radar, and the way ahead. Pure timings: nothing here touches the page. Times are in
// milliseconds; the words' are counted from the start of the reveal and scaled by its length (the page, use-entrance.ts), the
// trail's from the moment the reveal ends (the engine, entrance-driver.ts).
import { clamp } from "./map-math";

export const ENTRANCE = {
  /** The title starts this share of the reveal's length in. */
  titleAt: 0.7,
  /** A letter's fade and rise, and the gap before the next letter of the title and of the label. */
  letterMs: 300,
  titleGapMs: 28,
  labelGapMs: 22,
  /** After the title starts: its description, the label ("OLYMPUS MONS"), and its lines. */
  descAfterMs: 120,
  labelAfterMs: 240,
  linesAfterMs: 360,
  /** A line's fade and rise, and the gap between lines. */
  lineMs: 400,
  lineGapMs: 60,
  /** The trail draws itself over this long, eased in and out. */
  traceMs: 2200,
  /** A bead fades in and grows from `BEAD_FROM` to 1 over this long. */
  beadMs: 260,
  /** After the trail arrives: the dotted way ahead starts, and takes this long to reach the summit. */
  aheadAfterMs: 100,
  aheadMs: 600,
  /** Under reduced motion: everything fades in together over this long when the reveal ends. */
  reducedMs: 200,
} as const;

/** The size a bead starts from, as a share of its size. */
export const BEAD_FROM = 0.6;
/** How far a letter rises and a line rises while they fade in, in pixels. */
export const LETTER_RISE_PX = 6;
export const LINE_RISE_PX = 8;

/** Ease in and out (cubic) and its inverse: the trail's share of the way against time. */
const easeCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const unease = (s: number): number => (s < 0.5 ? Math.cbrt(s / 4) : 1 - Math.cbrt(2 * (1 - s)) / 2);

/** The share (0 to 1) of the trail drawn `ms` after the trace began: eased in and out, 0 before it begins and 1 from `traceMs` on. */
export function traceShare(ms: number): number {
  return easeCubic(clamp(ms / ENTRANCE.traceMs));
}

/** The ms after the trace began at which its tip reaches a milestone at this share of the trail: the inverse of `traceShare`. */
export function beadDelay(share: number): number {
  return unease(clamp(share)) * ENTRANCE.traceMs;
}

/** The share (0 to 1) of the dotted way ahead drawn `ms` after the trace began (it starts `aheadAfterMs` after the trail arrives). */
export function aheadShare(ms: number): number {
  return clamp((ms - ENTRANCE.traceMs - ENTRANCE.aheadAfterMs) / ENTRANCE.aheadMs);
}

/** After the trace began: when the whole entrance is over (the way ahead has reached the summit). */
export const TRACE_END_MS = ENTRANCE.traceMs + ENTRANCE.aheadAfterMs + ENTRANCE.aheadMs;

/** When each word starts, in ms after the reveal started, for a reveal `T` ms long: the CSS's delays (use-entrance.ts writes `T`, entrance.css reads them). */
export function wordTimes(T: number, lines: number): { title: number; desc: number; label: number; lines: number[] } {
  const title = ENTRANCE.titleAt * T;

  return {
    title,
    desc: title + ENTRANCE.descAfterMs,
    label: title + ENTRANCE.labelAfterMs,
    lines: Array.from({ length: lines }, (_, i) => title + ENTRANCE.linesAfterMs + i * ENTRANCE.lineGapMs),
  };
}

/**
 * The entrance's numbers as the CSS variables the stylesheet reads (entrance.css), so the spec's table is written once. `T` is the reveal's length;
 * `lag` is how long after the reveal began the page's words were told to play (every delay is shortened by it, so a late start does not slide them).
 */
export function entranceVars(T: number, lag: number): Record<string, string> {
  const t = wordTimes(T, 1);
  const ms = (v: number) => `${Math.round(v * 100) / 100}ms`;

  return {
    "--ent-T": ms(T),
    "--ent-lag": ms(Math.max(0, lag)),
    "--ent-title": ms(t.title),
    "--ent-desc": ms(t.desc),
    "--ent-label": ms(t.label),
    "--ent-lines": ms(t.lines[0]),
    "--ent-letter-ms": ms(ENTRANCE.letterMs),
    "--ent-title-gap": ms(ENTRANCE.titleGapMs),
    "--ent-label-gap": ms(ENTRANCE.labelGapMs),
    "--ent-line-ms": ms(ENTRANCE.lineMs),
    "--ent-line-gap": ms(ENTRANCE.lineGapMs),
    "--ent-letter-rise": `${LETTER_RISE_PX}px`,
    "--ent-line-rise": `${LINE_RISE_PX}px`,
    "--ent-reduced-ms": ms(ENTRANCE.reducedMs),
  };
}

/** When the last word has finished, in ms after the reveal started (a title of `titleLetters`, a label of `labelLetters`, `lines` lines). */
export function wordsEnd(T: number, titleLetters: number, labelLetters: number, lines: number): number {
  const t = wordTimes(T, lines);
  const ends = [
    t.title + (Math.max(0, titleLetters - 1)) * ENTRANCE.titleGapMs + ENTRANCE.letterMs,
    t.desc + ENTRANCE.lineMs,
    t.label + Math.max(0, labelLetters - 1) * ENTRANCE.labelGapMs + ENTRANCE.letterMs,
    ...t.lines.map((s) => s + ENTRANCE.lineMs),
  ];

  return Math.max(...ends);
}

/** The whole entrance's length after the reveal started (the trace begins when the reveal ends): when the page may call it done. */
export const entranceEnd = (T: number): number => T + TRACE_END_MS;
