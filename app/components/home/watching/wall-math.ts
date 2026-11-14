import type { SiteVideo } from "~/types";
import { sizeOfPlan, type BlockPlan } from "./wall-block";

/**
 * Pure maths for the video wall: tile sizes, the finite block's layout, the
 * thumbnail atlas, hover hit-testing and the arrival fade. No DOM, no WebGL.
 * Ported from the `Wall` module of docs/redesign/mockups/home-v4.html; the
 * block's shape and soft edges are wall-block.ts.
 */

/** Number of cells per atlas row. */
export const ATLAS_COLS = 8;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export type TileSize = {
  cw: number;
  ch: number;
  gap: number;
  pitchX: number;
  pitchY: number;
};

/**
 * Round 6's tile size at a screen width. The wall's own tiles are about half of it (`blockPlan` in
 * wall-block.ts); this is what a chosen video's box is still measured against.
 */
export function tileSize(vw: number): TileSize {
  const cw = vw < 700 ? vw / 2.15 : clamp(vw / 5.2, 230, 380);
  const ch = (cw * 9) / 16;
  const gap = Math.round(cw * 0.075);
  return { cw, ch, gap, pitchX: cw + gap, pitchY: ch + gap };
}

/**
 * The other videos from the focused video's channel, by index. Empty when
 * nothing is focused.
 */
export function echoSet(
  videos: ReadonlyArray<{ channel: string }>,
  focusIndex: number | null,
): Set<number> {
  const out = new Set<number>();
  if (focusIndex === null) return out;
  const focus = videos[focusIndex];
  if (!focus) return out;
  videos.forEach((v, i) => {
    if (i !== focusIndex && v.channel === focus.channel) out.add(i);
  });
  return out;
}

/** Milliseconds a tile waits per pitch of distance from the centre, and the most it waits. */
const ARRIVAL_STEP = 40;
const ARRIVAL_MAX_DELAY = 600;
const ARRIVAL_MS = 300;

/**
 * A freshly loaded thumbnail fades in and settles from 96% to 100% over 300 ms,
 * starting later the further it is from the centre, so tiles ripple outwards.
 */
export function arrival(
  sinceLoadedMs: number,
  distanceFromCentre: number,
  pitch: number,
): { alpha: number; scale: number } {
  const raw = pitch > 0 ? (distanceFromCentre / pitch) * ARRIVAL_STEP : 0;
  const delay = Number.isNaN(raw) ? 0 : clamp(raw, 0, ARRIVAL_MAX_DELAY);
  const since = Number.isNaN(sinceLoadedMs) ? 0 : sinceLoadedMs;
  const p = clamp((since - delay) / ARRIVAL_MS, 0, 1);
  const e = 1 - Math.pow(1 - p, 3);
  return { alpha: e, scale: 0.96 + 0.04 * e };
}

export type Atlas = {
  cw: number;
  ch: number;
  aw: number;
  ah: number;
  cols: number;
  capacity: number;
  cells: Array<{ x: number; y: number }>;
};

/**
 * One power-of-two texture holding every thumbnail, 8 cells to a row. The
 * height is the smallest power of two that fits all rows, capped at 4096 (2048
 * when small), so very long playlists keep only the videos that fit.
 */
export function atlasLayout(count: number, small: boolean): Atlas {
  const cw = small ? 256 : 512;
  const ch = small ? 144 : 288;
  const aw = cw * ATLAS_COLS;
  const maxH = small ? 2048 : 4096;
  const rows = Math.max(1, Math.ceil(count / ATLAS_COLS));
  let ah = 256;
  while (ah < rows * ch && ah < maxH) ah *= 2;
  const capacity = Math.floor(ah / ch) * ATLAS_COLS;
  const n = Math.max(0, Math.min(count, capacity));
  const cells = Array.from({ length: n }, (_, i) => ({
    x: (i % ATLAS_COLS) * cw,
    y: Math.floor(i / ATLAS_COLS) * ch,
  }));
  return { cw, ch, aw, ah, cols: ATLAS_COLS, capacity, cells };
}

