import { clampPan, panRange, pullLimits, restFloat, SOFT_EDGE } from "./wall-block";
import type { WallState } from "./wall-types";

/**
 * How the wall moves between frames: the clock the block floats by, the inertia of a drag that was
 * let go, the pan that keeps the keyboard's tile in view, and the soft stop at the block's edges. The
 * float settles while you look at something (the pointer is over a tile, the keyboard is on one) and
 * everything stops dead while a video is chosen (the tiles are spread around it and must not move).
 *
 * `pan` is where the wall has been pulled to; it may sit up to 80 px past an edge while it is held
 * there, and eases back once it is let go. `view` is what the screen shows: `pan` through the soft stop
 * (`clampPan`), plus the few pixels the block floats at rest.
 */

export type Motion = {
  /** Advances the wall by `dt` seconds. */
  step(dt: number, hovering: boolean): void;
  /** Works `view` out again from `pan` (after a resize or a new pan), without advancing anything. */
  settle(): void;
};

/** Sets `st.view` from `st.pan`: through the soft stop, plus the rest float. */
export function applyView(st: WallState, floating: boolean) {
  const { plan, vw, vh, view, pan } = st;
  const [x, y] = clampPan(pan.x, pan.y, plan, vw, vh);
  const [fx, fy] = floating ? restFloat(st.t) : [0, 0];
  view.x = x + fx;
  view.y = y + fy;
}

export function createMotion(st: WallState, reduced: boolean): Motion {
  const { pan, vel } = st;
  let speedMul = 1;

  /** Holds the pull within its limits, and eases it back from past the edge once it is let go. */
  function holdPan(dt: number) {
    const { plan, vw, vh } = st;
    const lim = pullLimits(plan, vw, vh);
    if (pan.x < lim.x[0] || pan.x > lim.x[1]) vel.x = 0;
    if (pan.y < lim.y[0] || pan.y > lim.y[1]) vel.y = 0;
    pan.x = Math.min(lim.x[1], Math.max(lim.x[0], pan.x));
    pan.y = Math.min(lim.y[1], Math.max(lim.y[0], pan.y));
    if (st.dragging) return;
    const k = reduced ? 1 : Math.min(1, dt * 5);
    const rest = (p: number, size: number, view: number) => {
      const [lo, hi] = panRange(size, view);
      const m = Math.min(SOFT_EDGE, (hi - lo) / 2);
      return Math.min(hi - m, Math.max(lo + m, p));
    };
    pan.x += (rest(pan.x, plan.width, vw) - pan.x) * k;
    pan.y += (rest(pan.y, plan.height, vh) - pan.y) * k;
  }

  return {
    settle: () => applyView(st, !reduced),
    step(dt, hovering) {
      if (st.choice) {
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
      if (st.kbd) {
        // the keyboard focus pans the wall just far enough to keep its tile in view
        const k = Math.min(1, dt * 6);
        const xc = st.kbd.cx * pitchX - st.view.x + cw / 2;
        const yc = st.kbd.cy * pitchY - st.view.y + ch / 2;
        const mx = Math.min(pitchX * 0.75, vw / 2);
        const my = Math.min(Math.max(pitchY * 0.75, 120), vh / 2);
        pan.x += (xc < mx ? xc - mx : xc > vw - mx ? xc - (vw - mx) : 0) * k;
        pan.y += (yc < my ? yc - my : yc > vh - my ? yc - (vh - my) : 0) * k;
      }
      holdPan(dt);
      applyView(st, !reduced);
    },
  };
}
