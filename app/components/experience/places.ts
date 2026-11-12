// Named features on the picture (spec 9.5). Pure maths, no DOM.
import { toFraction, toPixel, type Frame, type LonLat, type Point } from "./geo";
import type { Rect } from "./journey";

/** The direction of a point from the frame's centre (the summit), in degrees clockwise from east (screen y points down), 0 to 360. */
export function bearingOf(p: LonLat, frame: Frame): number {
  const f = toFraction(p.lon, p.lat, frame);
  const c = toFraction(frame.centre.lon, frame.centre.lat, frame);
  const deg = (Math.atan2(f.y - c.y, f.x - c.x) * 180) / Math.PI;

  return (deg + 360) % 360;
}

/** The point of a traced ring whose direction from the summit is nearest to `bearing` (so the label sits on the trace itself). */
export function cliffPointAt(bearing: number, ring: readonly LonLat[], frame: Frame): LonLat {
  let best = ring[0];
  let gap = Infinity;

  for (const p of ring) {
    const d = Math.abs(((bearingOf(p, frame) - bearing + 540) % 360) - 180);

    if (d < gap) {
      gap = d;
      best = p;
    }
  }

  return best;
}

type PlaceInput = { lon: number; lat: number; cliffBearing?: number };

/** Where a place's dot goes, in picture pixels: on the cliff trace for a line feature, at its own centre otherwise. */
export function placePoint(place: PlaceInput, ring: readonly LonLat[], frame: Frame): Point {
  const at = place.cliffBearing === undefined ? place : cliffPointAt(place.cliffBearing, ring, frame);

  return toPixel(at.lon, at.lat, frame);
}

/** A leader line from a dot to its label's offset: its length in px and its angle in degrees (0 = to the right). */
export function leaderOf(dx: number, dy: number): { length: number; angle: number } {
  return { length: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** map-places.css: a phone's label offsets (and a phone's `--place-k`) are this share of the desktop's, and its labels show the name only. */
export const PHONE_LABEL_K = 0.6;
/** Half the side of a place's ring in screen px (12 px, scaled up to 1.3 on hover, so a little more). */
export const PLACE_DOT_HALF = 8;

/**
 * Where a place's label sits on the screen, as a rectangle, for a dot at screen point `dot`: its offset from the dot,
 * placed the way map-places.css places it (centred on the offset when it is above or below, otherwise its near edge
 * on it, vertically centred), and its size as the CSS lays it out (up to 230 px wide with the name and the line, a
 * phone's 160 px at most with the name only). Sizes are estimates that run slightly large (7 px a character, 16 px a line).
 */
export function placeLabelBox(dot: Point, place: { name: string; line: string; label?: { dx: number; dy: number } }, phone: boolean): Rect {
  const { dx, dy } = place.label ?? { dx: 14, dy: -4 };
  const k = phone ? PHONE_LABEL_K : 1;
  const w = phone ? Math.min(160, place.name.length * 7.5 + 20) : 230;
  const h = phone ? 27 : 34 + 16 * Math.ceil(place.line.length / 30);
  const ax = dot.x + dx * k;
  const ay = dot.y + dy * k;

  if (Math.abs(dx) < 24) {
    return dy < 0 ? { x0: ax - w / 2, x1: ax + w / 2, y0: ay - h, y1: ay } : { x0: ax - w / 2, x1: ax + w / 2, y0: ay, y1: ay + h };
  }

  return { x0: dx < 0 ? ax - w : ax, x1: dx < 0 ? ax : ax + w, y0: ay - h / 2, y1: ay + h / 2 };
}

/** A place's ring as a screen rectangle round the dot at `dot`. */
export const placeDotBox = (dot: Point): Rect => ({ x0: dot.x - PLACE_DOT_HALF, x1: dot.x + PLACE_DOT_HALF, y0: dot.y - PLACE_DOT_HALF, y1: dot.y + PLACE_DOT_HALF });
