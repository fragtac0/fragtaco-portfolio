import { describe, expect, it } from "vitest";
import { createFrameBox } from "../layer/frame-box";
import type { Frame } from "../layer/frame-math";
import { applyView, dockStage, placeDots } from "./shelf-frame";
import { newShelfState, type ShelfCtx } from "./shelf-open";
import type { ShelfScene } from "./shelf-scene";

const VW = 1440;
const VH = 900;

/** A canvas-like with a style that records what is set and removed. */
function fakeEl() {
  const props = new Map<string, string>();
  const camel = (p: string) => p.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  const own: Record<string, unknown> = {
    removeProperty: (p: string) => void props.delete(camel(p)),
    setProperty: (p: string, v: string) => void props.set(camel(p), v),
  };
  const style = new Proxy(own, {
    get: (t, k: string) => (k in t ? t[k] : props.get(k)),
    set: (_t, k: string, v: string) => (props.set(k, v), true),
  });
  return { el: { style } as unknown as HTMLCanvasElement, props };
}

function setup(frame: Frame | null) {
  const { el } = fakeEl();
  const box = createFrameBox(el);
  box.request(frame);
  box.commit();
  const calls: Array<[string, ...Array<number | boolean>]> = [];
  const gl = {
    renderer: { setSize: (...a: Array<number | boolean>) => calls.push(["setSize", ...a]) },
    camera: {
      setViewOffset: (...a: number[]) => calls.push(["setViewOffset", ...a]),
      clearViewOffset: () => calls.push(["clearViewOffset"]),
      updateProjectionMatrix: () => calls.push(["update"]),
    },
  } as unknown as ShelfScene;
  const ctx = { box, st: newShelfState() } as unknown as ShelfCtx;
  return { ctx, gl, calls };
}

describe("the shelf's view of a frame", () => {
  it("with no frame, the renderer is the stage and the camera is whole", () => {
    const { ctx, gl, calls } = setup(null);
    applyView(ctx, gl, VW, VH);
    expect(calls).toEqual([["setSize", VW, VH, false], ["clearViewOffset"], ["update"]]);
  });

  it("a frame that covers the window is the same calls as no frame (the projection is today's)", () => {
    const a = setup(null);
    const b = setup({ left: 0, top: 0, width: VW, height: VH });
    applyView(a.ctx, a.gl, VW, VH);
    applyView(b.ctx, b.gl, VW, VH);
    expect(b.calls).toEqual(a.calls);
  });

  it("a box: the renderer is the box and the camera looks at the middle of the window the box covers", () => {
    const { ctx, gl, calls } = setup({ left: 100, top: 400, width: 720, height: 200 });
    applyView(ctx, gl, VW, VH);
    expect(calls[0]).toEqual(["setSize", 720, 200, false]); // updateStyle false: the box places the canvas
    expect(calls[1]).toEqual(["setViewOffset", VW, VH, 0, 250, 1440, 400]);
  });

  it("an unchanged view is not set again (setting a canvas size clears it)", () => {
    const { ctx, gl, calls } = setup({ left: 0, top: 0, width: 720, height: 450 });
    applyView(ctx, gl, VW, VH);
    const n = calls.length;
    applyView(ctx, gl, VW, VH);
    expect(calls.length).toBe(n);
    applyView(ctx, gl, VW, 800);
    expect(calls.length).toBeGreaterThan(n);
  });
});

describe("the dot field in a frame", () => {
  it("is placed fixed at the picture's corner, scaled and cut to the frame", () => {
    const { el, props } = fakeEl();
    const { ctx } = setup({ left: 100, top: 400, width: 720, height: 450 });
    placeDots(el, ctx.box, VW, VH, 600);
    expect(props.get("position")).toBe("fixed");
    expect([props.get("left"), props.get("top"), props.get("width"), props.get("height")]).toEqual(["100px", "400px", "1440px", "600px"]);
    expect(props.get("transform")).toBe("scale(0.5)");
    expect(props.get("clipPath")).toBe("inset(0px 0px 0px 0px)");
  });

  it("goes back to the stylesheet's place with no frame", () => {
    const { el, props } = fakeEl();
    const framed = setup({ left: 100, top: 400, width: 720, height: 450 });
    placeDots(el, framed.ctx.box, VW, VH, 600);
    placeDots(el, setup(null).ctx.box, VW, VH, 600);
    expect(props.size).toBe(0);
  });

  it("does nothing without a canvas", () => {
    expect(() => placeDots(undefined, setup(null).ctx.box, VW, VH, 600)).not.toThrow();
  });
});

describe("docking the shelf", () => {
  it("takes the canvas out of the tab order and the pointer's way, and forgets the hover and the press", () => {
    const { el, props } = fakeEl();
    const canvas = Object.assign(el, {
      tabIndex: 0,
      setAttribute: (k: string, v: string) => props.set(k, v),
      removeAttribute: (k: string) => props.delete(k),
      blur: () => undefined,
      classList: { remove: () => undefined },
    });
    const st = newShelfState();
    st.inside = true;
    st.focusIdx = 3;
    st.flickV = 4;
    dockStage(canvas, st, true);
    expect(canvas.tabIndex).toBe(-1);
    expect(props.get("pointerEvents")).toBe("none");
    expect(props.get("aria-hidden")).toBe("true");
    expect([st.inside, st.focusIdx, st.flickV, st.hoverHit, st.down]).toEqual([false, -1, 0, null, null]);
    dockStage(canvas, st, false);
    expect(canvas.tabIndex).toBe(0);
    expect(props.get("pointerEvents")).toBe("");
    expect(props.has("aria-hidden")).toBe(false);
  });
});
