// The journey on the map (spec 9.3): the route as one curve in picture pixels, and where each moment sits on it
// with the side its label takes. Pure maths, no DOM, no clock ("today" is passed in).
import type { Frame, LonLat, Point } from "./geo";
import { momentPositions, routeCurve } from "./route";

export type Placement = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type JourneyMoment = {
  id: string;
  /** Picture pixels (top level). */
  x: number;
  y: number;
  /** How far along the route, 0 to 1. */
  s: number;
  /** Which side of the dot the year (overview) and the card (explore) sit on. */
  placement: Placement;
  /** What the overview shows beside the dot: the year, or the moment's own label for "now". */
  year: string;
};

export type Journey = {
  /** The route as an SVG path in picture pixels. */
  d: string;
  /** Its length in picture pixels. */
  length: number;
  moments: JourneyMoment[];
  /** The route's last point: where the ping is. */
  end: Point;
};

type MomentInput = { id: string; date: string; label: string };

/** How far each side of a moment (as a share of the route) the direction of the line is read from. */
const TANGENT_SPAN = 0.004;

/**
 * The side a label takes: opposite sides for neighbours, so two moments close together along the line do not
 * put their words on each other; above and below where the line runs more across than up, left and right
 * where it runs more up than across.
 */
export function placementFor(index: number, tangent: Point): Placement {
  const flip = index % 2 === 1;

  if (Math.abs(tangent.x) >= Math.abs(tangent.y)) return flip ? "s" : "n";

  return flip ? "w" : "e";
}

/** Screen px: the year's pill is about this big, and a dot (with its ring) this far across. */
const LABEL = { w: 42, h: 18, gap: 12, diag: 8, dot: 7, pad: 1 };
/** The scale (screen px per picture px) the labels are fitted for: a 360 px wide phone's overview, about the tightest in use. */
export const LABEL_SCALE = 0.048;

export type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Where a box of `w` by `h` screen px sits relative to its dot for a side (the CSS in map-layers.css puts a year's
 * pill and a card the same way: 12 px off the dot on the four sides, 8 px on the diagonals).
 */
export function sideRect(side: Placement, w: number, h: number = LABEL.h): Rect {
  const g = LABEL.gap;

  if (side === "n") return { x0: -w / 2, x1: w / 2, y0: -g - h, y1: -g };
  if (side === "s") return { x0: -w / 2, x1: w / 2, y0: g, y1: g + h };
  if (side === "e") return { x0: g, x1: g + w, y0: -h / 2, y1: h / 2 };
  if (side === "w") return { x0: -g - w, x1: -g, y0: -h / 2, y1: h / 2 };
  const d = LABEL.diag;
  const x = side === "ne" || side === "se" ? { x0: d, x1: d + w } : { x0: -d - w, x1: -d };

  return side === "ne" || side === "nw" ? { ...x, y0: -d - h, y1: -d } : { ...x, y0: d, y1: d + h };
}

/** A year's pill and the dot's disc as screen rectangles for a moment at picture pixel `p` and `scale` (the audit and the tests use these too). */
export function labelBox(p: Point, side: Placement, year: string, scale: number): Rect {
  const r = sideRect(side, year.length * 7.2 + 12);

  return { x0: p.x * scale + r.x0, x1: p.x * scale + r.x1, y0: p.y * scale + r.y0, y1: p.y * scale + r.y1 };
}
export const dotBox = (p: Point, scale: number): Rect => ({ x0: p.x * scale - LABEL.dot, x1: p.x * scale + LABEL.dot, y0: p.y * scale - LABEL.dot, y1: p.y * scale + LABEL.dot });

export const hits = (a: Rect, b: Rect) => a.x0 < b.x1 + LABEL.pad && b.x0 < a.x1 + LABEL.pad && a.y0 < b.y1 + LABEL.pad && b.y0 < a.y1 + LABEL.pad;

/**
 * Choose each label's side so that no year's pill sits on another pill or on any dot at the overview of a phone
 * (`LABEL_SCALE`; a bigger screen only has more room). The preferred side (`placementFor`) is tried first for each
 * moment, then the others (the four diagonals last), searching for the first set that clears everything; if none does, the preferred sides stay.
 * `points` are in picture pixels, `years` the label texts.
 */
export function chooseSides(points: readonly Point[], preferred: readonly Placement[], years: readonly string[], scale = LABEL_SCALE): Placement[] {
  const all: Placement[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const chosen: Placement[] = [];
  const rects: Rect[] = [];

  const search = (i: number): boolean => {
    if (i === points.length) return true;

    for (const side of [preferred[i], ...all.filter((s) => s !== preferred[i])]) {
      const box = labelBox(points[i], side, years[i], scale);

      if (points.some((q, j) => j !== i && hits(box, dotBox(q, scale))) || rects.some((other) => hits(box, other))) continue;
      chosen[i] = side;
      rects[i] = box;
      if (search(i + 1)) return true;
    }
    chosen.length = i;
    rects.length = i;

    return false;
  };

  return search(0) ? chosen : [...preferred];
}

export function yearOf(moment: MomentInput): string {
  return moment.date === "now" ? moment.label : moment.date.slice(0, 4);
}

export function buildJourney(route: readonly LonLat[], moments: readonly MomentInput[], today: string, frame: Frame): Journey {
  const curve = routeCurve(route, frame);
  const positions = momentPositions(moments, today);
  const end = curve.at(1);
  const spots = moments.map((moment, i) => {
    const s = positions[i];
    const p = curve.at(s);
    const a = curve.at(Math.max(0, s - TANGENT_SPAN));
    const b = curve.at(Math.min(1, s + TANGENT_SPAN));

    return { id: moment.id, x: p.x, y: p.y, s, preferred: placementFor(i, { x: b.x - a.x, y: b.y - a.y }), year: yearOf(moment) };
  });
  const sides = chooseSides(spots, spots.map((m) => m.preferred), spots.map((m) => m.year));

  return {
    d: curve.d,
    length: curve.length,
    end,
    moments: spots.map((m, i) => ({ id: m.id, x: m.x, y: m.y, s: m.s, year: m.year, placement: sides[i] })),
  };
}

/** The next moment from the one now active (`null` is none yet): `]` from none is the first, `[` from none the last. Stops at the ends. */
export function stepMoment(active: number | null, dir: -1 | 1, count: number): number {
  if (count <= 0) return 0;
  if (active === null) return dir === 1 ? 0 : count - 1;

  return Math.min(count - 1, Math.max(0, active + dir));
}
