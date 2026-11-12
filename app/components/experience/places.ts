// Named features on the picture (spec 9.5). Pure maths, no DOM.
import { toFraction, toPixel, type Frame, type LonLat, type Point } from "./geo";

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
