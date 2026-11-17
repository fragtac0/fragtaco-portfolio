/**
 * The geometry behind the glass front's pictures (follow-ups spec 4): the distance field the edge is cut from, and the plan of
 * the picture tiles that stand for it.
 *
 * The tenth preview cuts the new page out of the old with `smoothstep(-1, 1, (D - front) / band)`, where `D` is the distance from
 * the middle plus a slow noise, so the edge wanders, and `band` is the same width in pixels at every moment. A picture stretched
 * to follow the front cannot do that (its band would grow with it), so the front is drawn from a short series of picture tiles,
 * one for each of a ladder of front radii (`TILES`): each tile is the whole field cut at its own radius, and the tile nearest the
 * front is scaled by at most 4% to put the edge exactly where the front is (`pickTile`), so the band stays within 4% of its width
 * and the edge moves smoothly. Because a tile is made for its own moment, the shape can change over the change for free: the
 * lobes turn about 25 degrees (`TURN`) from the first tile to the last, so it never reads as one stamp growing.
 *
 * Fronts smaller than `HAND_OVER` are drawn by plain gradients in glass.css (a circle with the same band): at that size the new
 * page is a soft blob in the middle, and no ladder of tiles can move an edge that small smoothly.
 *
 * Every length is in farthest-corner distances, so a tile fits every screen: it covers `HALF` of them each side of the middle.
 */
import { FRONT_CLEAR, FRONT_START, GLASS, SPAN, WARP } from "./glass-math";

/** The front's radius from which the tiles are used; below it glass.css's gradients draw the front. */
export const HAND_OVER = 0.2;
/** The ratio between the radii of two neighbouring tiles. */
export const TILE_RATIO = 1.08;
/** The last tile is the first one at or beyond this radius (the front is past the corner, the whole screen is the new page). */
export const TILE_TOP = 1.55;
/** A tile covers this far each side of the middle (the whole screen is within 1). */
export const HALF = 1.12;
/** The lobes turn this far over the whole change. */
export const TURN = (25 * Math.PI) / 180;

const build = (): number[] => {
  const out: number[] = [];
  for (let r = HAND_OVER; ; r *= TILE_RATIO) {
    out.push(r);
    if (r >= TILE_TOP) break;
  }
  return out;
};
/** The front's radius for each tile. */
export const TILES: readonly number[] = build();

/** The eased progress at which the front's middle is at `radius` (the inverse of `frontAt`'s radius). */
export const progressFor = (radius: number) => Math.min(1, Math.max(0, (radius - FRONT_START) / SPAN));
/**
 * How far the lobes have turned when the front's middle is at `radius`: nothing at `HAND_OVER`, `TURN` once the front has
 * cleared the screen, most of it early. The wander's size in pixels grows with the front (12% of its radius), so a turn spread
 * evenly would show as a step of 10 px or more each time the front moves on to the next tile near the end; with the turn in
 * proportion to 1/radius the step is a few px at every size, and the shape still changes.
 */
export const turnFor = (radius: number) => {
  const top = 1 / HAND_OVER - 1 / FRONT_CLEAR;
  return TURN * Math.min(1, Math.max(0, (1 / HAND_OVER - 1 / Math.max(radius, 1e-6)) / top));
};

/**
 * The bend's ladder of front radii: every tile of `TILES` from `HAND_OVER` up (steps of 4% at most; the lens needed every other one).
 * R58 and R129: a bend tile holds only the push's strength, a smooth profile along the front; the hero's noise is in the vignette's
 * picture (glass-vignette.ts), fixed on the screen, so nothing slides when the tile changes and the scaled tile moves only the band's
 * edge. Below `HAND_OVER` the bend is already strong while the front is only a small blob (the hero's liquid starts from the middle),
 * and a tile cannot be shrunk onto a front that small, so there is a tile every `BEND_EARLY_STEP` of a farthest-corner distance from
 * before the front has left the middle: nearest wins, never more than half a step from the front, and the band jumps by one step at
 * a swap, so the step is small (0.025, was 0.05: the swaps of the early tiles were over 1.5 times the control's). Step 7 of the plan
 * measures the step at every swap (`docs/redesign/compare/round7/r58-tile-swaps.json`).
 */
export const BEND_EARLY_STEP = 0.025;
const BEND_FIRST = -0.25;
const earlyBend = (): number[] => {
  const out: number[] = [];
  for (let r = BEND_FIRST; r < HAND_OVER - 1e-9; r += BEND_EARLY_STEP) out.push(+r.toFixed(6));
  return out;
};
export const BEND_EARLY: readonly number[] = earlyBend();
export const BEND_TILES: readonly number[] = [...BEND_EARLY, ...TILES];

