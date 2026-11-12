import { tileSize } from "./wall-math";

/**
 * What a click does to the wall (spec 7, "Click"). The chosen video travels to `chosenRect`, a
 * little above the middle and about twice its size, with its text under it (`textZone`). The other
 * tiles move away from the middle of that rectangle (`spread`: up to 140 px for the nearest, none
 * beyond 60% of the half-diagonal), shrink to 92% and dim to 55%. `hiddenTiles` says which of them
 * fade out instead: the ones in the text block's way, the ones more than 5% behind the chosen video
 * and, so that no two visible tiles ever overlap, the nearer of any two that still do. The pose and
 * the engine use these; everything here is pure.
 */

/** How long the wall takes to open and to close, ms (spec 7); reduced motion fades over `FADE_MS`. */
export const OPEN_MS = 420;
export const CLOSE_MS = 320;
export const FADE_MS = 300;

/**
 * The most a tile is pushed, px, and the share of the half-diagonal beyond which there is none.
 * Between them the push falls away no faster than `PUSH_SLOPE` px per px of distance, so two
 * neighbours are never brought closer than the 8% they shrink and the gap between them leave
 * room for (a tile is at least 7% smaller than its pitch, measured unshrunk: the ledger's figure). That makes
 * the push at the middle `PUSH_SLOPE * reach`, well under the 140 px the spec allows, and no overlap to hide.
 */
export const PUSH_MAX = 140;
export const PUSH_REACH = 0.6;
export const PUSH_SLOPE = 0.12;
export const SPREAD_SCALE = 0.92;
export const SPREAD_DIM = 0.55;
/** A tile closer than this to the middle is pushed less, so one exactly there does not flip sides. */
const PUSH_RAMP = 24;

/** The text block's height, the gap above it, and the room kept for both under the video, px. */
export const TEXT_H = 150;
export const TEXT_GAP = 14;
const TEXT_ROOM = 170;

