// Where the page's own words and the dock are on the stage (spec 9.6 on phones): the chart's labels keep out of them,
// and thin out where they would collide. Boxes are in the stage's CSS pixels from its top left. The reading of the
// page is the only part that touches the DOM, and it takes the root it reads from, so it is tested with stand-ins.

export type Box = { l: number; t: number; r: number; b: number };

/** The boxes the chart keeps out of: the heading, the caption and the switch, and the dock's glass (null when there is none). */
export type KeepOut = { words: Box[]; dock: Box | null };

export const NO_KEEP_OUT: KeepOut = { words: [], dock: null };

/** Do the two boxes overlap, with `gap` pixels to spare round each? */
export const overlaps = (a: Box, b: Box, gap = 0): boolean => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

/** The dock covers at least this share of the stage's width: then it spans the foot, and the frame's foot sits on top of it. */
export const DOCK_SPANS = 0.55;
/** The space left between the frame's foot and the dock's top, in pixels. */
export const DOCK_GAP = 6;
/** The space kept round the page's words, in pixels. */
export const WORDS_GAP = 6;

/** Where the frame's foot is: the stage's bottom, or just above the dock where the dock spans the stage (a phone, a narrow window). */
export function frameFoot(stage: { w: number; h: number }, keep: KeepOut): number {
  const { dock } = keep;

  if (dock !== null && dock.r - dock.l >= DOCK_SPANS * stage.w) return Math.min(stage.h, dock.t - DOCK_GAP);

  return stage.h;
}

/** A box that wants a place on the stage. One that is `always` there (the readout) is never left out, but the others keep clear of it. */
export type Wanted = { id: string; box: Box; always?: boolean };

/** Is `box` inside `bounds`? */
export const inside = (box: Box, bounds: Box): boolean => box.l >= bounds.l && box.t >= bounds.t && box.r <= bounds.r && box.b <= bounds.b;

/** The space kept round a bead (a milestone is a bead of about 17 px in the overview) and round a point of the trail's line, in pixels. */
export const BEAD_REACH = 14;
export const TRAIL_REACH = 6;
export const reachBox = (x: number, y: number, reach: number): Box => ({ l: x - reach, t: y - reach, r: x + reach, b: y + reach });

/**
 * Of the boxes `wanted` (in order of importance), the ids to leave out: the ones that overlap a kept-out box or a box already
 * placed, or that are not wholly inside `bounds` (the screen). `avoid` are more boxes to keep out of (the beads and the trail's line).
 */
export function leftOut(wanted: readonly Wanted[], keep: KeepOut, bounds: Box, avoid: readonly Box[] = []): Set<string> {
  const gone = new Set<string>();
  const placed: Box[] = [];

  for (const { id, box, always } of wanted) {
    const blocked =
      !always &&
      (!inside(box, bounds) ||
        keep.words.some((w) => overlaps(box, w, WORDS_GAP)) ||
        avoid.some((b) => overlaps(box, b)) ||
        (keep.dock !== null && overlaps(box, keep.dock, DOCK_GAP)) ||
        placed.some((p) => overlaps(box, p, 3)));

    if (blocked) gone.add(id);
    else placed.push(box);
  }

  return gone;
}

type RectLike = { left: number; top: number; right: number; bottom: number; width: number; height: number };
/** The bits of the page that are read: elements with a box, and the root they are found under. */
export type Reader = {
  querySelectorAll(selector: string): ArrayLike<{ getBoundingClientRect(): RectLike }>;
  querySelector(selector: string): { getBoundingClientRect(): RectLike } | null;
};

/** The selectors of the page's words (the heading, the caption and the switch) and of the dock's glass. */
export const WORDS_SELECTOR = ".map-heading, .map-caption, .map-mode";
export const DOCK_SELECTOR = "[data-dock-glass]";

/** The boxes of the words (under `page`) and of the dock (under `doc`), in the stage's pixels (`origin` is the stage's box on the screen). */
export function readKeepOut(page: Reader, doc: Reader, origin: { left: number; top: number }): KeepOut {
  const toStage = (r: RectLike): Box => ({ l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top });
  const real = (r: RectLike) => r.width > 0 && r.height > 0;
  const words = Array.from(page.querySelectorAll(WORDS_SELECTOR), (el) => el.getBoundingClientRect()).filter(real).map(toStage);
  const glass = doc.querySelector(DOCK_SELECTOR)?.getBoundingClientRect();

  return { words, dock: glass !== undefined && real(glass) ? toStage(glass) : null };
}