/** The bend's tile (its index into `BEND_TILES`) for a front at `radius` and the scale that puts its edge there (within 4% of 1 from `HAND_OVER` on). */
export function pickBendTile(radius: number): { index: number; scale: number } {
  if (radius < HAND_OVER) {
    const index = Math.min(BEND_EARLY.length - 1, Math.max(0, Math.round((radius - BEND_FIRST) / BEND_EARLY_STEP)));
    return { index, scale: 1 };
  }
  const n = BEND_EARLY.length;
  const k = Math.min(TILES.length - 1, Math.max(0, Math.round(Math.log(radius / HAND_OVER) / Math.log(TILE_RATIO))));
  return { index: n + k, scale: radius / BEND_TILES[n + k] };
}

/** The tile for a front at `radius` and the scale (about the middle) that puts its edge there; null where gradients draw it. */
export function pickTile(radius: number): { index: number; scale: number } | null {
  if (!(radius >= HAND_OVER)) return null;
  const index = Math.min(TILES.length - 1, Math.max(0, Math.round(Math.log(radius / HAND_OVER) / Math.log(TILE_RATIO))));
  return { index, scale: radius / TILES[index] };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The wander at angle `theta`, from -1 to 1: a five-lobed and a six-lobed wave turning at their own rates and beating against
 * each other (so the front has five or six lobes, never a regular flower); `turn` (radians) is how far the whole pattern has turned.
 */
export function wander(theta: number, turn: number): number {
  return 0.56 * Math.cos(5 * (theta - turn) + 0.7) + 0.44 * Math.cos(6 * (theta + 0.7 * turn) + 2.1);
}

/** Near the middle the wander grows from nothing, so the field has no cone point and a small blob is round. */
const taper = (rho: number) => smooth(0.1, 0.6, rho);

/**
 * How far the edge wanders from a circle at its largest, when the front is at `front`, in farthest-corner distances (R111): `WARP`
 * (12%) of the front's own radius, tapered while the front is small (a small blob is round, and it meets the gradients that draw
 * fronts under `HAND_OVER`).
 */
export const wanderAmp = (front: number) => WARP * Math.max(0, front) * taper(front);

/**
 * The distance field at (`u`, `v`) (farthest-corner distances from the middle, v down) for a front at `front`: the distance,
 * moved by up to 12% of the front's radius by the wander (tapered near the middle).
 */
export function fieldAt(u: number, v: number, turn: number, front: number): number {
  const rho = Math.hypot(u, v);
  return rho + WARP * Math.max(0, front) * taper(rho) * wander(Math.atan2(v, u), turn);
}

/** The new page's share at `x` half-bands behind the front (the preview's `1 - smoothstep(-1, 1, x)`): 1 well inside, 0 well outside. */
export function newShare(x: number): number {
  const t = Math.min(1, Math.max(0, (x + 1) / 2));
  return 1 - t * t * (3 - 2 * t);
}

/** `x` for a point: how many half-bands it is outside a front of radius `front` (negative inside), `turn` of the way turned. */
export const halfBands = (u: number, v: number, front: number, turn: number) => (fieldAt(u, v, turn, front) - front) / GLASS.band;

/** A sheet of `count` tiles in `cols` columns: its size in tiles. */
export function sheetLayout(count: number, cols: number): { cols: number; rows: number } {
  return { cols, rows: Math.ceil(count / cols) };
}
/** Where tile `index` is on a sheet of `cols` columns: its column and row. */
export const tileCell = (index: number, cols: number) => ({ col: index % cols, row: Math.floor(index / cols) });

/**
 * Visits the pixels of an `n` by `n` tile made for a front of radius `front` (its lobes turned by `turnFor(front)`): the
 * pixel's index into an RGBA array, its place (`u`, `v`, farthest-corner distances from the middle, v down) and how many
 * half-bands it is outside the front (`x`).
 */
export function eachTilePixel(
  n: number,
  front: number,
  visit: (i: number, x: number, u: number, v: number) => void,
  within = Infinity,
): void {
  const turn = turnFor(front);
  const reach = within * GLASS.band + WARP * Math.max(0, front);
  for (let py = 0; py < n; py++) {
    const v = (((py + 0.5) / n) * 2 - 1) * HALF;
    for (let px = 0; px < n; px++) {
      const u = (((px + 0.5) / n) * 2 - 1) * HALF;
      // a pixel further from the front than the wander and `within` half-bands can be is not visited (cheaper than finding `x`)
      if (Math.abs(Math.hypot(u, v) - front) > reach) continue;
      visit((py * n + px) * 4, halfBands(u, v, front, turn), u, v);
    }
  }
}
