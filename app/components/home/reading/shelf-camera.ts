import { clamp, flick } from "./shelf-math";
import type { ShelfState } from "./shelf-open";
import type { Animate } from "./shelf-pose";

/**
 * One frame of the shelf's camera along the row: it eases to a target the keyboard chose (`camTarget`) and coasts after a flick
 * (`flickV`; a touch, an arrow key or an open book ends it, and an end of the shelf stops it). True while it is still moving, so the
 * frame is drawn.
 */
export function stepCamera(
  st: ShelfState,
  cam: { x: number; xV: number },
  maxX: number,
  animate: Animate,
  dt: number,
): boolean {
  let busy = false;
  if (st.camTarget !== null) {
    if (animate(cam, "x", st.camTarget, 7, dt)) busy = true;
    else st.camTarget = null;
  }
  if (st.flickV !== 0) {
    const f = st.opened || st.down ? { dx: 0, v: 0 } : flick(st.flickV, dt);
    const x = clamp(cam.x + f.dx, -maxX, maxX);
    st.flickV = x === cam.x + f.dx ? f.v : 0;
    cam.x = x;
    busy = true;
  }
  return busy;
}
