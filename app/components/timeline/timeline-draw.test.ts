import { describe, expect, it } from "vitest";
import type { SiteTimeline } from "../../types";
import { cellBox, drawFrame, drawRegion, type DrawState } from "./timeline-draw";
import { buildModel } from "./timeline-model";

const DATA: SiteTimeline = {
  start: "2020-12-01",
  roles: [
    { id: "a", label: "A", from: "2020-12-01", color: "#3E8A7C" },
    { id: "b", label: "B", from: "2021-06-01", color: "#D9A441" },
    { id: "c", label: "C", from: "2025-12-01", color: "#fdfce6" },
  ],
  marks: [],
};

/** A canvas context that only writes down what it was asked to do. */
function recorder() {
  const calls: { name: string; args: unknown[]; fillStyle: unknown; alpha: unknown }[] = [];
  const props: Record<string, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(props, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === "measureText") return (text: string) => ({ width: text.length * 6 });
      return (...args: unknown[]) => {
        calls.push({ name: key, args, fillStyle: target.fillStyle, alpha: target.globalAlpha });
      };
    },
    set(target, key: string, value) {
      target[key] = value;

      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, calls, count: (name: string) => calls.filter((c) => c.name === name).length };
}

function stateAt(scale: number, over: Partial<DrawState> = {}): DrawState {
  const model = buildModel(DATA, "2026-11-11");

  return { model, view: { scale, x: 100, y: 50 }, vw: 1440, vh: 900, cols: 56, rows: 39, hover: null, focus: null, pulse: 1, grain: null, ...over };
}

describe("cellBox", () => {
  it("is the cell's box a pixel wider on each side, in screen pixels", () => {
    const st = stateAt(20);
    // day 57 is row 1, column 1: x 100 + 20, y 50 + 20
    expect(cellBox(st, 57)).toEqual({ x: 119, y: 69, w: 22, h: 22 });
  });

  it("is null for a cell wholly off screen", () => {
    expect(cellBox(stateAt(20, { view: { scale: 20, x: -5000, y: 0 } }), 0)).toBeNull();
    expect(cellBox(stateAt(20, { view: { scale: 20, x: 100, y: 5000 } }), 0)).toBeNull();
  });
});

describe("drawFrame", () => {
  it("clears the screen and draws nothing more when there are no days", () => {
    const { ctx, calls } = recorder();
    const st = stateAt(20);
    drawFrame(ctx, { ...st, model: buildModel(DATA, "2020-11-30") });
    expect(calls.map((c) => c.name)).toEqual(["clearRect"]);
  });

  it("fills one run per role, in the role colours, and no text when squares are under 10 px", () => {
    const { ctx, calls, count } = recorder();
    drawFrame(ctx, stateAt(8));
    const fills = calls.filter((c) => c.name === "fill").map((c) => c.fillStyle);
    expect(fills).toEqual(["#3E8A7C", "#D9A441", "#fdfce6"]);
    expect(count("fillText")).toBe(0);
  });

  it("draws the grid lines only from 5 px a cell", () => {
    const small = recorder();
    drawFrame(small.ctx, stateAt(4));
    expect(small.count("stroke")).toBe(0);
    const big = recorder();
    drawFrame(big.ctx, stateAt(8));
    expect(big.count("stroke")).toBeGreaterThan(0);
  });

  it("adds month names and year rules between 10 and 28 px, and day numbers over 28 px", () => {
    const mid = recorder();
    drawFrame(mid.ctx, stateAt(20));
    expect(mid.count("fillText")).toBeGreaterThan(5);
    expect(mid.calls.filter((c) => c.name === "fillText").map((c) => c.args[0])).toContain("2021");
    const near = recorder();
    drawFrame(near.ctx, stateAt(40, { view: { scale: 40, x: 100, y: 50 } }));
    const words = near.calls.filter((c) => c.name === "fillText").map((c) => String(c.args[0]));
    expect(words).toContain("1");
    expect(words).toContain("DEC");
  });

  it("draws only the cells on screen when zoomed in", () => {
    const wide = recorder();
    drawFrame(wide.ctx, stateAt(40, { view: { scale: 40, x: 100, y: 50 } }));
    const texts = wide.count("fillText");
    // about 34 columns by 22 rows are on screen, not the 2,172 days
    expect(texts).toBeLessThan(900);
  });

  it("draws today's square at its pulse opacity", () => {
    const { ctx, calls } = recorder();
    drawFrame(ctx, stateAt(20, { pulse: 0.8 }));
    const faded = calls.filter((c) => c.name === "fill" && c.alpha === 0.8);
    expect(faded).toHaveLength(1);
    expect(faded[0].fillStyle).toBe("#fdfce6");
  });

  it("draws a ring for the hovered day and one for the focused day", () => {
    const { ctx, count } = recorder();
    drawFrame(ctx, stateAt(20, { hover: 10, focus: 11 }));
    expect(count("strokeRect")).toBe(4);
    const same = recorder();
    drawFrame(same.ctx, stateAt(20, { hover: 10, focus: 10 }));
    expect(same.count("strokeRect")).toBe(2);
  });
});

describe("drawRegion", () => {
  it("clips to today's cell, clears it and redraws only the cells round it", () => {
    const { ctx, calls, count } = recorder();
    const st = stateAt(20, { pulse: 0.75, view: { scale: 20, x: 100, y: 50 } });
    drawRegion(ctx, st, st.model.total - 1);
    expect(count("clip")).toBe(1);
    expect(count("clearRect")).toBe(1);
    const clear = calls.find((c) => c.name === "clearRect");
    expect(clear?.args).toEqual([expect.any(Number), expect.any(Number), 22, 22]);
    expect(calls.filter((c) => c.name === "fill" && c.alpha === 0.75)).toHaveLength(1);
    expect(count("save")).toBe(count("restore"));
  });

  it("draws nothing when the cell is off screen", () => {
    const { ctx, calls } = recorder();
    drawRegion(ctx, stateAt(20, { view: { scale: 20, x: -9000, y: -9000 } }), 100);
    expect(calls).toEqual([]);
  });
});
