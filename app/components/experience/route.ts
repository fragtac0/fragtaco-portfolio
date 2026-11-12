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

/** February 2021, where the approach across the plain ends and the climb up the mountain begins. */
const APPROACH_END_DAY = dayOf("2021-02", "2021-02");

/**
 * Where each moment sits along the route, from 0 to 1 (`s` of `routeCurve().at`). The first moment is at 0;
 * February 2021 is at `approachEnd` (2017 to 2021 is the short approach across the plain, so a moment dated
 * in between is spread by time over that stretch); from February 2021 to `today` (1) the rest follow time.
 * The anchor is the date itself, not "the second moment", so it holds if moments are added or share a date.
 *
 * Moments with the same date are `SAME_DATE_GAP` apart, and the first moment after such a run is also at
 * least that far on. A run that would pass 1 (several moments dated today, or today's "now" after a moment
 * dated today) is placed backwards from 1, its earlier members moved back. The result never decreases and
 * stays within 0 to 1. A moment dated before the one ahead of it sits on the same spot as that one.
 */
export function momentPositions(moments: readonly { date: string }[], today: string, approachEnd = 0.14): number[] {
  const n = moments.length;

  if (n === 0) return [];

  const days = moments.map((mo) => dayOf(mo.date, today));
  const todayDay = dayOf(today, today);
  const approachSpan = Math.max(1, APPROACH_END_DAY - days[0]);
  const climbSpan = Math.max(1, todayDay - APPROACH_END_DAY);
  const raw = (day: number) =>
    day < APPROACH_END_DAY
      ? (approachEnd * (day - days[0])) / approachSpan
      : approachEnd + (1 - approachEnd) * ((day - APPROACH_END_DAY) / climbSpan);

  // The gap that must follow moment i: after an equal date, and after the end of a run of equal dates.
  const gapAfter = (i: number) => {
    if (i >= n - 1) return 0;
    if (days[i + 1] === days[i]) return SAME_DATE_GAP;

    return i > 0 && days[i] === days[i - 1] && days[i + 1] > days[i] ? SAME_DATE_GAP : 0;
  };

  const out: number[] = [0];

  for (let i = 1; i < n; i++) {
    const prev = out[i - 1];
    const gap = gapAfter(i - 1);

    out.push(days[i] < days[i - 1] ? prev : Math.max(raw(days[i]), prev + gap));
  }

  // Nothing passes 1: walk back from the end and move earlier members of a run back, keeping the gaps.
  out[n - 1] = Math.min(1, out[n - 1]);

  for (let i = n - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - gapAfter(i));

  return out.map((p) => Math.max(0, p));
}
