import { describe, expect, it } from "vitest";
import {
  DOCKED_MS,
  drawDue,
  frameAt,
  frameView,
  subWindow,
  dotPlacement,
  gluedScale,
  sameFrame,
  sameFrameSize,
  type Frame,
} from "./frame-math";

const box: Frame = { left: 100, top: 400, width: 480, height: 300 };
const VW = 1440;
const VH = 900;
const FULL: Frame = { left: 0, top: 0, width: VW, height: VH };

describe("frameAt", () => {
  it("is the box at 0 and the whole window at 1", () => {
    expect(frameAt(box, VW, VH, 0)).toEqual(box);
    expect(frameAt(box, VW, VH, 1)).toEqual(FULL);
  });

  it("is the straight line between them at 0.5", () => {
    expect(frameAt(box, VW, VH, 0.5)).toEqual({ left: 50, top: 200, width: 960, height: 600 });
  });

  it("lands exactly on the window at 1 for awkward numbers", () => {
    const f = frameAt({ left: 13.37, top: 211.91, width: 333.33, height: 187.5 }, 1440.5, 900.25, 1);
    expect(f).toEqual({ left: 0, top: 0, width: 1440.5, height: 900.25 });
  });
});

describe("gluedScale", () => {
  it("is the width share for a wide box and the height share for a tall one", () => {
    expect(gluedScale({ left: 0, top: 0, width: 720, height: 200 }, VW, VH)).toBeCloseTo(0.5, 10); // 0.5 against 0.222
    expect(gluedScale({ left: 0, top: 0, width: 200, height: 450 }, VW, VH)).toBeCloseTo(0.5, 10); // 0.139 against 0.5
  });

  it("is exactly 1 for the whole window", () => {
    expect(gluedScale(FULL, VW, VH)).toBe(1);
  });

  it("covers: the picture is never smaller than the frame in either direction", () => {
    for (const f of [box, { left: 0, top: 0, width: 300, height: 700 }, { left: 5, top: 5, width: 1000, height: 120 }]) {
      const s = gluedScale(f, VW, VH);
      expect(VW * s).toBeGreaterThanOrEqual(f.width - 1e-9);
      expect(VH * s).toBeGreaterThanOrEqual(f.height - 1e-9);
    }
  });
});

describe("frameView", () => {
  it("with no frame is the whole window at the pixel ratio", () => {
    expect(frameView(null, VW, VH, 2)).toEqual({
      cssW: VW,
      cssH: VH,
      bufW: 2880,
      bufH: 1800,
      x: 0,
      y: 0,
      w: 2880,
      h: 1800,
      scale: 1,
      full: true,
    });
  });

  it("a frame that covers the window gives exactly the picture of no frame (the engines' projection)", () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      expect(frameView(FULL, VW, VH, dpr)).toEqual(frameView(null, VW, VH, dpr));
    }
    expect(frameView({ left: 0, top: 0, width: 390, height: 844 }, 390, 844, 3)).toEqual(
      frameView(null, 390, 844, 3),
    );
  });

  it("a box of the window's own shape carries the whole picture at the box's size", () => {
    const v = frameView({ left: 20, top: 30, width: 720, height: 450 }, VW, VH, 2);
    expect(v.scale).toBe(0.5);
    expect([v.bufW, v.bufH]).toEqual([1440, 900]);
    expect([v.x, v.y, v.w, v.h]).toEqual([0, 0, 1440, 900]);
    expect(v.full).toBe(true);
  });

  it("a wide box shows the middle band of the picture: the picture is taller than the box and centred", () => {
    const v = frameView({ left: 0, top: 0, width: 720, height: 200 }, VW, VH, 1);
    expect(v.scale).toBe(0.5);
    expect([v.bufW, v.bufH]).toEqual([720, 200]);
    expect([v.w, v.h]).toEqual([720, 450]);
    expect([v.x, v.y]).toEqual([0, -125]);
    expect(v.full).toBe(false);
  });

  it("a tall box shows the middle column", () => {
    const v = frameView({ left: 0, top: 0, width: 200, height: 450 }, VW, VH, 2);
    expect([v.bufW, v.bufH]).toEqual([400, 900]);
    expect([v.w, v.h]).toEqual([1440, 900]);
    expect([v.x, v.y]).toEqual([-520, 0]);
  });

  it("the picture always covers the whole buffer, at any size and pixel ratio", () => {
    for (const dpr of [1, 1.25, 2, 2.625, 3]) {
      for (let i = 0; i < 200; i++) {
        const f = { left: 0, top: 0, width: 97 + i * 7.31, height: 61 + ((i * 53) % 640) * 1.17 };
        const v = frameView(f, VW, VH, dpr);
        expect(v.x).toBeLessThanOrEqual(0);
        expect(v.y).toBeLessThanOrEqual(0);
        expect(v.x + v.w).toBeGreaterThanOrEqual(v.bufW);
        expect(v.y + v.h).toBeGreaterThanOrEqual(v.bufH);
      }
    }
  });

  it("never makes an empty buffer", () => {
    const v = frameView({ left: 0, top: 0, width: 0, height: 0 }, VW, VH, 1);
    expect(v.bufW).toBeGreaterThanOrEqual(1);
    expect(v.bufH).toBeGreaterThanOrEqual(1);
    expect(v.w).toBeGreaterThanOrEqual(1);
  });
});