/** Atlas rectangle of video `i` as [u, v, width, height], inset 3 texels to avoid bleed. */
export function cellUv(
  i: number,
  atlas: Pick<Atlas, "cw" | "ch" | "aw" | "ah" | "cols">,
): [number, number, number, number] {
  const { cw, ch, aw, ah, cols } = atlas;
  return [
    ((i % cols) * cw + 3) / aw,
    (Math.floor(i / cols) * ch + 3) / ah,
    (cw - 6) / aw,
    (ch - 6) / ah,
  ];
}

/** `hq` is the thumbnail every video has; `sd` is the larger one where it exists. */
export function thumbUrl(
  v: Pick<SiteVideo, "id" | "thumb">,
  size: "sd" | "mq" | "hq",
): string {
  const file =
    size === "mq"
      ? "mqdefault"
      : size === "sd" && v.thumb === "sd"
        ? "sddefault"
        : "hqdefault";
  return `https://i.ytimg.com/vi/${v.id}/${file}.jpg`;
}

export type LayoutTile = { key: string; idx: number; x: number; y: number };

/**
 * Every tile of the block in view, plus a one-pitch margin for tiles pushed in from the edge. Tile
 * (`cx`, `cy`) holds video `cy * cols + cx` (none past `count`), and its key is "cx,cy". `viewX` and
 * `viewY` are the block-space position of the screen's top-left corner. The block is finite: nothing
 * is drawn beyond its edges.
 */
export function layoutTiles(p: {
  viewX: number;
  viewY: number;
  vw: number;
  vh: number;
  plan: Pick<BlockPlan, "cols" | "rows" | "tileW" | "tileH" | "gap">;
  count: number;
  /** Other views (block-space positions of the screen's corner) the tiles in sight of are laid out as well, as while the camera travels. */
  also?: ReadonlyArray<{ x: number; y: number }>;
}): LayoutTile[] {
  const { viewX, viewY, vw, vh, plan, count, also } = p;
  const { pitchX, pitchY } = sizeOfPlan(plan);
  const out: LayoutTile[] = [];
  if (count <= 0 || plan.cols <= 0 || plan.rows <= 0) return out;
  let xa = viewX;
  let xb = viewX;
  let ya = viewY;
  let yb = viewY;
  for (const v of also ?? []) {
    xa = Math.min(xa, v.x);
    xb = Math.max(xb, v.x);
    ya = Math.min(ya, v.y);
    yb = Math.max(yb, v.y);
  }
  const c0 = Math.max(0, Math.floor((xa - pitchX) / pitchX));
  const c1 = Math.min(plan.cols - 1, Math.floor((xb + vw + pitchX) / pitchX));
  const r0 = Math.max(0, Math.floor((ya - pitchY) / pitchY));
  const r1 = Math.min(plan.rows - 1, Math.floor((yb + vh + pitchY) / pitchY));
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const idx = cy * plan.cols + cx;
      if (idx >= count) continue; // the empty end of the last row
      out.push({ key: `${cx},${cy}`, idx, x: cx * pitchX - viewX, y: cy * pitchY - viewY });
    }
  }
  return out;
}

/**
 * The tile whose undisplaced cell, gaps included, contains the point, so the
 * focus never drops between two videos. Null when the point is off the grid.
 */
export function hitTile(
  tiles: ReadonlyArray<Pick<LayoutTile, "key" | "x" | "y">>,
  mx: number,
  my: number,
  size: Pick<TileSize, "cw" | "ch" | "pitchX" | "pitchY">,
): string | null {
  const { cw, ch, pitchX, pitchY } = size;
  for (const tl of tiles) {
    if (
      Math.abs(mx - tl.x - cw / 2) <= pitchX / 2 &&
      Math.abs(my - tl.y - ch / 2) <= pitchY / 2
    )
      return tl.key;
  }
  return null;
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
