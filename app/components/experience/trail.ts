// The trail (spec 9.3): the first route, each point pushed away from the summit (the later ones more), drawn as a
// smooth curve and sampled at equal steps along its length. Pure maths: the curve is d3's centripetal Catmull-Rom
// (alpha 0.5) and its basis curve, written out here so that nothing needs the DOM's path measuring.
import { clamp, lerp } from "./map-math";

export type Point = [number, number];
/** A place on the trail: map units, and `n`, the ground's height there (0 at the plain, 1 at the summit), set once the heights are known. */
export type TrailPoint = { x: number; y: number; n: number };

/** The share of the trail at which each of the nine milestones sits. */
export const MILESTONE_SHARES = [0, 0.3, 0.38, 0.48, 0.58, 0.66, 0.8, 0.93, 1] as const;

/** The shares of the trail for `count` milestones: the nine of the design, or an even spread if the content has another number. */
export function sharesFor(count: number): number[] {
  if (count === MILESTONE_SHARES.length) return [...MILESTONE_SHARES];

  return Array.from({ length: count }, (_, i) => (count > 1 ? i / (count - 1) : 1));
}

/** How many steps the trail is sampled in, and the steps of the dotted part ahead. */
export const TRAIL_STEPS = 200;
export const AHEAD_STEPS = 60;

/** Each point pushed from the summit by 1 + 0.4 * t^1.2 (t is the point's share of the way): the first stays, the last moves 40%. */
export function lowerTrail(points: readonly Point[], summit: Point): Point[] {
  const last = Math.max(1, points.length - 1);

  return points.map(([x, y], i) => {
    const k = 1 + 0.4 * (i / last) ** 1.2;

    return [summit[0] + (x - summit[0]) * k, summit[1] + (y - summit[1]) * k];
  });
}

type Bezier = [number, number, number, number, number, number, number, number];

/** Where a cubic curve is, `t` of the way (0 to 1). */
function bezierAt(b: Bezier, t: number): Point {
  const m = 1 - t;
  const [a, c, d, e] = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];

  return [a * b[0] + c * b[2] + d * b[4] + e * b[6], a * b[1] + c * b[3] + d * b[5] + e * b[7]];
}

const EPS = 1e-12;

/** d3.curveCatmullRom.alpha(0.5) as cubic curves, one for each pair of neighbouring points. */
export function catmullRom(pts: readonly Point[], alpha = 0.5): Bezier[] {
  const out: Bezier[] = [];

  if (pts.length < 2) return out;

  const dist2a = (a: Point, b: Point) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p0 = pts[i - 1];
    // The end repeats the last point, so the last curve has no further neighbour (its length is 0).
    const p3 = pts[i + 2];
    const l12_2a = dist2a(p1, p2) ** alpha;
    const l12_a = Math.sqrt(l12_2a);
    const l01_2a = p0 ? dist2a(p0, p1) ** alpha : 0;
    const l01_a = Math.sqrt(l01_2a);
    const l23_2a = p3 ? dist2a(p2, p3) ** alpha : 0;
    const l23_a = Math.sqrt(l23_2a);
    let [x1, y1, x2, y2] = [p1[0], p1[1], p2[0], p2[1]];

    if (p0 && l01_a > EPS) {
      const a = 2 * l01_2a + 3 * l01_a * l12_a + l12_2a;
      const n = 3 * l01_a * (l01_a + l12_a);

      x1 = (x1 * a - p0[0] * l12_2a + p2[0] * l01_2a) / n;
      y1 = (y1 * a - p0[1] * l12_2a + p2[1] * l01_2a) / n;
    }
    if (p3 && l23_a > EPS) {
      const b = 2 * l23_2a + 3 * l23_a * l12_a + l12_2a;
      const m = 3 * l23_a * (l23_a + l12_a);

      x2 = (x2 * b + p1[0] * l23_2a - p3[0] * l12_2a) / m;
      y2 = (y2 * b + p1[1] * l23_2a - p3[1] * l12_2a) / m;
    }
    out.push([p1[0], p1[1], x1, y1, x2, y2, p2[0], p2[1]]);
  }

  return out;
}

/** The pieces of d3.curveBasis through three or more points: a line, curves, a line (as pieces: each a cubic, a line is a flat cubic). */
export function basisCurve(pts: readonly Point[]): Bezier[] {
  const out: Bezier[] = [];
  const line = (a: Point, b: Point): Bezier => [a[0], a[1], a[0], a[1], b[0], b[1], b[0], b[1]];

  if (pts.length < 3) return pts.length === 2 ? [line(pts[0], pts[1])] : out;

  let [x0, y0] = pts[0];
  let [x1, y1] = pts[1];
  let cur: Point = [x0, y0];
  const knot = (x: number, y: number) => {
    const to: Point = [(x0 + 4 * x1 + x) / 6, (y0 + 4 * y1 + y) / 6];

    out.push([cur[0], cur[1], (2 * x0 + x1) / 3, (2 * y0 + y1) / 3, (x0 + 2 * x1) / 3, (y0 + 2 * y1) / 3, to[0], to[1]]);
    cur = to;
    [x0, y0, x1, y1] = [x1, y1, x, y];
  };
  const first: Point = [(5 * x0 + x1) / 6, (5 * y0 + y1) / 6];

  out.push(line(cur, first));
  cur = first;
  for (let i = 2; i < pts.length; i++) knot(pts[i][0], pts[i][1]);
  knot(x1, y1);
  out.push(line(cur, [x1, y1]));

  return out;
}

/** `n + 1` points at equal steps along the length of a chain of cubic curves. */
export function sampleCurves(curves: readonly Bezier[], n: number, flatten = 48): Point[] {
  const poly: Point[] = [];
  const cum: number[] = [0];

  curves.forEach((c, ci) => {
    for (let s = ci === 0 ? 0 : 1; s <= flatten; s++) poly.push(bezierAt(c, s / flatten));
  });
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));

  const total = cum[cum.length - 1];
  const out: Point[] = [];
  let j = 1;

  for (let i = 0; i <= n; i++) {
    const at = (total * i) / n;

    while (j < poly.length - 1 && cum[j] < at) j++;

    const span = cum[j] - cum[j - 1];
    const w = span > 0 ? clamp((at - cum[j - 1]) / span) : 0;

    out.push([lerp(poly[j - 1][0], poly[j][0], w), lerp(poly[j - 1][1], poly[j][1], w)]);
  }

  return out;
}

/** The trail as `n + 1` points at equal steps along a smooth curve through `points` (heights are 0 until set). */
export function sampleTrail(points: readonly Point[], n: number = TRAIL_STEPS): TrailPoint[] {
  return sampleCurves(catmullRom(points), n).map(([x, y]) => ({ x, y, n: 0 }));
}

/** The dotted part ahead: from where the trail ends, bending up and left, to the summit. */
export function aheadTrail(end: Point, summit: Point, n: number = AHEAD_STEPS): TrailPoint[] {
  const mid: Point = [(end[0] + summit[0]) / 2 - 20, (end[1] + summit[1]) / 2 - 22];

  return sampleCurves(basisCurve([end, mid, summit]), n).map(([x, y]) => ({ x, y, n: 0 }));
}

/** The place `u` (0 to 1) of the way along sampled points, between neighbours. */
export function trailAt(samples: readonly TrailPoint[], u: number): TrailPoint {
  const last = samples.length - 1;
  const f = clamp(u) * last;
  const i = Math.min(last - 1, Math.floor(f));
  const w = f - i;
  const a = samples[i];
  const b = samples[i + 1];

  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), n: lerp(a.n, b.n, w) };
}
