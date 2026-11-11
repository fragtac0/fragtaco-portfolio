import { PLANE, parallaxShift } from "./wall-math";
import { planeOfKey } from "./wall-planes";

/**
 * The wall's lean against the pointer. The pointer position the lean comes from eases toward its
 * target (`1 - exp(-dt * 6)`), so the wall never jumps when the pointer does. With a mouse the
 * target is the pointer; on a phone it comes from the drag's velocity (not the gyroscope): a drag
 * to the left leans the wall as if the pointer were at the left. Under reduced motion there is none.
 */

/** Pan speed, px per second, at which a drag leans the wall as far as the pointer at the screen edge would. */
const FULL_LEAN_SPEED = 1200;
/** How quickly the lean follows its target, per second. */
const EASE_RATE = 6;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Moves `current` toward `target` by `1 - exp(-dt * rate)` of the gap; a bad `dt` leaves it be. */
export function easeToward(current: number, target: number, dt: number, rate = EASE_RATE): number {
  if (!(dt > 0) || !Number.isFinite(target)) return current;
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}

/**
 * The pointer position a drag stands in for. `vel` is the wall's pan velocity, which points away
 * from the finger's movement, so the stand-in is on the side the finger moves toward: still means the
 * middle of the screen, a fast drag the edge.
 */
export function touchTarget(
  vel: { x: number; y: number },
  vw: number,
  vh: number,
): { x: number; y: number } {
  const nx = Number.isFinite(vel.x) ? clamp(vel.x / FULL_LEAN_SPEED, -1, 1) : 0;
  const ny = Number.isFinite(vel.y) ? clamp(vel.y / FULL_LEAN_SPEED, -1, 1) : 0;
  return { x: (0.5 - nx / 2) * vw, y: (0.5 - ny / 2) * vh };
}

export type Parallax = {
  /** Eases toward `target` (null: no pointer, the middle). */
  update(dt: number, target: { x: number; y: number } | null, vw: number, vh: number): void;
  /** The lean of a plane, in pixels. */
  shift(plane: "near" | "far"): { x: number; y: number };
  /** Moves every tile by the lean of its plane and records the plane on it. */
  lean<T extends { key: string; x: number; y: number; plane?: "near" | "far" }>(tiles: T[]): void;
};

export function createParallax(reduced: boolean): Parallax {
  let vw = 0;
  let vh = 0;
  let ex = Number.NaN;
  let ey = Number.NaN;
  const shift: Parallax["shift"] = (plane) =>
    reduced || Number.isNaN(ex)
      ? { x: 0, y: 0 }
      : parallaxShift({ x: ex, y: ey }, vw, vh, PLANE[plane]);
  return {
    update(dt, target, w, h) {
      if (reduced) return;
      vw = w;
      vh = h;
      if (Number.isNaN(ex)) {
        ex = w / 2;
        ey = h / 2;
      }
      ex = easeToward(ex, target ? target.x : w / 2, dt);
      ey = easeToward(ey, target ? target.y : h / 2, dt);
    },
    shift,
    lean(tiles) {
      const s = { near: shift("near"), far: shift("far") };
      for (const tl of tiles) {
        tl.plane = planeOfKey(tl.key);
        tl.x += s[tl.plane].x;
        tl.y += s[tl.plane].y;
      }
    },
  };
}
