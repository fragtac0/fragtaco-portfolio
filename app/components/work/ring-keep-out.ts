// The keep-out round the dock (R54.2b, R117): the video rings fade out in a tight, feathered rounded rectangle round the dock's
// glass, so no tile shows under the dock's tabs and the rest of the screen keeps its tiles. Pure: no DOM, safe on the server.
//
// The CSS mask on the long and short ring groups (work.css) is two linear gradients added together: one across (clear from
// `l` to `r`, solid `f` pixels beyond each) and one down (clear from `t` to the screen's foot, solid `f` above). Where the
// two overlap the hidden share is the product of the two (so the corners are rounded). The mask's alpha is `1 - across * down`,
// and because that is separable a tile's visible area is exact and cheap (`visibleArea`), which is what `coverage` counts.

/** A box on the screen, in pixels from its top left. */
export type Rect = { l: number; t: number; r: number; b: number };

/** The keep-out: clear (hidden) from `l` to `r` across and from `t` down, with a feather of `f` pixels beyond that. */
export interface KeepOut {
  l: number;
  r: number;
  t: number;
  f: number;
}

/**
 * Pixels the hidden part reaches beyond the dock's glass on the sides and above, and the feather's width beyond that. Tight on
 * purpose (R117): the glass hides what is under it, so only a short fade is needed at its edge, and every pixel more costs the
 * small phones, whose dock spans the screen, visible tile area (R118: 0.976 of today's at 320 by 568 with these, 0.93 with 8 and 28).
 */
export const KEEP_MARGIN = 0;
export const KEEP_FEATHER = 8;
/** A measured dock is rounded outward to this many pixels, so a sub-pixel change never re-plans the rings. */
export const DOCK_STEP = 4;

/**
 * The dock's glass as the audit measured it on /work with the switcher row open: 448 by 113 px, 24 px above the screen's foot
 * (350 by 93 px, 12 up, under 640 px wide). Only what the plan assumes until the page has measured the real glass
 * (`use-dock-box.ts`); the mask itself always follows the measured box.
 */
export function nominalDock(vw: number, vh: number): Rect {
  const small = vw < 640;
  const width = small ? Math.min(350, vw - 20) : 448;
  const height = small ? 93 : 113;
  const foot = small ? 12 : 24;
  return settleDock({ l: (vw - width) / 2, r: (vw + width) / 2, t: vh - foot - height, b: vh - foot });
}

/** A measured box rounded outward to `DOCK_STEP` pixels (the dock's glass is never made smaller by it). */
export function settleDock(box: Rect): Rect {
  const down = (n: number) => Math.floor(n / DOCK_STEP) * DOCK_STEP;
  const up = (n: number) => Math.ceil(n / DOCK_STEP) * DOCK_STEP;
  return { l: down(box.l), t: down(box.t), r: up(box.r), b: up(box.b) };
}

export function sameRect(a: Rect | null, b: Rect | null): boolean {
  return a === b || (a !== null && b !== null && a.l === b.l && a.t === b.t && a.r === b.r && a.b === b.b);
}

/** The keep-out for a dock: its glass and `KEEP_MARGIN` beyond it, hidden down to the screen's foot. */
export function keepOutFor(dock: Rect, margin = KEEP_MARGIN, feather = KEEP_FEATHER): KeepOut {
  return { l: dock.l - margin, r: dock.r + margin, t: dock.t - margin, f: feather };
}

/** The CSS custom properties work.css reads (on `.work-rings`). */
export function keepOutVars(k: KeepOut): Record<"--keep-l" | "--keep-r" | "--keep-t" | "--keep-f", string> {
  return { "--keep-l": `${k.l}px`, "--keep-r": `${k.r}px`, "--keep-t": `${k.t}px`, "--keep-f": `${k.f}px` };
}

/** How hidden a point is across the screen: 1 from `l` to `r`, falling to 0 over `f` pixels beyond each. */
const across = (k: KeepOut, x: number) => Math.min(1, Math.max(0, Math.min(x - (k.l - k.f), k.r + k.f - x) / k.f));
/** How hidden a point is down the screen: 1 from `t` down, 0 from `f` pixels above it. */
const down = (k: KeepOut, y: number) => Math.min(1, Math.max(0, (y - (k.t - k.f)) / k.f));

/** The mask's alpha at a point of the screen: 1 where a tile shows in full, 0 where it is hidden (the CSS gradients' mirror). */
export function maskAlpha(k: KeepOut, x: number, y: number): number {
  return 1 - across(k, x) * down(k, y);
}

/** The integral of `across` from `-infinity` to x. */
function acrossSum(k: KeepOut, x: number): number {
  const { l, r, f } = k;
  if (x <= l - f) return 0;
  if (x <= l) return (x - (l - f)) ** 2 / (2 * f);
  if (x <= r) return f / 2 + (x - l);
  if (x <= r + f) return f / 2 + (r - l) + f / 2 - (r + f - x) ** 2 / (2 * f);
  return f + (r - l);
}

/** The integral of `down` from `-infinity` to y. */
function downSum(k: KeepOut, y: number): number {
  const { t, f } = k;
  if (y <= t - f) return 0;
  if (y <= t) return (y - (t - f)) ** 2 / (2 * f);
  return f / 2 + (y - t);
}

/** The area of the box [x0, x1] by [y0, y1] that shows through the mask (the box is already clipped to the screen). */
export function visibleArea(k: KeepOut, x0: number, x1: number, y0: number, y1: number): number {
  if (!(x1 > x0) || !(y1 > y0)) return 0;
  return (x1 - x0) * (y1 - y0) - (acrossSum(k, x1) - acrossSum(k, x0)) * (downSum(k, y1) - downSum(k, y0));
}
