// Pure maths for the /work rings (spec 6.2). No DOM, safe on the server.
//
// One stack ring and up to four video rings round the intro, packed outward from the stack ring, each as
// close to the one inside it as the clearance rule allows, none beyond 0.92 of the screen's half-diagonal.
// Every video tile has the same long side L, which a screen asks for (`targetL`, R54.2: about 190 px at 1440 by 900) and
// which the plan gets as near to as it can with the most coverage (`coverage`). Items are upright rectangles on
// rings that turn at different speeds, so two of them can meet at any angle. They never overlap if
// their centres stay at least `clear(a, b)` apart: if both sides of the gap rule were short, the
// centres would be closer than the diagonal `sqrt(sx^2 + sy^2)` that this function returns.

import { coverage } from "./ring-coverage";

export { coverage };
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
export const L_MAX = 340;
/** The long side a screen asks for: `TARGET_BASE + TARGET_SLOPE * sqrt(vw * vh)`, 200 px at 1440 by 900 (spec 5: about 190), and on a phone at least `PHONE_SHARE` of its width. */
const TARGET_BASE = 79;
const TARGET_SLOPE = 0.1066;
const PHONE_SHARE = 0.54;
/** A plan may use an L down to this share of the largest one a single video ring could have, to fit more rings. */
const L_WINDOW = 0.9;
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

/** The stack icons' side: 76 px, 56 px under 700 px wide (R54.2; they were 60 and 52). */
export function stackIconSize(vw: number): number {
  return vw < PHONE_WIDTH ? 56 : 76;
}

/** The long side of a video tile that a `vw` by `vh` screen asks for, whole pixels from `L_MIN` to `L_MAX`. */
export function targetL(vw: number, vh: number): number {
  const area = vw > 0 && vh > 0 ? Math.sqrt(vw * vh) : 0;
  // a phone has room for one ring of large tiles, not two of small ones, so its tiles grow more
  const phone = vw > 0 && vw < PHONE_WIDTH ? PHONE_SHARE * Math.min(vw, vh) : 0;
  return Math.min(L_MAX, Math.max(L_MIN, Math.round(Math.max(TARGET_BASE + TARGET_SLOPE * area, phone))));
}

/** The radius of the circle the intro (title and text) must stay inside: the stack ring less its icons and a margin (the CSS `--intro-r`). */
export function introRadius(vw: number, vh: number): number {
  return stackRadius(vw, vh) - stackIconSize(vw) / 2 - 14;
}

/**
 * The stack ring's radius: `min(max(190, 0.24 vh), 0.42 vw)`, and never so wide that its icons leave the
 * screen's sides (that only moves it on screens under about 375 px wide).
 */
export function stackRadius(vw: number, vh: number): number {
  const icon = stackIconSize(vw);
  return Math.min(Math.max(190, 0.24 * vh), 0.42 * vw, vw / 2 - icon / 2 - EDGE_MARGIN);
}

/** The dock's glass as the audit measured it on /work: 448 by 113 px, 24 px above the screen's foot (350 by 93 px, 12 above it, under 640 px wide). */
export function dockBox(vw: number): { width: number; height: number; foot: number } {
  return vw < 640 ? { width: Math.min(350, vw - 20), height: 93, foot: 12 } : { width: 448, height: 113, foot: 24 };
}

/**
 * The ellipse, at the bottom centre of the screen, that the rings fade out in (`.work-rings` mask, the CSS --hole-x and --hole-y): through the
 * corners of the dock's box with 16 px to spare, so no tile shows under the dock's tabs. Its radii are those of the CSS, which
 * has them for the two dock sizes.
 */
