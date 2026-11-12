/**
 * The fish-eye at the wall's borders (spec 7). The wall is drawn flat and shown through a barrel
 * warp: the middle is untouched, and from 55% of the half-diagonal outwards the picture is pulled
 * in, by at most 2.2% of the half-diagonal at the corners. The join is smooth (a smoothstep, so
 * the slope is continuous there). `edgeWarp` takes a point on the flat wall to where it shows on
 * screen; `edgeUnwarp` takes a screen point back to the wall (the pointer goes through it before
 * `hitTile`). The same constants build the shader in wall-warp-pass.ts, so the picture and the
 * pointer agree. Pure.
 */

/** The warp starts at this share of the half-diagonal. */
export const WARP_INNER = 0.55;
/** The inward pull at the corners, as a share of the half-diagonal. */
export const WARP_MAX = 0.022;
/** Fixed-point steps for the inverse: the map's slope is under 0.08, so six steps are exact to well under a pixel. */
const STEPS = 6;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** The pull at radius `r` (in half-diagonals): 0 up to the start, WARP_MAX from the corner on. */
export function warpShift(r: number): number {
  const u = clamp((r - WARP_INNER) / (1 - WARP_INNER), 0, 1);
  return WARP_MAX * u * u * (3 - 2 * u);
}

/** Where the flat wall's point (x, y) shows on a `vw` by `vh` screen. */
export function edgeWarp(x: number, y: number, vw: number, vh: number): [number, number] {
  const cx = vw / 2;
  const cy = vh / 2;
  const hd = Math.hypot(cx, cy);
  const dx = x - cx;
  const dy = y - cy;
  const r = hd > 0 ? Math.hypot(dx, dy) / hd : 0;
  if (!(r > 0)) return [x, y];
  const k = (r - warpShift(r)) / r;
  return [cx + dx * k, cy + dy * k];
}

/** The flat wall's point that shows at the screen point (x, y); the inverse of `edgeWarp`. */
export function edgeUnwarp(x: number, y: number, vw: number, vh: number): [number, number] {
  const cx = vw / 2;
  const cy = vh / 2;
  const hd = Math.hypot(cx, cy);
  const dx = x - cx;
  const dy = y - cy;
  const R = hd > 0 ? Math.hypot(dx, dy) / hd : 0;
  if (!(R > 0)) return [x, y];
  let r = R;
  for (let i = 0; i < STEPS; i++) r = R + warpShift(r);
  const k = r / R;
  return [cx + dx * k, cy + dy * k];
}

/** CSS pixels of flat wall drawn beyond each edge, so the screen's corners are filled after the pull. */
export function warpMargin(vw: number, vh: number): number {
  return Math.ceil(WARP_MAX * Math.hypot(vw / 2, vh / 2)) + 2;
}
