// Pure maths for the /work rings (spec 6.2). No DOM, safe on the server.
//
// One stack ring and up to four video rings round the intro, evenly spaced from the stack ring out to
// a last ring at 0.92 of the screen's half-diagonal (so the outer rings pass through the corners and
// run off the edges). Every video tile has the same long side L. Items are upright rectangles on
// rings that turn at different speeds, so two of them can meet at any angle. They never overlap if
// their centres stay at least `clear(a, b)` apart: if both sides of the gap rule were short, the
// centres would be closer than the diagonal `sqrt(sx^2 + sy^2)` that this function returns.

export type Size = { w: number; h: number };
export type RingKind = "stack" | "long" | "short";
export type RingOrderMode = "alternating" | "paired";

/** Long, short, long, short from the inside (the other value is long, long, short, short). */
export const RING_ORDER_MODE: RingOrderMode = "alternating";

/** The least space kept between any two items. */
export const GAP = 12;
/** A video tile's short side over its long side (16 by 9). */
export const TILE_ASPECT = 9 / 16;
/** The video tile's long side L runs from this to that. */
export const L_MIN = 96;
export const L_MAX = 220;
/** Below this a screen is too small for any plan (L never goes lower, whatever the clearance). */
const L_FLOOR = 8;
/** The outermost ring's radius as a share of the half-diagonal. */
export const OUTER_SHARE = 0.92;
/** Seconds for one turn: the stack ring, then each video ring outward. */
export const STACK_PERIOD = 90;
export const VIDEO_PERIODS: readonly number[] = [150, 190, 230, 270];
/** How far the stack ring's icons stay inside the screen's sides. */
const EDGE_MARGIN = 4;
const PHONE_WIDTH = 700;

/** Least distance between the centres of two upright rectangles for them to stay `gap` apart at any angle. */
export function clear(a: Size, b: Size, gap = GAP): number {
  const sx = (a.w + b.w) / 2 + gap;
  const sy = (a.h + b.h) / 2 + gap;
  return Math.sqrt(sx * sx + sy * sy);
}

/** The stack icons' side: 60 px, 52 px under 700 px wide. */
export function stackIconSize(vw: number): number {
  return vw < PHONE_WIDTH ? 52 : 60;
}

/**
 * The stack ring's radius: `min(max(190, 0.24 vh), 0.42 vw)`, and never so wide that its icons leave the
 * screen's sides (that only moves it on screens under about 375 px wide).
 */
export function stackRadius(vw: number, vh: number): number {
  const icon = stackIconSize(vw);
  return Math.min(Math.max(190, 0.24 * vh), 0.42 * vw, vw / 2 - icon / 2 - EDGE_MARGIN);
}

export function halfDiagonal(vw: number, vh: number): number {
  return Math.hypot(vw, vh) / 2;
}

/** A video tile with long side `L`: long form is wide, short form is tall. */
export function tileSize(kind: "long" | "short", L: number): Size {
  const short = L * TILE_ASPECT;
  return kind === "long" ? { w: L, h: short } : { w: short, h: L };
}

/** The kinds of the video rings, inside to outside. With two rings: long inside, short outside, in either mode. */
export function ringKinds(count: number, mode: RingOrderMode): ("long" | "short")[] {
  const n = Math.max(0, Math.floor(count));
  const longRings = mode === "paired" && n > 2 ? Math.ceil(n / 2) : -1;
  return Array.from({ length: n }, (_, i) =>
    longRings >= 0 ? (i < longRings ? "long" : "short") : i % 2 === 0 ? "long" : "short",
  );
}

/** Most items of one size that fit round a ring so that neighbours (the chord between them) meet `clear`. */
export function ringCapacity(radius: number, size: Size): number {
  const need = clear(size, size);
  if (!(radius > 0) || need >= 2 * radius) return 1;
  let n = Math.floor(Math.PI / Math.asin(need / (2 * radius)));
  while (n > 1 && 2 * radius * Math.sin(Math.PI / n) < need) n--; // guard against rounding
  return Math.max(1, n);
}

/**
 * The largest L, whole pixels from `L_MAX` down to `lowest`, for which every pair of rings (the stack
 * ring included) has radii at least `clear` apart, or null if none does.
 */