export function dockHole(vw: number): { rx: number; ry: number } {
  const { width, height, foot } = dockBox(vw);
  return { rx: Math.round(((width / 2 + 16) * Math.SQRT2)), ry: Math.round((height + foot + 16) * Math.SQRT2) };
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

/** The radii of video rings of `kinds` with long side `L`, each as near the one inside it (the stack ring first) as `clear` allows. */
function packRadii(kinds: ("long" | "short")[], L: number, stack: Size, inner: number): number[] {
  const radii: number[] = [];
  let prev = stack;
  let radius = inner;
  for (const kind of kinds) {
    const size = tileSize(kind, L);
    radius += clear(prev, size);
    radii.push(radius);
    prev = size;
  }
  return radii;
}

/** The largest L, whole pixels from `top` down to `L_MIN`, for which rings of `kinds` pack inside `outer`, with those radii, or null. */
function largestFit(kinds: ("long" | "short")[], stack: Size, inner: number, outer: number, top: number) {
  for (let L = top; L >= L_MIN; L--) {
    const radii = packRadii(kinds, L, stack, inner);
    if (radii[radii.length - 1] <= outer) return { L, radii };
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

type Counts = { stack: number; long: number; short: number };

/** The video rings for `kinds` at long side `L` on `radii`, and the videos left out. Each kind's items fill its rings from the inside out. */
function videoRings(kinds: ("long" | "short")[], radii: number[], L: number, counts: Counts) {
  const rings: PlannedRing[] = [];
  const hidden = { long: 0, short: 0 };
  for (const kind of ["long", "short"] as const) {
    const slots = kinds.map((k, i) => ({ k, i })).filter((s) => s.k === kind);
    const size = tileSize(kind, L);
    const kindRadii = slots.map((s) => radii[s.i]);
    const caps = kindRadii.map((r) => ringCapacity(r, size));
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
        radius: kindRadii[k],
        count,
        size,
        periodS: VIDEO_PERIODS[i],
        dir: (i + 1) % 2 === 0 ? 1 : -1,
      });
    });
  }
  return { rings, hidden };
}

/**
 * The rings for a screen and item counts (R54.2: larger tiles, fewer rings). The screen asks for a long side
 * (`targetL`). For 4, 3, 2 and 1 video rings (long form the inner kind, in both modes), each L from the largest up
 * to that which packs inside the outer ring (the clearance rule holding between every pair of rings, the stack
 * ring included) down to 90% of the best a single ring could have is a plan, and the one with the most `coverage` is returned. L is never below 96 (R34): where no ring packs, none: the stack ring alone, every video then being
 * on the walls. A plan whose scan failed is never returned. Each kind's items fill its rings from the inside out,
 * shared out by capacity; the first items in content order are kept.
 */
export function ringPlan(vw: number, vh: number, counts: Counts, mode: RingOrderMode = RING_ORDER_MODE): RingPlan {
  const icon = stackIconSize(vw);
  const stackSize: Size = { w: icon, h: icon };
  const inner = stackRadius(vw, vh);
  const outer = Math.max(inner, OUTER_SHARE * halfDiagonal(vw, vh));

  // a screen too small (or not a size at all) for even the stack ring: nothing is drawn
  if (!(inner > 0) || !Number.isFinite(outer)) {
    return { L: L_MIN, rings: [], hidden: { long: whole(counts.long), short: whole(counts.short) } };
  }

  const stackRing: PlannedRing[] = [];
  const stackCount = Math.min(whole(counts.stack), ringCapacity(inner, stackSize));
  if (stackCount > 0) {
    stackRing.push({ id: "stack", kind: "stack", radius: inner, count: stackCount, size: stackSize, periodS: STACK_PERIOD, dir: 1 });
  }

  const top = targetL(vw, vh);
  const one = largestFit(ringKinds(1, mode), stackSize, inner, outer, top);
  let best: RingPlan | null = null;
  let bestShare = -1;
  if (one) {
    for (const n of [4, 3, 2, 1]) {
      const kinds = ringKinds(n, mode);
      const fit = largestFit(kinds, stackSize, inner, outer, top);
      if (!fit) continue;
      // every whole L from the largest that packs down to the window, the largest first so a tie goes to larger tiles
      for (let L = fit.L; L >= Math.max(L_MIN, Math.ceil(L_WINDOW * one.L)); L--) {
        const { rings, hidden } = videoRings(kinds, packRadii(kinds, L, stackSize, inner), L, counts);
        const plan: RingPlan = { L, rings: [...stackRing, ...rings].sort((a, b) => a.radius - b.radius), hidden };
        const share = coverage(plan, vw, vh);
        if (share > bestShare + 1e-9) {
          best = plan;
          bestShare = share;
        }
      }
    }
  }
  if (best) return best;
  return { L: L_MIN, rings: stackRing, hidden: { long: whole(counts.long), short: whole(counts.short) } };
}

/** Degrees round a ring, slot 0 at the top, clockwise. */
export function slotAngle(index: number, count: number): number {
  if (!(count > 0)) return -90;
  return (index * 360) / count - 90;
}
