import { describe, expect, it } from "vitest";
import { homeCamera } from "./shelf-camera";
import { newShelfState, type ShelfCtx } from "./shelf-open";

/** A context with a stage of `w` pixels (nothing framed: the canvas's own size) and a scene whose row reaches `maxX` each way. */
function ctxFor(w: number, maxX: number | null, x = 3) {
  const st = newShelfState();
  st.flickV = 9;
  const cam = { x, xV: 4 };
  const ctx = {
    st,
    cam,
    canvas: { clientWidth: w, clientHeight: 600 },
    box: { frame: () => null },
    scene: () => (maxX === null ? null : { maxX }),
  } as unknown as ShelfCtx;
  return { ctx, cam, st };
}

describe("the camera where a run starts", () => {
  it("is the row's middle on a wide stage and its left end on a narrow one, at rest", () => {
    const wide = ctxFor(1440, 6);
    homeCamera(wide.ctx);
    expect(wide.cam).toEqual({ x: 0, xV: 0 });
    expect(wide.st.flickV).toBe(0);
    const narrow = ctxFor(390, 6);
    homeCamera(narrow.ctx);
    expect(narrow.cam).toEqual({ x: -6, xV: 0 });
    expect(narrow.st.flickV).toBe(0);
  });

  it("leaves the camera alone while there is no scene", () => {
    const none = ctxFor(390, null);
    homeCamera(none.ctx);
    expect(none.cam).toEqual({ x: 3, xV: 4 });
    expect(none.st.flickV).toBe(9);
  });
});
