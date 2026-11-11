// The maths of the picked-view travel (FLIP: first, last, invert, play). No DOM, safe on the server.

export interface FlipRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type FlipFade = "in" | "out";

export interface FlipPlan {
  keyframes: Keyframe[];
  duration: number;
  delay: number;
  easing: string;
}

/** Each item's move: 600 ms with a slight overshoot, 12 ms after the one before it. */
export const TRAVEL_MS = 600;
export const STAGGER_MS = 12;
export const TRAVEL_EASE = "cubic-bezier(0.2, 1.2, 0.3, 1)";
/** Reduced motion: no travel, a plain crossfade. */
export const REDUCED_MS = 150;
/** An item that has to appear or vanish with no place to travel from or to. */
const FADE_MS = 400;
/** Items further than this outside the screen at both ends are not animated at all. */
const NEAR = 120;

const centre = (r: FlipRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** True when the rect has any area (a hidden or removed element measures zero). */
export function hasArea(r: FlipRect): boolean {
  return r.width > 0 && r.height > 0;
}

/** True when the rect is on the screen or within `NEAR` px of it. */
export function nearScreen(r: FlipRect, vw: number, vh: number): boolean {
  return r.left + r.width > -NEAR && r.left < vw + NEAR && r.top + r.height > -NEAR && r.top < vh + NEAR;
}

/**
 * How to move an element from where it was (`from`) to where it is now (`to`): it starts out
 * shifted and scaled to look as it did, and settles into its new place. Both are about its centre,
 * which is what the CSS `translate` and `scale` properties use, so they compose with the ring's
 * own `rotate` animation. Returns null when there is nothing to show.
 *  - `fade` "in": it was not there (hidden before): fade in at its new place.
 *  - `fade` "out": it is not there any more: fade out where it was.
 *  - reduced motion: a short crossfade, no travel.
 */
export function planFlip(
  from: FlipRect,
  to: FlipRect,
  o: { index: number; reduced: boolean; vw: number; vh: number; fade?: FlipFade },
): FlipPlan | null {
  const delay = Math.max(0, o.index) * STAGGER_MS;
  const seen = (hasArea(from) && nearScreen(from, o.vw, o.vh)) || (hasArea(to) && nearScreen(to, o.vw, o.vh));
  if (!seen) return null;

  if (o.reduced) {
    return o.fade === "out"
      ? { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: REDUCED_MS, delay: 0, easing: "ease-out" }
      : { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: REDUCED_MS, delay: 0, easing: "ease-out" };
  }

  const a = centre(from);
  const b = centre(to);
  const shift = `${(a.x - b.x).toFixed(2)}px ${(a.y - b.y).toFixed(2)}px`;

  if (o.fade) {
    // It stays where it was (or where it will be) while it fades: a constant shift.
    const hold = hasArea(from) && hasArea(to) ? shift : "0px 0px";
    const frames: Keyframe[] =
      o.fade === "in"
        ? [{ opacity: 0, translate: "0px 0px" }, { opacity: 1, translate: "0px 0px" }]
        : [
            { opacity: 1, translate: hold, visibility: "visible" },
            { opacity: 0, translate: hold, visibility: "visible" },
          ];
    return { keyframes: frames, duration: FADE_MS, delay, easing: "ease-out" };
  }

  if (!hasArea(from) || !hasArea(to)) return null;

  const sx = from.width / to.width;
  const sy = from.height / to.height;
  const still = Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01;
  if (still) return null;

  return {
    keyframes: [
      { translate: shift, scale: `${sx.toFixed(4)} ${sy.toFixed(4)}` },
      { translate: "0px 0px", scale: "1 1" },
    ],
    duration: TRAVEL_MS,
    delay,
    easing: TRAVEL_EASE,
  };
}
