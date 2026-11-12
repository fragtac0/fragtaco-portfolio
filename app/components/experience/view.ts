// The map's view (spec 9.2): fit, clamp, zoom about a point and fly. Pure maths, no DOM.
//
// A view is the picture pixel (top level of the tile pyramid) at the centre of the screen, and the
// scale: screen pixels per picture pixel. Screen positions are CSS pixels from the screen's top left,
// except in `zoomAbout`, where the point is given from the screen's centre.
import type { Manifest } from "./geo";

export type View = { cx: number; cy: number; scale: number };

type Size = Pick<Manifest, "size">;

/** The overview leaves the cliff ring this share of the smaller screen side. */
export const FIT_RING_SHARE = 0.78;
/**
 * The cliff ring's width as a share of the picture. It is the mean radius of the ring in
 * `content/site/experience.json` (the Gazetteer's trace of Olympus Rupes) doubled, in fractions of the
 * frame; `app/content/schemas-experience.test.ts` checks it against the file.
 */
export const CLIFF_SPAN = 0.67;
/** Explore starts at this many times the fit scale; zooming out past it goes back to the overview. */
export const EXPLORE_MIN = 2;
/** The greatest scale: one picture pixel to one screen pixel (the picture's native size). */
export const MAX_SCALE = 1;
/** The time a fly takes, in milliseconds. */
export const FLY_MS = 700;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The scale of the overview: the cliff ring is `FIT_RING_SHARE` of the smaller screen side. */
export function fitScale(vw: number, vh: number, m: Size): number {
  return (FIT_RING_SHARE * Math.min(vw, vh)) / (CLIFF_SPAN * m.size);
}

/** The overview: the whole mountain, the summit in the middle of the screen. */
export function fitView(vw: number, vh: number, m: Size): View {
  return { cx: m.size / 2, cy: m.size / 2, scale: fitScale(vw, vh, m) };
}

/** The scale at which explore begins. */
export function exploreScale(vw: number, vh: number, m: Size): number {
  return EXPLORE_MIN * fitScale(vw, vh, m);
}

/**
 * Keep a view legal: the scale between the fit scale and `MAX_SCALE`, and the screen inside the picture.
 * On an axis where the picture is smaller than the screen (the overview of a wide screen) the picture is
 * centred instead; at every other scale no edge of the screen leaves the picture.
 */
export function clampView(v: View, vw: number, vh: number, m: Size): View {
  const scale = clamp(v.scale, Math.min(fitScale(vw, vh, m), MAX_SCALE), MAX_SCALE);
  const axis = (c: number, screen: number) => {
    const half = screen / (2 * scale);

    return m.size <= 2 * half ? m.size / 2 : clamp(c, half, m.size - half);
  };

  return { cx: axis(v.cx, vw), cy: axis(v.cy, vh), scale };
}

/** Zoom by `factor`, keeping the picture point under (px, py), measured from the screen's centre, still. */
export function zoomAbout(v: View, factor: number, px: number, py: number): View {
  const scale = v.scale * factor;

  return { cx: v.cx + px / v.scale - px / scale, cy: v.cy + py / v.scale - py / scale, scale };
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The view `t` of the way (0 to 1 in time) from one view to another, eased in and out. The scale changes by
 * the same ratio at every step. The centre moves so that a zoom looks like a zoom about one point (it
 * moves in step with 1 / scale, not with time), and a pure pan is a straight, eased move.
 */
export function flyTo(from: View, to: View, t: number): View {
  const e = easeInOutCubic(clamp(t, 0, 1));

  if (e === 0) return { ...from };
  if (e === 1) return { ...to };

  const scale = from.scale * (to.scale / from.scale) ** e;
  // The centre's share of the way is linear in 1 / scale.
  const f = from.scale === to.scale ? e : (1 / scale - 1 / from.scale) / (1 / to.scale - 1 / from.scale);

  return { cx: from.cx + (to.cx - from.cx) * f, cy: from.cy + (to.cy - from.cy) * f, scale };
}
