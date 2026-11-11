import { PLANE, arrival, planeOf } from "./wall-math";

/**
 * How a tile looks from where it sits: its depth plane, the focus effect and the channel echo,
 * combined into one size, brightness and softness; the order tiles are drawn in; when a freshly
 * loaded thumbnail arrives; and the chip's second line. Pure, so each rule is tested on its own.
 */

type PlaneName = "near" | "far";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The column index in a tile key (`"3,-2"` is column 3). */
export const colOfKey = (key: string): number => Number.parseInt(key, 10);

/** The depth plane of the column a tile key names. */
export const planeOfKey = (key: string): PlaneName => planeOf(colOfKey(key));

/** Focus dims the rest of the wall by this much, and softens it by this mipmap bias. */
const FOCUS_DIM = 0.16;
const FOCUS_BIAS = 1.35;

export type TileLook = { scale: number; dim: number; bias: number };

/**
 * Size, brightness and mipmap bias of a tile. A far tile is smaller, dimmer and softer, but a
 * focused one (`f` is its hover weight) comes forward to full size, full brightness and a sharp
 * lookup, whatever its plane. `lens` is how strongly something is in focus; the rest of the wall dims
 * and softens by it, except the tiles of the focused video's channel (`e`, the echo weight), which
 * keep their brightness and sharpness. A far echo tile keeps its plane's dimness: depth stays readable.
 */
export function tileLook(p: { plane: PlaneName; f: number; lens: number; e: number }): TileLook {
  const { plane, f, lens, e } = p;
  const pl = PLANE[plane];
  const rest = lens * (1 - f) * (1 - e);
  return {
    scale: lerp(pl.scale, 1, f),
    dim: lerp(pl.dim, 1, f) * (1 - FOCUS_DIM * rest),
    bias: lerp(pl.bias, 0, f) + FOCUS_BIAS * rest,
  };
}

/**
 * Where a tile sorts in the draw: far tiles first, near tiles over them, and any tile that is being
 * focused last (the more focused, the later), so the focused tile is always on top.
 */
export function drawRank(plane: PlaneName, f: number): number {
  if (f > 0.01) return 2 + f;
  return plane === "far" ? 0 : 1;
}

/** Sorts tiles for drawing, in place; tiles of equal rank keep their order. */
export function sortForDraw<T extends { plane: PlaneName; f: number }>(tiles: T[]): T[] {
  return tiles.sort((a, b) => drawRank(a.plane, a.f) - drawRank(b.plane, b.f));
}

/**
 * Opacity and scale of a tile's picture. A thumbnail that is not on the atlas yet (`loadedAt` is
 * 0 or missing) has no arrival: the animated placeholder shows. With reduced motion a loaded
 * picture just appears.
 */
export function arrivalOf(p: {
  loadedAt: number;
  now: number;
  distanceFromCentre: number;
  pitch: number;
  reduced: boolean;
}): { loaded: boolean; alpha: number; scale: number } {
  if (!(p.loadedAt > 0)) return { loaded: false, alpha: 0, scale: 1 };
  if (p.reduced) return { loaded: true, alpha: 1, scale: 1 };
  return { loaded: true, ...arrival(p.now - p.loadedAt, p.distanceFromCentre, p.pitch) };
}

/** The chip's second line: the channel, and how many other videos from it are on the wall. */
export function chipSub(channel: string, more: number): string {
  return more >= 1 ? `${channel}, ${more} more from this channel` : channel;
}