export type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Eases a 0 to 1 progress: slow, fast, slow. */
export const easeInOut = (p: number): number => {
  const t = clamp(p, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** Moves `v` toward `target` by `dt` seconds of a change that takes `seconds` end to end. */
export function stepToward(v: number, target: number, dt: number, seconds: number): number {
  const step = seconds > 0 ? dt / seconds : 1;
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

/**
 * Where a tile that is not chosen goes. `x`, `y` is its centre, `cx`, `cy` the middle it moves
 * away from, `open` how far open the wall is (0 to 1; everything is multiplied by it). The push is
 * at most 140 px (`PUSH_SLOPE` of the distance left to 60% of the half-diagonal, so a gentle slope,
 * and nothing beyond that). `scale` and `dim`
 * are factors for the tile's size and brightness.
 */
export function spread(p: {
  x: number;
  y: number;
  cx: number;
  cy: number;
  halfDiag: number;
  open: number;
}): { x: number; y: number; scale: number; dim: number } {
  const open = clamp(Number.isFinite(p.open) ? p.open : 0, 0, 1);
  const dx = p.x - p.cx;
  const dy = p.y - p.cy;
  const d = Math.hypot(dx, dy);
  const reach = PUSH_REACH * p.halfDiag;
  let push = 0;
  if (d > 0 && reach > 0) {
    push = Math.min(PUSH_MAX, PUSH_SLOPE * (reach - d)) * Math.min(1, d / PUSH_RAMP) * open;
    if (push < 0) push = 0;
  }
  return {
    x: d > 0 ? p.x + (dx / d) * push : p.x,
    y: d > 0 ? p.y + (dy / d) * push : p.y,
    scale: 1 - (1 - SPREAD_SCALE) * open,
    dim: 1 - (1 - SPREAD_DIM) * open,
  };
}

/**
 * Where the chosen video sits: about twice a tile, at most 52% of the width (86% when narrow),
 * centred a little above the middle, 16 by 9. It is made smaller when the screen is short, so at
 * least 170 px stay under it for the text (and a margin above it for the close button).
 */
export function chosenRect(vw: number, vh: number, narrow: boolean): Rect {
  const top = Math.min(64, vh * 0.1);
  const room = Math.min(TEXT_ROOM, vh * 0.42);
  let w = Math.min(2 * tileSize(vw).cw, vw * (narrow ? 0.86 : 0.52));
  const hMax = Math.max(40, vh - top - room);
  if ((w * 9) / 16 > hMax) w = (hMax * 16) / 9;
  const h = (w * 9) / 16;
  const cy = clamp(vh * 0.44, top + h / 2, vh - room - h / 2);
  return { x: (vw - w) / 2, y: cy - h / 2, w, h };
}

/** The text block's box: under the chosen video, as wide as it is. Nothing may stand in it. */
export function textZone(rect: Rect): Rect {
  return { x: rect.x, y: rect.y + rect.h + TEXT_GAP, w: rect.w, h: TEXT_H };
}

/** Whether two rectangles overlap, `pad` px of air counted around the second. */
export function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad
  );
}

/** Air kept round the text block, px (covers the fish-eye bending a tile there by a few px). */
export const ZONE_AIR = 12;
/** A tile with more than this share of it behind the chosen video fades out. */
export const BEHIND_SHARE = 0.05;
/** Two tiles overlap when they cross by more than this in both directions, px. */
export const OVERLAP_MIN = 0.5;

/** Whether two rectangles cross by more than `OVERLAP_MIN` px both ways. */
export function crosses(a: Rect, b: Rect): boolean {
  return (
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > OVERLAP_MIN &&
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > OVERLAP_MIN
  );
}

/**
 * Which of the tiles around a chosen video fade out when the wall is open. `boxes` are the tiles'
 * final boxes (the chosen one left out), `rect` the chosen video, `zone` the text block. Hidden:
 * a tile within `ZONE_AIR` of the text block or more than `BEHIND_SHARE` behind the video; then,
 * working outwards from the video's middle, the nearer of any two visible tiles that cross, until
 * no two visible tiles do.
 */
export function hiddenTiles(
  boxes: ReadonlyArray<Rect & { key: string }>,
  rect: Rect,
  zone: Rect,
): Set<string> {
  const hidden = new Set<string>();
  const mx = rect.x + rect.w / 2;
  const my = rect.y + rect.h / 2;
  const left: Array<Rect & { key: string; d: number }> = [];
  for (const b of boxes) {
    if (overlaps(b, zone, ZONE_AIR) || coveredShare(b, rect) > BEHIND_SHARE) hidden.add(b.key);
    else left.push({ ...b, d: Math.hypot(b.x + b.w / 2 - mx, b.y + b.h / 2 - my) });
  }
  left.sort((a, b) => a.d - b.d);
  for (let i = 0; i < left.length; i++) {
    for (let j = i + 1; j < left.length; j++) {
      if (!hidden.has(left[i].key) && crosses(left[i], left[j])) hidden.add(left[i].key);
    }
  }
  return hidden;
}

/** The share of rectangle `a`'s area that lies inside `b` (0 to 1). */
export function coveredShare(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 && a.w * a.h > 0 ? (w * h) / (a.w * a.h) : 0;
}

/**
 * The nearest tile from `from` in the direction (dx, dy) (one of the four arrow directions), among
 * `tiles`' centres: it must lie within 45 degrees of that direction. Null when there is none, so
 * the choice stays where it is.
 */
export function nearestInDirection<T extends { x: number; y: number }>(
  from: { x: number; y: number },
  tiles: readonly T[],
  dx: number,
  dy: number,
): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const t of tiles) {
    const ox = t.x - from.x;
    const oy = t.y - from.y;
    const along = ox * dx + oy * dy;
    const across = Math.abs(ox * dy - oy * dx);
    if (along <= 0 || across > along) continue;
    const d = Math.hypot(ox, oy);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}
