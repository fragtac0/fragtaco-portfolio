/**
 * The pure part of the liquid-glass page change (round 7 follow-ups spec 4, the tenth preview's shader with "Wider" and
 * "Stronger" chosen): where the front is and how hard the picture bends at it, at a given moment of the change. The front
 * crosses the screen from the middle outward: a wide soft edge (a band that is the same width in pixels all the way, as in the
 * preview) that wanders from a circle, a cream glow at its middle, a slightly darker glass, and just at the edge the two pictures
 * bend as though seen through thick glass (the old one pushed outward, the new one inward, red further than blue).
 *
 * Every length here is in "far" units: farthest-corner distances (`ChangePlan.radius`), so the same numbers fit every screen.
 * glass.css draws the early reveal from one number, `--glass-p`, the eased progress, which a CSS animation with the same curve
 * (`GLASS_EASING`) runs; glass-run.ts reads the same clock for the pictures and the bend.
 */

export const GLASS = {
  /** Spec 4: one reveal for every change, 2.5 s (3.5 s before the follow-ups). */
  ms: 2500,
  /** Half-width of the soft edge, as a share of the farthest-corner distance: the same width in pixels at every moment. */
  band: 0.15,
  /** The bend's peak push, as a share of the viewport's height (the preview's 0.03 times its bend of 1.9), ... */
  bendShare: 0.057,
  /** ... capped at this many CSS px. */
  bendMaxPx: 64,
} as const;

/** The bend's peak push in CSS px for a viewport this high: 5.7% of it, rounded, never more than 64 px (51 px at 900). */
export function bendPxFor(viewportHeight: number): number {
  return Math.min(GLASS.bendMaxPx, Math.round(GLASS.bendShare * viewportHeight));
}

/**
 * How far the edge wanders from a circle, in farthest-corner distances (the preview's wander is 0.17 of the screen's height; spec 4
 * rounds it to 12%). The wander is in five or six slow lobes round the front (glass-field.ts), and it turns over the change.
 */
export const WARP = 0.12;

/** The colour split: the rim of the glass pushes red this many times as far as green, and blue this many times. */
export const SPLIT = { r: 1.29, g: 1, b: 0.71 } as const;

/**
 * The change's easing: the painting's own (`sweep` in home/hero/paint-engine.ts and the round 7 preview, ease in and out
 * cubic), as the CSS curve that matches it. The same four numbers as `GLASS_EASING` below.
 */
const CURVE = [0.65, 0, 0.35, 1] as const;
export const GLASS_EASING = `cubic-bezier(${CURVE.join(", ")})`;

/**
 * The push at `x` half-bands from the front, as a share of the peak push: a bell at the front plus a lens term that is odd in `x`
 * (the picture is pushed further outside the front than inside). The tenth preview's `bell * 0.03 + lens * 0.022`, over its 0.03.
 */
export function bendProfile(x: number): number {
  return (Math.exp(-1.6 * x * x) * 0.03 + x * Math.exp(-0.9 * x * x) * 0.022) / 0.03;
}

/** The cream glow's strength at `x` half-bands from the front: a glint at the front and a fainter one at the outer rim. */
export function glowAt(x: number): number {
  return 0.16 * Math.exp(-30 * x * x) + 0.05 * Math.exp(-14 * (x - 0.9) * (x - 0.9));
}

/** How much darker the glass is than the pages either side of it, at `x` half-bands: up to 10%, except at the glint itself. */
export function shadeAt(x: number): number {
  return 0.1 * Math.exp(-1.6 * x * x) * (1 - Math.exp(-30 * x * x));
}

function bezier(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * a * u * u * t + 3 * b * u * t * t + t * t * t;
}

/** cubic-bezier(0.65, 0, 0.35, 1) at time `t` in 0..1, solved by bisection (a 1e-5 error is far below a pixel). */
export function easeGlass(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, CURVE[0], CURVE[2]) < t) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, CURVE[1], CURVE[3]);
}

/**
 * R62: the share of the change's time at which the screen is fully uncovered (the old page is nowhere on it any more, to the last
 * pixel at the farthest corner, with the edge's wander at its worst). With the in-out ease the front spends the last fifth of the
 * time almost still, so a front sized for "has gone the whole way" at the end left the corners clear by about 0.85 while the page
 * stayed frozen for another half second: the front's path is scaled so that it is clear at this share.
 */
export const UNCOVERED_AT = 0.95;

