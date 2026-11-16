import { describe, expect, it } from "vitest";
import { createFrameBox } from "../layer/frame-box";
import { placeRegion, subWindow, type Frame } from "../layer/frame-math";
import { containFraming, dotRegion, framingRect, shelfFraming, type Row } from "./box-framing";
import { applyView, dockStage, placeDots, syncRatio, viewFor } from "./shelf-frame";
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
    getPropertyValue: (p: string) => props.get(camel(p)) ?? "",
    getPropertyPriority: () => "",
  };
  const style = new Proxy(own, {
    get: (t, k: string) => (k in t ? t[k] : props.get(k)),
    set: (_t, k: string, v: string) => (props.set(k, v), true),
  });
  return { el: { style } as unknown as HTMLCanvasElement, props };
}

function setup(frame: Frame | null, opts?: { place?: boolean; coarse?: boolean }, ratio = 2) {
  const { el } = fakeEl();
  const box = createFrameBox(el);
  box.request(frame, opts);
  box.commit();
  const calls: Array<[string, ...Array<number | boolean>]> = [];
  const dom = { width: 0, height: 0 };
  const gl = {
    renderer: {
      domElement: dom,
      getPixelRatio: () => ratio,
      setSize: (w: number, h: number, ...a: boolean[]) => {
        calls.push(["setSize", w, h, ...a]);
        dom.width = Math.floor(w * ratio);
        dom.height = Math.floor(h * ratio);
      },
    },
    camera: {
      setViewOffset: (...a: number[]) => calls.push(["setViewOffset", ...a]),
      clearViewOffset: () => calls.push(["clearViewOffset"]),
      updateProjectionMatrix: () => calls.push(["update"]),
    },
  } as unknown as ShelfScene;
  const ctx = { box, st: newShelfState() } as unknown as ShelfCtx;
  return { ctx, gl, calls, box };
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

describe("the shelf's buffer while a frame moves (coarse)", () => {
  const move = (box: ReturnType<typeof setup>["box"], width: number, coarse = true) => {
    box.request({ left: 0, top: 0, width, height: width / 2 }, { place: false, coarse });
    box.commit();
  };

  it("keeps the buffer a step larger than the frame, so a growing frame allocates it only every few frames", () => {
    const { ctx, gl, calls, box } = setup({ left: 0, top: 0, width: 648, height: 300 }, { place: false, coarse: true });
    applyView(ctx, gl, VW, VH);
    let allocations = 1;
    for (let w = 650; w <= 1440; w += 39) {
      const before = calls.filter((c) => c[0] === "setSize").length;
      move(box, w);
      applyView(ctx, gl, VW, VH);
      if (calls.filter((c) => c[0] === "setSize").length > before) allocations++;
      // never smaller than the frame (at the pixel ratio), never a step and more larger
      expect(gl.renderer.domElement.width).toBeGreaterThanOrEqual(w * 2 - 1);
      expect(gl.renderer.domElement.width).toBeLessThanOrEqual(w * 2 + 256 + 1);
    }
    expect(allocations).toBeLessThan(12); // 21 frames
  });

  it("a view change that keeps the buffer sets the camera and not the size", () => {
    const { ctx, gl, calls, box } = setup({ left: 0, top: 0, width: 648, height: 300 }, { place: false, coarse: true });
    applyView(ctx, gl, VW, VH);
    const sizes = () => calls.filter((c) => c[0] === "setSize").length;
    const offsets = () => calls.filter((c) => c[0] === "setViewOffset").length;
    const n = sizes();
    const o = offsets();
    move(box, 652);
    applyView(ctx, gl, VW, VH);
    expect(sizes()).toBe(n);
    expect(offsets()).toBe(o + 1);
  });

  it("the end of the move asks for the exact size again: the frame that is not a moving one gets its own buffer", () => {
    const { ctx, gl, calls, box } = setup({ left: 0, top: 0, width: 648, height: 300 }, { place: false, coarse: true });
    applyView(ctx, gl, VW, VH);
    move(box, 1000);
    applyView(ctx, gl, VW, VH);
    box.request({ left: 0, top: 0, width: 1000, height: 500 }, { place: false });
    box.commit();
    applyView(ctx, gl, VW, VH);
    expect(calls.filter((c) => c[0] === "setSize").at(-1)).toEqual(["setSize", 1000, 500, false]);
  });
});

describe("the end of a moving frame at a pixel ratio that is not whole (Task 25 re-review N1)", () => {
  // dpr 1.75 at 1366 and 390 wide: the window's own buffer is floor(vw * 1.75) = 2390 and 682, not the ceil of the same
  it.each([
    [1366, 768],
    [390, 844],
  ])("lands on the window's own buffer at %i by %i, so the end allocates nothing", (vw, vh) => {
    const ratio = 1.75;
    const { ctx, gl, calls, box } = setup(
      { left: 0, top: 0, width: vw / 2, height: vh / 2 },
      { place: false, coarse: true },
      ratio,
    );
    applyView(ctx, gl, vw, vh);
    for (let e = 0.55; e <= 1.0001; e += 0.05) {
      box.request(
        { left: 0, top: 0, width: vw * Math.min(1, e), height: vh * Math.min(1, e) },
        { place: false, coarse: true },
      );
      box.commit();
      applyView(ctx, gl, vw, vh);
      expect(gl.renderer.domElement.width).toBeLessThanOrEqual(Math.floor(vw * ratio));
    }
    // the moving frame covers the window: its buffer is the window's
    expect(gl.renderer.domElement.width).toBe(Math.floor(vw * ratio));
    expect(gl.renderer.domElement.height).toBe(Math.floor(vh * ratio));
    const sizes = calls.filter((c) => c[0] === "setSize").length;
    box.request(null);
    box.commit();
    applyView(ctx, gl, vw, vh);
    expect(calls.filter((c) => c[0] === "setSize").length).toBe(sizes);
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

  it("in a frame the caller places it is absolute from the frame's own corner, in the canvas's offset parent", () => {
    const { el, props } = fakeEl();
    const { ctx } = setup({ left: 100, top: 400, width: 720, height: 450 }, { place: false });
    placeDots(el, ctx.box, VW, VH, 600);
    expect(props.get("position")).toBe("absolute");
    expect([props.get("left"), props.get("top")]).toEqual(["0px", "0px"]);
    expect(props.get("transform")).toBe("scale(0.5)");
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

describe("the renderer's pixel ratio", () => {
  const renderer = (ratio: number) => {
    const calls: number[] = [];
    return { gl: { renderer: { getPixelRatio: () => ratio, setPixelRatio: (r: number) => calls.push(r) } } as unknown as ShelfScene, calls };
  };

  it("is the screen's up to the shelf's own maximum, and left alone when it already is", () => {
    const { gl, calls } = renderer(1.75);
    const st = newShelfState();
    st.dirty = false;
    st.viewKey = "x";
    syncRatio(gl, st, 2, undefined);
    expect(calls).toEqual([]);
    expect([st.dirty, st.viewKey]).toEqual([false, "x"]);
  });

  it("a docked cap lowers it, makes the next view size the renderer again, and has the shelf drawn", () => {
    const { gl, calls } = renderer(1.75);
    const st = newShelfState();
    st.dirty = false;
    st.viewKey = "x";
    syncRatio(gl, st, 2, 1);
    expect(calls).toEqual([1]);
    expect([st.dirty, st.viewKey]).toEqual([true, ""]);
  });

  it("a cap above the screen's ratio changes nothing", () => {
    const { gl, calls } = renderer(1);
    syncRatio(gl, newShelfState(), 1, 3);
    expect(calls).toEqual([]);
  });
});

describe("docking puts an open book away at once", () => {
  it("closes it without a refocus and resets every book's animation, so nothing keeps the shelf drawing", () => {
    const { el, props } = fakeEl();
    const canvas = Object.assign(el, {
      tabIndex: 0,
      setAttribute: (k: string, v: string) => props.set(k, v),
      removeAttribute: (k: string) => props.delete(k),
      blur: () => undefined,
      classList: { remove: () => undefined },
    });
    const st = newShelfState();
    const books = [{ anim: { open: 0.6 } }, { anim: { open: 0 } }] as unknown as ShelfScene["books"];
    const closed: boolean[] = [];
    dockStage(canvas, st, true, { books }, (refocus) => closed.push(refocus));
    expect(closed).toEqual([false]);
    expect(books.every((b) => b.anim.open === 0)).toBe(true);
  });
});

/** The open page's row at 1440 by 900 (the books' feet on the line at 810, the ledge 74 under it), and the world scale it was fitted at. */
const ROW: Row = { left: 200, right: 1240, top: 142, bottom: 810, ledgeBottom: 884 };
const SCALE = 357;
const BOX: Frame = { left: 58, top: 402, width: 648, height: 300 };
const WIN = { w: VW, h: VH };

/** A shelf context with the row of the last fit and the camera at world x `cam`. */
function framed(frame: Frame | null, opts?: { place?: boolean; coarse?: boolean; move?: { box: { width: number; height: number }; t: number } }, cam = 0) {
  const s = setup(frame, opts);
  (s.ctx as { cam: { x: number; xV: number } }).cam = { x: cam, xV: 0 };
  s.ctx.st.row = ROW;
  s.ctx.st.ledgeTop = ROW.bottom;
  return s;
}

describe("the shelf's view of a frame once it has a row (the box framing)", () => {
  it("docked in its box it shows the whole row on its ledge: a part of the window's picture larger than the window if the box is wide", () => {
    const { ctx } = framed(BOX, { place: false });
    const { sub } = viewFor(ctx, SCALE, VW, VH);
    const fr = containFraming({ w: 648, h: 300 }, ROW);
    expect(sub).toEqual(framingRect(fr, { w: 648, h: 300 }));
    expect(sub.w).toBeGreaterThan(VW); // 648 / 0.356: the box is wider than the window's picture at that size
  });

  it("applyView points the camera at it", () => {
    const { ctx, gl, calls } = framed(BOX, { place: false });
    applyView(ctx, gl, VW, VH, viewFor(ctx, SCALE, VW, VH));
    const sub = framingRect(containFraming({ w: 648, h: 300 }, ROW), { w: 648, h: 300 });
    expect(calls[0]).toEqual(["setSize", 648, 300, false]);
    expect(calls[1]).toEqual(["setViewOffset", VW, VH, sub.x, sub.y, sub.w, sub.h]);
  });

  it("part way through a move it is the framing at that position, for the frame's size then", () => {
    const f: Frame = { left: 0, top: 0, width: (648 + VW) / 2, height: (300 + VH) / 2 };
    const { ctx } = framed(f, { place: false, move: { box: { width: 648, height: 300 }, t: 0.5 } });
    const { sub } = viewFor(ctx, SCALE, VW, VH);
    expect(sub).toEqual(framingRect(shelfFraming({ w: 648, h: 300 }, WIN, ROW, 0.5), { w: f.width, h: f.height }));
    expect(sub.w / sub.h).toBeCloseTo(f.width / f.height, 9);
  });

  it("at the end of a move it is the whole window: the camera is whole, as with no frame", () => {
    const whole: Frame = { left: 0, top: 0, width: VW, height: VH };
    const { ctx, gl, calls } = framed(whole, { place: false, move: { box: { width: 648, height: 300 }, t: 1 } });
    expect(viewFor(ctx, SCALE, VW, VH).sub).toEqual({ x: 0, y: 0, w: VW, h: VH });
    applyView(ctx, gl, VW, VH, viewFor(ctx, SCALE, VW, VH));
    expect(calls).toEqual([["setSize", VW, VH, false], ["clearViewOffset"], ["update"]]);
  });

  it("a frame that covers the window and says nothing of a move is the open page; any other frame is a box at rest", () => {
    const whole = framed({ left: 0, top: 0, width: VW, height: VH }, { place: false });
    expect(viewFor(whole.ctx, SCALE, VW, VH).sub).toEqual({ x: 0, y: 0, w: VW, h: VH });
    const box = framed(BOX, { place: false });
    expect(viewFor(box.ctx, SCALE, VW, VH).sub.w).toBeCloseTo(648 / containFraming({ w: 648, h: 300 }, ROW).scale, 9);
  });

  it("follows the camera: the row sliding one world unit left moves what the box shows a world unit with it", () => {
    const a = viewFor(framed(BOX, { place: false }, 0).ctx, SCALE, VW, VH).sub;
    const b = viewFor(framed(BOX, { place: false }, -1).ctx, SCALE, VW, VH).sub;
    expect(b.x - a.x).toBeCloseTo(SCALE, 9);
    expect(b.w).toBeCloseTo(a.w, 9);
  });

  it("with no row yet it is the cover of before, and with no frame the whole window", () => {
    const noRow = setup(BOX, { place: false });
    expect(viewFor(noRow.ctx, SCALE, VW, VH).sub).toEqual(subWindow(BOX, VW, VH));
    expect(viewFor(noRow.ctx, SCALE, VW, VH).region).toBeNull();
    expect(viewFor(framed(null).ctx, SCALE, VW, VH)).toEqual({ sub: { x: 0, y: 0, w: VW, h: VH }, region: null });
  });

  it("the dot field's region is the one for the box and the window, the same at every position of the move", () => {
    const rest = viewFor(framed(BOX, { place: false }).ctx, SCALE, VW, VH).region;
    const mid = viewFor(
      framed({ left: 0, top: 0, width: 900, height: 500 }, { place: false, move: { box: { width: 648, height: 300 }, t: 0.4 } }).ctx,
      SCALE,
      VW,
      VH,
    ).region;
    expect(rest).toEqual(dotRegion({ w: 648, h: 300 }, WIN, ROW));
    expect(mid).toEqual(rest);
  });
});

describe("the dot field in the box framing", () => {
  it("is laid over the region of the picture, scaled with it and cut to the frame", () => {
    const { el, props } = fakeEl();
    const { ctx } = framed(BOX, { place: false });
    const view = viewFor(ctx, SCALE, VW, VH);
    placeDots(el, ctx.box, VW, VH, ROW.bottom, view);
    const p = placeRegion({ ...BOX, left: 0, top: 0 }, view.sub, view.region!);
    expect(props.get("position")).toBe("absolute");
    expect([props.get("left"), props.get("top"), props.get("width"), props.get("height")]).toEqual([
      `${p.left}px`,
      `${p.top}px`,
      `${view.region!.w}px`,
      `${view.region!.h}px`,
    ]);
    expect(props.get("transform")).toBe(`scale(${p.scale})`);
    // what shows of the field (the canvas less the cut sides) covers the box's width and its top, down to the line the books stand on
    const [t, r, b, l] = p.inset;
    const sc = p.scale;
    expect(p.left + l * sc).toBeLessThanOrEqual(0.0001);
    expect(p.left + (view.region!.w - r) * sc).toBeGreaterThanOrEqual(648 - 0.0001);
    expect(p.top + t * sc).toBeLessThanOrEqual(0.0001);
    const line = (ROW.bottom - view.sub.y) * sc; // the books' feet in the box's pixels
    expect(p.top + (view.region!.h - b) * sc).toBeCloseTo(Math.min(line, 300), 4);
  });
});
