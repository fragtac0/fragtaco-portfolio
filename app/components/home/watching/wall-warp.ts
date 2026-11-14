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

/*
 * The rest of the second pass (spec 8.1, edges): a dark fade on all four sides, and toward the corners a
 * blur, a slight colour fringe and (above) the fish-eye. Every strength is a function of the screen
 * pixel (x, y) alone, exactly zero inside the middle of the screen (the radial ones inside
 * `*_INNER` of the half-diagonal, the sides' fade inside `EDGE_DARK_INNER` of the half-width and the
 * half-height) and bounded by its maximum at the corners. The same constants build the shader in
 * wall-warp-pass.ts. The heading (top left) and the Esc pill (top right) sit in the top band, which
 * is darkened further (`HEAD_DARK`) so their text reads over any picture (4.5 to 1, measured in
 * scripts/audit/wall.json). Pure.
 */

/** The blur starts at this share of the half-diagonal and reaches `BLUR_MAX_PX` (a spread of five taps) at the corners. */
export const BLUR_INNER = 0.6;
export const BLUR_MAX_PX = 4.5;
/** The colour fringe: red is read this far out along the radius and blue this far in, at the corners. */
export const FRINGE_INNER = 0.6;
export const FRINGE_MAX_PX = 3;
/** The dark fade of each side starts at this share of the half-width (or half-height) and reaches `EDGE_DARK_SIDE` at the edge. */
export const EDGE_DARK_INNER = 0.62;
export const EDGE_DARK_SIDE = 0.5;
/** The top band, where the heading and the Esc pill are: fully `HEAD_DARK` down to half of `HEAD_BAND_PX`, then easing out (the band is at most a quarter of the screen's height). */
export const HEAD_DARK = 0.8;
export const HEAD_BAND_PX = 200;

const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** The radius of the screen point in half-diagonals. */
function radius(x: number, y: number, vw: number, vh: number): number {
  const hd = Math.hypot(vw / 2, vh / 2);
  return hd > 0 ? Math.hypot(x - vw / 2, y - vh / 2) / hd : 0;
}

/** The blur's reach at a screen point, CSS px: 0 up to 60% of the half-diagonal, `BLUR_MAX_PX` from the corner on. */
export function edgeBlur(x: number, y: number, vw: number, vh: number): number {
  return BLUR_MAX_PX * smooth(BLUR_INNER, 1, radius(x, y, vw, vh));
}

/** How far red and blue are read apart at a screen point (each this far from the true place, opposite ways), CSS px. */
export function edgeFringe(x: number, y: number, vw: number, vh: number): number {
  return FRINGE_MAX_PX * smooth(FRINGE_INNER, 1, radius(x, y, vw, vh));
}

/** The share (0 to 1) of the picture replaced by the ground at a screen point: the four sides, and the top band. */
export function edgeDark(x: number, y: number, vw: number, vh: number): number {
  const sideX = EDGE_DARK_SIDE * smooth(EDGE_DARK_INNER, 1, vw > 0 ? Math.abs(x - vw / 2) / (vw / 2) : 0);
  const sideY = EDGE_DARK_SIDE * smooth(EDGE_DARK_INNER, 1, vh > 0 ? Math.abs(y - vh / 2) / (vh / 2) : 0);
  const band = Math.min(HEAD_BAND_PX, vh * 0.25);
  const top = HEAD_DARK * (1 - smooth(band * 0.5, band, y));
  return 1 - (1 - sideX) * (1 - sideY) * (1 - top);
}

/** CSS pixels of flat wall drawn beyond each edge, so the screen's corners are filled after the pull (and the blur and fringe read inside it). */
export function warpMargin(vw: number, vh: number): number {
  return Math.ceil(WARP_MAX * Math.hypot(vw / 2, vh / 2)) + Math.ceil(BLUR_MAX_PX * 0.71 + FRINGE_MAX_PX) + 2;
}
