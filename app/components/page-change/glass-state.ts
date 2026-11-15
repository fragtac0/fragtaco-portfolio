/**
 * What exists of the glass front's pictures, and the small helpers the making (glass-prepare.ts) and the warm-up (glass-warm.ts) share:
 * the pause between pieces of work, the look at whether a change runs, `performance.mark`.
 */

/** Tiles per row on the sheets. */
export const SHEET_COLS = 7;
/** How long to wait between two pieces of work, and how often to look again while a change runs. */
const GAP_MS = 20;
const CHANGE_POLL_MS = 100;

/**
 * What exists. `sheets`: the three rules' declarations the tick writes (the CSS rules are added once the pictures are made).
 * `bend`: the bend's sheet is in the filters. `vignette`: the screen size (CSS px) the filters' vignette was made for.
 * `warm`: the filters have been run once for this screen's size (`warmGlass`); a change that starts before it runs without the bend.
 */
export const ready: {
  sheets: { mask: CSSStyleDeclaration; glow: CSSStyleDeclaration; shade: CSSStyleDeclaration } | null;
  bend: boolean;
  vignette: { w: number; h: number } | null;
  warm: boolean;
  /** The bend's tiles as picture addresses, in `BEND_TILES` order (data addresses: a picture the browser gets from one is there in the same frame). */
  bendTiles: string[];
  /** The three sheets' picture addresses (the warm-up draws them once too). */
  sheetUrls: { mask: string; glow: string; shade: string } | null;
} = { sheets: null, bend: false, vignette: null, warm: false, bendTiles: [], sheetUrls: null };

export const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
export const changeRunning = () => "changeKind" in document.documentElement.dataset;
/** A pause between two pieces of work, and for as long as a change runs. */
export async function calm() {
  await sleep(GAP_MS);
  while (changeRunning()) await sleep(CHANGE_POLL_MS);
}

export const mark = (name: string) => {
  try {
    performance.mark(name);
  } catch {
    /* no marks */
  }
};