/** Where the front's middle is when the change starts: the outer soft edge (a band, and the wander at its worst, ahead of it) is at the origin. */
export const FRONT_START = -(GLASS.band + WARP);
/** Where the front's middle is when the farthest corner is fully the new page: a band and the wander past it. */
export const FRONT_CLEAR = 1 + GLASS.band + WARP;
/** How far the front's middle travels over the whole eased progress (0 to 1), so that it reaches `FRONT_CLEAR` at `UNCOVERED_AT`. */
export const SPAN = (FRONT_CLEAR - FRONT_START) / easeGlass(UNCOVERED_AT);

/**
 * The numbers glass.css needs, as the custom properties page-change.ts puts on <html> while a change runs, so the plain
 * reveal and the pictures come from one place (`GLASS`, `WARP`, `FRONT_START`, `SPAN`, `GLASS_EASING`):
 * `band` the half-width of the soft edge, `warp` the wander, `start` and `span` the front's path (the middle is at
 * `start + span * p` farthest-corner distances at eased progress `p`).
 */
export function glassVars(): Record<string, string> {
  const n = (v: number) => String(+v.toFixed(6));
  return {
    "--change-band": n(GLASS.band),
    "--change-warp": n(WARP),
    "--change-start": n(FRONT_START),
    "--change-span": n(SPAN),
    "--change-ease": GLASS_EASING,
  };
}

/** The slice of a change plan the front needs (page-change.ts's `ChangePlan` has this field). */
export interface FrontPlan {
  /** Distance from the origin to the farthest corner. */
  radius: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The bend's strength at eased progress `p`: starting while the front is still behind the middle (from 0.05, where its middle is
 * 0.19 of a farthest-corner distance behind it, the outer part of the glass is already over the middle), up to 1 by 0.15, held
 * while the front crosses the screen, and down to 0 from 0.93 on.
 */
export const bendAt = (p: number) => smooth(0.05, 0.15, p) * (1 - smooth(0.93, 1, p));

export interface Front {
  /** The front's middle, in px from the origin: negative until the soft edge's first pixel has left it, up to past the farthest corner. */
  radius: number;
  /** How far out the first pixel of the soft edge has got, in px (the radius plus the band and the wander at their worst; 0 at the start). */
  opening: number;
  /** 0 to 1. */
  bend: number;
}

/**
 * Where the front is, and how strong the bend is, `t` of the way through the change (0..1, time).
 * At `t = 0` the outer soft edge is at the origin (`opening` 0, the middle behind it); the farthest corner is fully the new page
 * from `UNCOVERED_AT`. The middle is negative at first; a drawing clamps it (glass.css and glass-run.ts only draw a circle once
 * it is positive).
 */
export function frontAt(t: number, plan: FrontPlan): Front {
  const p = easeGlass(t);
  const radius = plan.radius * (FRONT_START + p * SPAN);
  return { radius, opening: radius + (GLASS.band + WARP) * plan.radius, bend: bendAt(p) };
}

/** The bend (an SVG displacement filter on the view transition's pictures) is only used in Chromium browsers; others get the reveal and the line alone. */
export const isChromium = (userAgent: string) => /Chrome\/\d/.test(userAgent);

/** What the glass check sees of the CSS animation that runs `--glass-p`, on one animation frame. */
export interface GlassSight {
  /** Animation frames since the change began. */
  frames: number;
  /** Is the `glass-p` animation in `document.getAnimations()`? */
  found: boolean;
  /** Its `currentTime` in ms, or null before it has started. */
  timeMs: number | null;
  /** Its eased progress (0 to 1) from its timing, or null if unreadable. */
  progress: number | null;
  /** `--glass-p` as the computed style of the pseudo-element gives it, or null when empty or not a number (WebKit may give none). */
  computed: number | null;
}

/** How many animation frames the animation gets to appear in the list (about a sixth of a second). */
export const SIGHT_FRAMES = 10;

/**
 * Whether the glass reveal is really running: `ok`, `fallback` (the plain crossfade takes over) or `wait` (ask again next
 * frame). Frame-based, not wall-clock. It falls back only if the animation never shows up in the list, or it has
 * advanced and still has no progress, or the style says 0 while the animation has clearly progressed (5% or more) (a browser that runs
 * the animation but does not apply the property). An empty or unreadable computed value does not count against it.
 */
export function judgeGlass(s: GlassSight): "ok" | "fallback" | "wait" {
  if (!s.found) return s.frames >= SIGHT_FRAMES ? "fallback" : "wait";
  if (s.timeMs === null || s.timeMs < 16 || s.frames < 2) return "wait"; // not advanced yet
  if (s.progress !== null && s.progress <= 0) return "fallback";
  // too early in the easing to tell a style of 0 from a style that has not moved yet: ask again
  if (s.progress !== null && s.progress < 0.05) return "wait";
  if (s.computed !== null && s.computed <= 0 && (s.progress !== null || s.timeMs > 100)) return "fallback";
  return "ok";
}
