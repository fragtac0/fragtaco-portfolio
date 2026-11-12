import { columnOffset } from "./wall-math";
import type { WallState } from "./wall-types";

/**
 * How the wall moves between frames: the clock the columns drift by, the sideways pan, the
 * inertia of a drag that was let go, and the pan that keeps the keyboard's tile in view. It all
 * settles while you look at something (the pointer is over a tile, the keyboard is on one) and
 * stops dead while a video is chosen (the tiles are spread around it and must not move), then
 * drifts on again, gently.
 */

/** Pixels the whole wall pans sideways per second. */
const DRIFT = 3;

export type Motion = {
  /** Advances the wall by `dt` seconds. */
  step(dt: number, hovering: boolean): void;
};

export function createMotion(st: WallState, reduced: boolean): Motion {
  const { pan, vel } = st;
  let speedMul = 1;
  return {
    step(dt, hovering) {
      if (st.choice) {
        speedMul = 0;
        vel.x = vel.y = 0;
        return;
      }
      const { vw, vh, size } = st;
      const { cw, ch, pitchX, pitchY } = size;
      speedMul += ((hovering || st.kbd !== null ? 0 : 1) - speedMul) * Math.min(1, dt * 2.5);
      if (!reduced) st.t += dt * speedMul;
      if (!st.dragging) {
        pan.x += vel.x * dt;
        pan.y += vel.y * dt;
        const k = Math.pow(0.05, dt);
        vel.x *= k;
        vel.y *= k;
      }
      if (!reduced) pan.x += DRIFT * dt * speedMul;
      if (st.kbd) {
        // the keyboard focus pans the wall just far enough to keep its tile in view
        const k = Math.min(1, dt * 6);
        const xc = st.kbd.cx * pitchX - pan.x + cw / 2;
        const yc = st.kbd.cy * pitchY - pan.y - columnOffset(st.t, st.kbd.cx) + ch / 2;
        const mx = Math.min(pitchX * 0.75, vw / 2);
        const my = Math.min(Math.max(pitchY * 0.75, 120), vh / 2);
        pan.x += (xc < mx ? xc - mx : xc > vw - mx ? xc - (vw - mx) : 0) * k;
        pan.y += (yc < my ? yc - my : yc > vh - my ? yc - (vh - my) : 0) * k;
      }
    },
  };
}
