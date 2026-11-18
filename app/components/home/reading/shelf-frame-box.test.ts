import { describe, expect, it } from "vitest";
import { placeRegion, subWindow, type Frame } from "../layer/frame-math";
import { containFraming, dotRegion, framingRect, shelfFraming } from "./box-framing";
import { applyView, placeDots, viewFor } from "./shelf-frame";
import { BOX, ROW, SCALE, VH, VW, WIN, fakeEl, framed, setup } from "./shelf-frame-fake";

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
    expect(viewFor(framed(null).ctx, SCALE, VW, VH)).toEqual({ sub: { x: 0, y: 0, w: VW, h: VH }, region: null, res: 1 });
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
    expect(Number(props.get("--dot-res"))).toBeCloseTo(view.res, 9); // painted finer than it shows, by the framing's scale
    expect(view.res).toBeLessThan(0.6);
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
