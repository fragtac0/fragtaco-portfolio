import type { SiteVideo } from "~/types";

/**
 * Pure maths for the video wall: tile sizes, the drifting column layout, the
 * thumbnail atlas, hover hit-testing and the focus effect. No DOM, no WebGL.
 * Ported from the `Wall` module of docs/redesign/mockups/home-v4.html.
 */

/** Pixels a column drifts per second. */
export const SPEED = 7;
/** Number of cells per atlas row. */
export const ATLAS_COLS = 8;
/** Columns of videos on the wall; every column wraps over its own videos. */
export const WALL_COLS = 8;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

export type TileSize = {
  cw: number;
  ch: number;
  gap: number;
  pitchX: number;
  pitchY: number;
};

export function tileSize(vw: number): TileSize {
  const cw = vw < 700 ? vw / 2.15 : clamp(vw / 5.2, 230, 380);
  const ch = (cw * 9) / 16;
  const gap = Math.round(cw * 0.075);
  return { cw, ch, gap, pitchX: cw + gap, pitchY: ch + gap };
}

export type Plane = {
  scale: number;
  dim: number;
  speed: number;
  bias: number;
  parallax: number;
};

/**
 * The two depth planes. Alternate (odd) columns sit further back: smaller,
 * dimmer, a touch softer (`bias` is the extra mipmap bias), drifting at 60% of
 * the speed and leaning half as far with the pointer.
 */
export const PLANE = {
  far: { scale: 0.86, dim: 0.82, speed: 0.6, bias: 0.6, parallax: 0.5 },
  near: { scale: 1, dim: 1, speed: 1, bias: 0, parallax: 1 },
} as const satisfies Record<"far" | "near", Plane>;

/** Odd columns are far, even ones near; correct for negative columns. */
export function planeOf(cx: number): "near" | "far" {
  return mod(cx, 2) ? "far" : "near";
}

/** Vertical offset of a column: far columns drift the other way, slower. */
export function columnOffset(t: number, cx: number): number {
  const speed = PLANE[planeOf(cx)].speed;
  return t * SPEED * (mod(cx, 2) ? -0.72 : 1) * speed + cx * 53;
}

/**
 * How far the wall leans against the pointer, in pixels: up to 14 across and
 * 10 down at the screen edges, scaled by the plane. Zero with no pointer.
 */
export function parallaxShift(
  pointer: { x: number; y: number } | null,
  vw: number,
  vh: number,
  plane: Pick<Plane, "parallax">,
): { x: number; y: number } {
  if (!pointer || !(vw > 0) || !(vh > 0)) return { x: 0, y: 0 };
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y))
    return { x: 0, y: 0 };
  // a captured drag can leave the window: the lean stops at the edge
  const px = clamp(pointer.x / vw, 0, 1);
  const py = clamp(pointer.y / vh, 0, 1);
  return {
    x: (0.5 - px) * 28 * plane.parallax,
    y: (0.5 - py) * 20 * plane.parallax,
  };
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

export function thumbUrl(
  v: Pick<SiteVideo, "id" | "thumb">,
  size: "sd" | "mq",
): string {
  const file =
    size === "mq" ? "mqdefault" : v.thumb === "sd" ? "sddefault" : "hqdefault";
  return `https://i.ytimg.com/vi/${v.id}/${file}.jpg`;
}

/** Weight of the focus effect at an offset from the focused tile's centre. */
export function focusWeight(dx: number, dy: number, pitchX: number): number {
  return Math.exp(-(dx * dx + dy * dy) / (2 * Math.pow(1.3 * pitchX, 2)));
}

export type LayoutTile = { key: string; idx: number; x: number; y: number };

/** Every tile in view, plus a one-pitch margin for tiles pushed in from the edge. */
export function layoutTiles(p: {
  panX: number;
  panY: number;
  vw: number;
  vh: number;
  pitchX: number;
  pitchY: number;
  t: number;
  count: number;
}): LayoutTile[] {
  const { panX, panY, vw, vh, pitchX, pitchY, t, count } = p;
  const cols = WALL_COLS;
  const out: LayoutTile[] = [];
  if (count <= 0) return out;
  const m = pitchX;
  const c1 = Math.floor((panX + vw + m) / pitchX);
  for (let cx = Math.floor((panX - m) / pitchX); cx <= c1; cx++) {
    const off = columnOffset(t, cx);
    const c = mod(cx, cols);
    // with fewer videos than columns, the spare columns stay empty
    if (c >= count) continue;
    // a column holds videos c, c + cols, c + 2 * cols, ... below `count`
    const lenc = Math.max(1, Math.floor((count - 1 - c) / cols) + 1);
    const y1 = Math.floor((panY + off + vh + m) / pitchY);
    for (let cy = Math.floor((panY + off - m) / pitchY); cy <= y1; cy++) {
      out.push({
        key: `${cx},${cy}`,
        idx: c + cols * mod(cy, lenc),
        x: cx * pitchX - panX,
        y: cy * pitchY - panY - off,
      });
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
 * Scale, displaced centre and corner radius of a tile. `f` is its own hover
 * weight (0 to 1), `weight` the focus weight at its centre, (dx, dy) its
 * offset from the focus centre.
 */
export function tileTransform(p: {
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  f: number;
  weight: number;
  cw: number;
  ch: number;
}): { cx: number; cy: number; w: number; h: number; rad: number } {
  const { cx, cy, dx, dy, f, weight, cw, ch } = p;
  const s = 1 + 0.13 * f - 0.035 * weight * (1 - f);
  return {
    cx: cx + dx * 0.16 * weight,
    cy: cy + dy * 0.16 * weight,
    w: cw * s,
    h: ch * s,
    rad: (12 * (cw * s)) / cw,
  };
}
