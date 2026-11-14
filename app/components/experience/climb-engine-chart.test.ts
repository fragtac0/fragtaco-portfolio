// The chart layer and the frame in the engine (Task 19, spec 9.6): the grid under the trail, the frame on its own canvas, the readout
// that tells the summit or the chosen milestone, the overview's marks fading with the picture, and the labels that keep out of the
// page's words and the dock.
import { describe, expect, it } from "vitest";
import { readout } from "./chart";
import { IN_MS } from "./climb-change";
import { setup, started } from "./climb-engine-fixtures";
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