describe("sameFrame", () => {
  it("is place and size together", () => {
    expect(sameFrame(box, { ...box })).toBe(true);
    expect(sameFrame(box, { ...box, left: 101 })).toBe(false);
    expect(sameFrame(null, null)).toBe(true);
    expect(sameFrame(box, null)).toBe(false);
  });
});

describe("sameFrameSize", () => {
  it("tells a move from a resize", () => {
    expect(sameFrameSize(box, { ...box, left: 1, top: 2 })).toBe(true);
    expect(sameFrameSize(box, { ...box, width: 481 })).toBe(false);
    expect(sameFrameSize(null, null)).toBe(true);
    expect(sameFrameSize(null, box)).toBe(false);
  });
});

describe("drawDue", () => {
  it("always draws when not docked", () => {
    expect(drawDue(100, 99, false)).toBe(true);
  });

  it("docked, draws every other frame of a 60 Hz screen and never more than 30 a second", () => {
    let last = -1000;
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const now = i * (1000 / 60);
      if (drawDue(now, last, true)) {
        last = now;
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(29);
    expect(n).toBeLessThanOrEqual(30);
  });

  it("docked on a 144 Hz and a 120 Hz screen stays at or under 30 a second", () => {
    for (const hz of [144, 120, 90, 75]) {
      let last = -1000;
      let n = 0;
      for (let i = 0; i < hz; i++) {
        const now = i * (1000 / hz);
        if (drawDue(now, last, true)) {
          last = now;
          n++;
        }
      }
      expect(n).toBeLessThanOrEqual(30);
    }
    expect(DOCKED_MS).toBeCloseTo(33.33, 1);
  });
});

describe("subWindow", () => {
  it("is the whole window for no frame and for a frame that covers it", () => {
    expect(subWindow(null, VW, VH)).toEqual({ x: 0, y: 0, w: VW, h: VH });
    expect(subWindow(FULL, VW, VH)).toEqual({ x: 0, y: 0, w: VW, h: VH });
  });

  it("is the part of the window the frame shows, in window pixels, centred", () => {
    // scale 0.5: the 720 by 200 box shows a 1440 by 400 band of the 900 high window
    expect(subWindow({ left: 5, top: 5, width: 720, height: 200 }, VW, VH)).toEqual({ x: 0, y: 250, w: 1440, h: 400 });
    // scale 0.5 again: the 200 by 450 box shows 400 by 900 of the width
    expect(subWindow({ left: 5, top: 5, width: 200, height: 450 }, VW, VH)).toEqual({ x: 520, y: 0, w: 400, h: 900 });
  });
});

describe("dotPlacement", () => {
  it("puts the field's corner where the window's picture starts in the frame, scaled, cropped to the frame", () => {
    const p = dotPlacement({ left: 100, top: 400, width: 720, height: 450 }, VW, VH, 600);
    expect(p).toEqual({ left: 100, top: 400, width: VW, height: 600, scale: 0.5, inset: [0, 0, 0, 0] });
  });

  it("a wide box crops the field's top and bottom and moves its corner up", () => {
    const p = dotPlacement({ left: 0, top: 500, width: 720, height: 200 }, VW, VH, 600)!;
    expect(p.scale).toBe(0.5);
    expect(p.left).toBe(0);
    expect(p.top).toBe(500 + (200 - 450) / 2); // 375: the picture's top is 125 px above the box
    expect(p.inset).toEqual([250, 0, 0, 0]); // the visible band is y 250 to 650: the field (600 tall) is cut 250 off its top and nothing off its foot
  });

  it("is null before the ledge has a row", () => {
    expect(dotPlacement(box, VW, VH, 0)).toBeNull();
  });
});
