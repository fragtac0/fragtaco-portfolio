// The route line and where the moments sit on it (spec 9.3). Pure maths, no DOM, no clock: "today" is
// passed in.
import { toPixel, type Frame, type LonLat } from "./geo";

export type RouteCurve = {
  /** An SVG path in top level picture pixels. */
  d: string;
  /** The length of the curve in the same pixels. */
  length: number;
  /** The point `s` of the way along the curve by length (`s` from 0 to 1, clamped). */
  at(s: number): { x: number; y: number };
};

/** Steps used to measure each piece of the curve. */
const STEPS = 48;

type Pt = { x: number; y: number };

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A smooth curve through the points (a Catmull-Rom spline written as cubic Beziers, so the SVG path and
 * `at` describe the same line). The curve passes through every point; with two points it is a straight line.
 */
export function routeCurve(points: readonly LonLat[], m: Frame): RouteCurve {
  const p: Pt[] = points.map((q) => toPixel(q.lon, q.lat, m));

  if (p.length === 0) return { d: "", length: 0, at: () => ({ x: 0, y: 0 }) };
  if (p.length === 1) return { d: `M${round(p[0].x)} ${round(p[0].y)}`, length: 0, at: () => ({ ...p[0] }) };

  const segments: [Pt, Pt, Pt, Pt][] = [];

  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];

    segments.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ]);
  }

  let d = `M${round(p[0].x)} ${round(p[0].y)}`;
  const samples: Pt[] = [{ ...p[0] }];
  const along: number[] = [0];

  for (const [a, b, c, e] of segments) {
    d += ` C${round(b.x)} ${round(b.y)} ${round(c.x)} ${round(c.y)} ${round(e.x)} ${round(e.y)}`;

    for (let k = 1; k <= STEPS; k++) {
      const t = k / STEPS;
      const u = 1 - t;
      const pt = {
        x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * e.x,
        y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * e.y,
      };
      const last = samples[samples.length - 1];

      along.push(along[along.length - 1] + Math.hypot(pt.x - last.x, pt.y - last.y));
      samples.push(pt);
    }
  }

  const length = along[along.length - 1];

  const at = (s: number): Pt => {
    const target = Math.min(1, Math.max(0, s)) * length;
    let lo = 0;
    let hi = along.length - 1;

    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;

      if (along[mid] <= target) lo = mid;
      else hi = mid;
    }

    const span = along[hi] - along[lo];
    const f = span > 0 ? (target - along[lo]) / span : 0;

    return { x: samples[lo].x + (samples[hi].x - samples[lo].x) * f, y: samples[lo].y + (samples[hi].y - samples[lo].y) * f };
  };

  return { d, length, at };
}

/** The route ends this share of the way from the cliff to the summit crater's rim, at most (spec 9.3). */
export const ROUTE_STOP_SHARE = 0.6;

/**
 * How close to the summit the route's last point may be: the rim's radius plus the rest of the way, in
 * whatever unit the two radii are in (the cliff's mean radius and the rim's radius).
 */
export function routeStopRadius(cliffRadius: number, rimRadius: number): number {
  return rimRadius + (1 - ROUTE_STOP_SHARE) * (cliffRadius - rimRadius);
}

/** Moments with the same date sit this far apart along the route. */
export const SAME_DATE_GAP = 0.012;

const DAY = 86_400_000;

/**
 * A moment's date as a day number. `"now"` is `today`; `YYYY` is the first of January and `YYYY-MM`
 * the first of the month (a moment with only a year or a month has no day).
 */
function dayOf(date: string, today: string): number {
  const iso = date === "now" ? today : date;
  const [y, mo = "01", d = "01"] = iso.split("-");

  return Date.UTC(Number(y), Number(mo) - 1, Number(d)) / DAY;
}

/**
 * Where each moment sits along the route, from 0 to 1 (`s` of `routeCurve().at`). The first moment is at 0
 * and the second at `approachEnd` (2017 to 2021 is the short approach across the plain); the rest follow
 * time from the second moment to `today`, which is 1. Moments with the same date are `SAME_DATE_GAP`
 * apart. The result never decreases and stays within 0 to 1.
 */
export function momentPositions(moments: readonly { date: string }[], today: string, approachEnd = 0.14): number[] {
  if (moments.length === 0) return [];

  const days = moments.map((mo) => dayOf(mo.date, today));
  const t0 = days.length > 1 ? days[1] : days[0];
  const span = Math.max(1, dayOf(today, today) - t0);
  const out: number[] = [];

  days.forEach((day, i) => {
    let pos: number;

    if (i === 0) pos = 0;
    else pos = approachEnd + (1 - approachEnd) * ((day - t0) / span);

    if (i > 0) {
      const prev = out[i - 1];

      if (day === days[i - 1]) pos = prev + SAME_DATE_GAP;
      else pos = Math.max(pos, prev);
    }

    out.push(Math.min(1, Math.max(0, pos)));
  });

  return out;
}
