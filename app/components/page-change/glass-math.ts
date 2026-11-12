/**
 * The pure part of the liquid-glass page change (spec 5): where the front is and how hard the picture
 * bends at it, at a given moment of the change. The front crosses the screen the way the painting's
 * front does in `home/hero/paint-shaders.ts`: a soft edge about 7% of the travel wide, and just at the
 * edge the picture bends as though seen through thick glass.
 *
 * glass.css draws the reveal and the line from one number, `--glass-p`, the eased progress, which a CSS
 * animation with the same curve (`GLASS_EASING`) runs; this module computes the same front for the bend.
 */

export const GLASS = {
  radialMs: 560,
  linearMs: 480,
  /** Half-width of the soft front, as a share of the travel (the radius, or the screen width). */
  band: 0.07,
  /** How far the picture is pushed at the strongest, in CSS px. */
  bendPx: 22,
} as const;

/** How far the displacement map reaches past the front, in half-bands (a Gaussian of one half-band is 0.01 at three). */
export const REACH = 3;

/**
 * How far the front's edge wanders from a perfect circle or line, as a share of the travel (the radius, or the
 * screen width). The painting wanders 17% of its half-diagonal; the page change keeps it subtle.
 */
export const WARP = 0.03;

/** The change's easing, spec 5.1. The same four numbers as `GLASS_EASING` below. */
const CURVE = [0.3, 0.7, 0.2, 1] as const;
export const GLASS_EASING = `cubic-bezier(${CURVE.join(", ")})`;

/**
 * The numbers glass.css needs, as the custom properties page-change.ts puts on <html> while a change runs, so the
 * mask, the line and the bend map all come from one place (`GLASS`, `WARP`, `REACH`, `GLASS_EASING`):
 * `lead` is how far past the screen the front's soft edge and wander must go to start and end off it; `span` the
 * travel of a linear front in widths; `travel` the radial front's final radius in farthest-corner distances;
 * `reach` how far the pictures reach past the front, in fronts (radial) or one plus widths (linear).
 */
export function glassVars(): Record<string, string> {
  const lead = GLASS.band + WARP;
  const n = (v: number) => String(+v.toFixed(6));
  return {
    "--change-band": n(GLASS.band),
    "--change-warp": n(WARP),
    "--change-lead": n(lead),
    "--change-span": n(1 + 2 * lead),
    "--change-travel": n(1 / (1 - lead)),
    "--change-reach": n(1 + REACH * GLASS.band),
    "--change-ease": GLASS_EASING,
  };
}

/** The slice of a change plan the front needs (page-change.ts's `ChangePlan` has these fields). */
export interface FrontPlan {
  kind: string;
  /** Distance from the origin to the farthest corner. */
  radius: number;
  /** Viewport width: the travel of a linear sweep. */
  width: number;
}

function bezier(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * a * u * u * t + 3 * b * u * t * t + t * t * t;
}

/** cubic-bezier(0.3, 0.7, 0.2, 1) at time `t` in 0..1, solved by bisection (a 1e-5 error is far below a pixel). */
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

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The bend's strength at eased progress `p`: up to 1 by 15%, held, and down to 0 from 80% on (as the painting's `s`). */
export const bendAt = (p: number) => smooth(0, 0.15, p) * (1 - smooth(0.8, 1, p));

export interface Front {
  /** Radial kinds: the radius of the front's middle, from 0 to just past the farthest corner. */
  radius?: number;
  /** Linear kinds: how far the front's middle has travelled from the edge it starts at, from just off the screen to just past the far edge. */
  pos?: number;
  /** 0 to 1. */
  bend: number;
}

/**
 * Where the front is, and how strong the bend is, `t` of the way through the change (0..1, time).
 * The radial front ends when the opaque side of its soft, wandering edge (radius times 1 minus the band and the
 * wander) has passed the farthest corner; the linear one, when the same has left the far side.
 */
export function frontAt(t: number, plan: FrontPlan): Front {
  const p = easeGlass(t);
  const bend = bendAt(p);
  const lead = GLASS.band + WARP;
  if (plan.kind === "radial") return { radius: (p * plan.radius) / (1 - lead), bend };
  return { pos: (-lead + p * (1 + 2 * lead)) * plan.width, bend };
}

/** The bend (an SVG displacement filter on the view transition's pictures) is only used in Chromium browsers; others get the reveal and the line alone. */
export const isChromium = (userAgent: string) => /Chrome\/\d/.test(userAgent);
