// The chart layer and the frame in the engine (Task 19, spec 9.6): the grid under the trail, the frame on its own canvas, the readout
// that tells the summit or the chosen milestone, the overview's marks fading with the picture, and the labels that keep out of the
// page's words and the dock.
import { describe, expect, it } from "vitest";
import { readout } from "./chart";
import { IN_MS } from "./climb-change";
import { setup, started, terrain } from "./climb-engine-fixtures";
import { MILESTONE_SHARES, trailAt } from "./trail";

const SUMMIT = readout(500, 325);

describe("the frame's canvas", () => {
  it("is sized with the stage, and drawn when the engine is up", () => {
    const { engine, layers, f, frameCalls } = setup();

    started(engine, f);
    expect(layers.frame.width).toBe(2880);
    expect(layers.frame.height).toBe(1800);
    expect(frameCalls.clearRect).toBeGreaterThan(0);
  });

  it("is not drawn again while nothing moves (only when the view changes)", () => {
    const { engine, f, frameCalls } = setup();

    started(engine, f);

    const n = frameCalls.clearRect;

    f.run(1000);
    expect(frameCalls.clearRect).toBe(n);
    engine.go("climb");
    f.run(300);
    expect(frameCalls.clearRect).toBeGreaterThan(n);
  });

  it("tells the summit in the overview and the chosen milestone in My climb, and the summit again on the way out", () => {
    const { engine, f, frameLog, trail } = setup();

    started(engine, f);

    const told = () => [...frameLog].reverse().find((c) => c[0] === "fillText" && String(c[1]).includes("  "))?.[1];
    const at = (i: number) => {
      const m = trailAt(trail, MILESTONE_SHARES[i]);

      return readout(m.x, m.y);
    };

    expect(told()).toBe(SUMMIT);
    engine.go("climb", 3);
    f.run(IN_MS + 200);
    expect(told()).toBe(at(3));
    engine.go("climb", 6);
    f.run(100);
    expect(told()).toBe(at(6));
    expect(at(6)).not.toBe(at(3));
    engine.go("overview");
    f.run(100);
    expect(told()).toBe(SUMMIT);
  });

  it("has the overview's lettering (north, the scale bar, the rings') in the overview and none of it in My climb; the corner marks and the readout stay", () => {
    const { engine, f, frameLog } = setup();

    started(engine, f);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "N")).toBe(true);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "200 km")).toBe(true);
    engine.go("climb");
    f.run(IN_MS + 300);
    frameLog.length = 0;
    engine.redraw();
    f.run(50);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "N")).toBe(false);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "200 km")).toBe(false);
    expect(frameLog.filter((c) => c[0] === "stroke")).toHaveLength(4); // the four corner marks
    expect(frameLog.some((c) => c[0] === "fillText" && String(c[1]).includes("° E"))).toBe(true);
  });

  it("fades the overview's lettering with the picture (half way through the change, some, then none)", () => {
    const { engine, f, frameLog } = setup();

    started(engine, f);
    engine.go("climb");
    f.run(IN_MS * 0.2);

    const early = frameLog.filter((c) => c[0] === "fillText" && c[1] === "N").length;

    f.run(IN_MS * 0.8);
    frameLog.length = 0;
    engine.redraw();
    f.run(50);
    expect(early).toBeGreaterThan(0);
    expect(frameLog.filter((c) => c[0] === "fillText" && c[1] === "N")).toHaveLength(0);
  });
});

describe("the grid, under the trail", () => {
  /** The strokes one drawing of the trail's canvas makes (the engine is made to draw once more). */
  const perDraw = ({ engine, f, trailCalls }: ReturnType<typeof setup>) => {
    const before = trailCalls.stroke;

    engine.redraw();
    f.run(50);

    return trailCalls.stroke - before;
  };

  it("is drawn on the trail's canvas with the trail: a stroke for each of the 42 lines, one for the crosses, two rings and the summit's mark in the overview, then the trail's three", () => {
    const s = setup();

    started(s.engine, s.f);
    expect(perDraw(s)).toBe(42 + 1 + 2 + 1 + 3);
  });

  it("keeps the grid in My climb and drops the overview's marks (the trail's three strokes and nine stems come instead)", () => {
    const s = setup();

    started(s.engine, s.f);
    s.engine.go("climb");
    s.f.run(IN_MS + 300);
    expect(perDraw(s)).toBe(42 + 1 + 3 + 9);
  });
});

