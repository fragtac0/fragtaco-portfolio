import { clamp, flick, initialCamX, NARROW_PX } from "./shelf-math";
import { stageSize } from "./shelf-frame";
import type { ShelfCtx, ShelfState } from "./shelf-open";
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

/**
 * The camera where a run starts: the books stand in place, a narrow stage at its left end. Also where the docked shelf is framed ahead
 * (shelf-prefit.ts), because the box framing follows the camera: a framing made with the camera elsewhere is another picture of the row.
 */
export function homeCamera(ctx: ShelfCtx): void {
  const gl = ctx.scene();
  if (!gl) return;
  ctx.cam.x = initialCamX(gl.maxX, stageSize(ctx.canvas, ctx.box)[0] < NARROW_PX);
  ctx.cam.xV = ctx.st.flickV = 0;
}