function largestFit(kinds: ("long" | "short")[], step: number, stack: Size, lowest: number): number | null {
  for (let L = L_MAX; L >= lowest; L--) {
    const sizes = [stack, ...kinds.map((k) => tileSize(k, L))];
    let ok = true;
    for (let i = 0; i < sizes.length && ok; i++) {
      for (let j = i + 1; j < sizes.length && ok; j++) {
        ok = (j - i) * step >= clear(sizes[i], sizes[j]);
      }
    }
    if (ok) return L;
  }
  return null;
}

/** Share `total` items out over rings in proportion to their capacity (never over it), largest remainder first. */
function apportion(total: number, capacities: number[]): number[] {
  const sum = capacities.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return capacities.map(() => 0);
  const exact = capacities.map((c) => (total * c) / sum);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((x, i) => i).sort((a, b) => exact[b] - counts[b] - (exact[a] - counts[a]));
  for (const i of byRemainder) {
    if (left <= 0) break;
    counts[i]++;
    left--;
  }
  return counts;
}

export interface PlannedRing {
  id: string;
  kind: RingKind;
  radius: number;
  count: number;
  size: Size;
  periodS: number;
  dir: 1 | -1;
}

export interface RingPlan {
  /** The video tiles' long side. */
  L: number;
  /** Rings with items, inside to outside: the stack ring first. */
  rings: PlannedRing[];
  /** Videos that fit in no ring, per kind (the last ones in content order). */
  hidden: { long: number; short: number };
}

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * The rings for a screen and item counts. The number of video rings is 4 if `L` can be 96 or more with
 * the clearance rule holding between every pair of rings, else 3, else 2 (then `L` may fall below 96, on
 * screens under about 360 px wide, because clearance wins). Each kind's items fill its rings from the
 * inside out, shared out by capacity; the first items in content order are kept.
 */
export function ringPlan(
  vw: number,
  vh: number,
  counts: { stack: number; long: number; short: number },
  mode: RingOrderMode = RING_ORDER_MODE,
): RingPlan {
  const icon = stackIconSize(vw);
  const stackSize: Size = { w: icon, h: icon };
  const inner = stackRadius(vw, vh);
  const outer = Math.max(inner, OUTER_SHARE * halfDiagonal(vw, vh));

  let kinds = ringKinds(4, mode);
  let step = (outer - inner) / 4;
  let L: number | null = null;
  for (const n of [4, 3, 2]) {
    kinds = ringKinds(n, mode);
    step = (outer - inner) / n;
    L = largestFit(kinds, step, stackSize, n === 2 ? L_FLOOR : L_MIN);
    if (L !== null) break;
  }
  const fit = L ?? L_FLOOR;

  const rings: PlannedRing[] = [];
  const stackCount = Math.min(whole(counts.stack), ringCapacity(inner, stackSize));
  if (stackCount > 0) {
    rings.push({ id: "stack", kind: "stack", radius: inner, count: stackCount, size: stackSize, periodS: STACK_PERIOD, dir: 1 });
  }

  const hidden = { long: 0, short: 0 };
  for (const kind of ["long", "short"] as const) {
    const slots = kinds.map((k, i) => ({ k, i })).filter((s) => s.k === kind);
    const size = tileSize(kind, fit);
    const radii = slots.map((s) => inner + (s.i + 1) * step);
    const caps = radii.map((r) => ringCapacity(r, size));
    const total = whole(counts[kind]);
    const kept = Math.min(total, caps.reduce((a, b) => a + b, 0));
    hidden[kind] = total - kept;

    // the fewest rings from the inside that hold what is kept, so a few items stay near the middle
    let used = 0;
    for (let cap = 0; used < caps.length && cap < kept; used++) cap += caps[used];
    const shared = apportion(kept, caps.slice(0, used));

    shared.forEach((count, k) => {
      if (count === 0) return;
      const i = slots[k].i;
      rings.push({
        id: `${kind}-${k + 1}`,
        kind,
        radius: radii[k],
        count,
        size,
        periodS: VIDEO_PERIODS[i],
        dir: (i + 1) % 2 === 0 ? 1 : -1,
      });
    });
  }

  // inside to outside
  rings.sort((a, b) => a.radius - b.radius);
  return { L: fit, rings, hidden };
}

/** Degrees round a ring, slot 0 at the top, clockwise. */
export function slotAngle(index: number, count: number): number {
  if (!(count > 0)) return -90;
  return (index * 360) / count - 90;
}