describe("the page's words and the dock", () => {
  it("leaves out a label that would clash with a box it is given, and draws it again when the box goes", () => {
    const { engine, f, frameLog } = setup();

    started(engine, f);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "N")).toBe(true);
    engine.setKeepOut({ words: [{ l: 600, t: 0, r: 840, b: 120 }], dock: null });
    frameLog.length = 0;
    f.run(100);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "N")).toBe(false);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "200 km")).toBe(true);
    engine.setKeepOut({ words: [], dock: null });
    frameLog.length = 0;
    f.run(100);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "N")).toBe(true);
  });

  it("is told before the stage has a size (the page tells it first): the first drawing already leaves the label out", () => {
    const { engine, frameLog } = setup();

    engine.setKeepOut({ words: [{ l: 600, t: 0, r: 840, b: 120 }], dock: null });
    engine.resize(1440, 900, 2);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "200 km")).toBe(true);
    expect(frameLog.some((c) => c[0] === "fillText" && c[1] === "N")).toBe(false);
  });

  it("puts the frame's foot on the dock where the dock spans the screen, and draws again at once", () => {
    const { engine, f, frameLog } = setup();

    started(engine, f);
    engine.setKeepOut({ words: [], dock: { l: 100, t: 800, r: 1340, b: 880 } });
    frameLog.length = 0;
    f.run(100);

    const readoutCall = frameLog.find((c) => c[0] === "fillText" && String(c[1]).includes("° E") && String(c[1]).includes("  "));

    expect(readoutCall?.[3]).toBe(794 - 22);
  });

  it("draws again when told (a font arrived)", () => {
    const { engine, f, frameCalls } = setup();

    started(engine, f);

    const n = frameCalls.clearRect;

    engine.redraw();
    f.run(50);
    expect(frameCalls.clearRect).toBeGreaterThan(n);
  });

  it("clears the frame's canvas when it is torn down", () => {
    const { engine, f, frameCalls } = setup();

    started(engine, f);

    const n = frameCalls.clearRect;

    engine.destroy();
    expect(frameCalls.clearRect).toBe(n + 1);
  });
});

describe("the overview's framing (Ruling R104)", () => {
  const settled = (transform: string) => /translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(transform)?.slice(1).map(Number) ?? [];

  const phone = { words: [{ l: 16, t: 22, r: 301, b: 150.8 }, { l: 16, t: 590.5, r: 374, b: 699 }, { l: 16, t: 64, r: 198.8, b: 103.5 }], dock: { l: 20.3, t: 739, r: 369.7, b: 832 } };
  const desk = { words: [{ l: 48, t: 28, r: 470.4, b: 224.1 }, { l: 48, t: 668.8, r: 463.4, b: 746.5 }, { l: 1193.2, t: 28, r: 1392, b: 69.5 }], dock: { l: 496.2, t: 762.5, r: 943.8, b: 876 } };

  it("is the picture's own on the desktop, where the whole trail already fits", () => {
    const { engine, layers, f } = setup();

    engine.setKeepOut(desk);
    started(engine, f);
    expect(layers.plane.style.transform).toContain("scale(1.584) translate(-470px, -325px)");
  });

  it("puts all nine beads on a phone's screen, clear of the dock, however the keep-out and the size come", () => {
    for (const order of ["keep first", "size first"]) {
      const { engine, layers, f, heads } = setup();

      if (order === "keep first") engine.setKeepOut(phone);
      engine.resize(390, 844, 2);
      if (order === "size first") engine.setKeepOut(phone);
      engine.setTerrain(terrain());
      f.run(2500); // the framing glides to the fitted one
      expect(layers.plane.style.transform, order).not.toContain("translate(-470px, -325px)");

      const last = heads[heads.length - 1];

      expect(last, order).toHaveLength(9);
      for (const [x, y] of last) {
        expect(x - 22, order).toBeGreaterThanOrEqual(12);
        expect(x + 22, order).toBeLessThanOrEqual(378);
        expect(y + 22, order).toBeLessThanOrEqual(739);
      }
    }
  });

  it("starts at the picture's own place (the page's CSS put it there) and glides to the fitted one, in a few frames, with no jump", () => {
    const { engine, layers, f } = setup();
    const seen: number[] = [];

    engine.setKeepOut(phone);
    engine.resize(390, 844, 2);
    engine.setTerrain(terrain());
    seen.push(settled(layers.plane.style.transform)[0]);
    for (let i = 0; i < 90; i++) {
      f.run(1000 / 60);
      seen.push(settled(layers.plane.style.transform)[0]);
    }
    expect(seen[0]).toBe(-470);
    expect(seen[seen.length - 1]).toBeLessThan(-520); // the look-at point moved east: the picture's place moved west
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1] + 1e-9); // never back
    expect(seen[1] - seen[0]).toBeGreaterThan(-20); // a soft start, not a jump
  });

  it("starts a phone at the phone's own place (the page's CSS puts it there) and stays, where that already fits (390 by 844)", () => {
    const { engine, layers, f } = setup({ phone: true });
    const seen: number[] = [];

    engine.setKeepOut(phone);
    engine.resize(390, 844, 2);
    engine.setTerrain(terrain());
    for (let i = 0; i < 60; i++) {
      seen.push(settled(layers.plane.style.transform)[0]);
      f.run(1000 / 60);
    }
    expect(layers.plane.style.transform).toContain("translate(-530px, -345px)");
    expect(new Set(seen)).toEqual(new Set([-530])); // no glide at all
  });

  it("goes to the fitted framing at once under reduced motion", () => {
    const { engine, layers } = setup({ reduced: true });

    engine.setKeepOut(phone);
    engine.resize(390, 844, 2);
    expect(settled(layers.plane.style.transform)[0]).toBeLessThan(-520);
  });

  it("chooses the chart's labels for the fitted framing from the start, so none pops in or out while the picture glides to it", () => {
    const { engine, f, frameLog } = setup();
    const lettering = () => new Set(frameLog.filter((c) => c[0] === "fillText").map((c) => String(c[1])));

    engine.setKeepOut(phone);
    engine.resize(390, 844, 2);
    engine.setTerrain(terrain());
    f.run(20);

    const atStart = lettering();

    frameLog.length = 0;
    f.run(2500);
    expect(lettering()).toEqual(atStart);
    expect(atStart.size).toBeGreaterThan(1);
  });
});
