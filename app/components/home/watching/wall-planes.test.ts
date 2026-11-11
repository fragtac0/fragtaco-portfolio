import { describe, expect, it } from "vitest";
import { PLANE } from "./wall-math";
import {
  arrivalOf,
  chipSub,
  colOfKey,
  drawRank,
  planeOfKey,
  sortForDraw,
  tileLook,
} from "./wall-planes";

describe("colOfKey and planeOfKey", () => {
  it("reads the column from a tile key", () => {
    expect(colOfKey("3,-2")).toBe(3);
    expect(colOfKey("-4,10")).toBe(-4);
  });

  it("puts odd columns on the far plane, negative ones included", () => {
    expect(planeOfKey("0,5")).toBe("near");
    expect(planeOfKey("1,5")).toBe("far");
    expect(planeOfKey("-1,0")).toBe("far");
    expect(planeOfKey("-2,0")).toBe("near");
  });
});

describe("tileLook", () => {
  const rest = { f: 0, lens: 0, e: 0 };

  it("leaves a near tile as it is when nothing is in focus", () => {
    expect(tileLook({ plane: "near", ...rest })).toEqual({ scale: 1, dim: 1, bias: 0 });
  });

  it("makes a far tile smaller, dimmer and softer, by the plane's numbers", () => {
    const look = tileLook({ plane: "far", ...rest });
    expect(look.scale).toBe(PLANE.far.scale);
    expect(look.dim).toBe(PLANE.far.dim);
    expect(look.bias).toBe(PLANE.far.bias);
  });

  it("dims and softens everything while something is in focus, near and far alike", () => {
    const near = tileLook({ plane: "near", f: 0, lens: 1, e: 0 });
    expect(near.dim).toBeCloseTo(1 - 0.16);
    expect(near.bias).toBeCloseTo(1.35);
    const far = tileLook({ plane: "far", f: 0, lens: 1, e: 0 });
    expect(far.dim).toBeCloseTo(PLANE.far.dim * (1 - 0.16));
    expect(far.bias).toBeCloseTo(PLANE.far.bias + 1.35);
  });

  it("brings a focused tile forward to full size and brightness, whatever its plane", () => {
    for (const plane of ["near", "far"] as const) {
      expect(tileLook({ plane, f: 1, lens: 1, e: 0 })).toEqual({ scale: 1, dim: 1, bias: 0 });
    }
  });

  it("keeps an echo tile as bright and sharp as it was before the focus", () => {
    const near = tileLook({ plane: "near", f: 0, lens: 1, e: 1 });
    expect(near).toEqual({ scale: 1, dim: 1, bias: 0 });
    // a far echo tile keeps its plane's depth: only the focus dimming is lifted
    const far = tileLook({ plane: "far", f: 0, lens: 1, e: 1 });
    expect(far.dim).toBeCloseTo(PLANE.far.dim);
    expect(far.bias).toBeCloseTo(PLANE.far.bias);
  });

  it("moves smoothly between the states", () => {
    const half = tileLook({ plane: "far", f: 0.5, lens: 1, e: 0 });
    expect(half.scale).toBeCloseTo((PLANE.far.scale + 1) / 2);
    const edge = tileLook({ plane: "near", f: 0, lens: 1, e: 0.5 });
    expect(edge.dim).toBeCloseTo(1 - 0.08);
  });
});

describe("drawRank and sortForDraw", () => {
  it("ranks far tiles below near tiles, and any focused tile above both", () => {
    expect(drawRank("far", 0)).toBeLessThan(drawRank("near", 0));
    expect(drawRank("near", 0)).toBeLessThan(drawRank("far", 0.5));
    expect(drawRank("far", 0.5)).toBeLessThan(drawRank("far", 1));
  });

  it("draws far first, near over them, and the focused tile last whatever its plane", () => {
    const tiles = [
      { id: "near-a", plane: "near" as const, f: 0 },
      { id: "far-focused", plane: "far" as const, f: 1 },
      { id: "far-a", plane: "far" as const, f: 0 },
      { id: "near-b", plane: "near" as const, f: 0 },
      { id: "far-b", plane: "far" as const, f: 0 },
    ];
    expect(sortForDraw(tiles).map((t) => t.id)).toEqual([
      "far-a",
      "far-b",
      "near-a",
      "near-b",
      "far-focused",
    ]);
  });

  it("puts the more focused of two easing tiles on top", () => {
    const tiles = [
      { id: "in", plane: "near" as const, f: 0.8 },
      { id: "out", plane: "far" as const, f: 0.2 },
    ];
    expect(sortForDraw(tiles).map((t) => t.id)).toEqual(["out", "in"]);
  });
});

describe("arrivalOf", () => {
  const base = { now: 1000, distanceFromCentre: 0, pitch: 300, reduced: false };

  it("has no arrival for a thumbnail that is not up (the placeholder shows)", () => {
    expect(arrivalOf({ ...base, loadedAt: 0 }).loaded).toBe(false);
    expect(arrivalOf({ ...base, loadedAt: Number.NaN }).loaded).toBe(false);
    expect(arrivalOf({ ...base, loadedAt: undefined as unknown as number }).loaded).toBe(false);
  });

  it("starts invisible and small, and ends opaque and full size", () => {
    const start = arrivalOf({ ...base, loadedAt: 1000 });
    expect(start).toEqual({ loaded: true, alpha: 0, scale: 0.96 });
    const end = arrivalOf({ ...base, loadedAt: 600 });
    expect(end).toEqual({ loaded: true, alpha: 1, scale: 1 });
  });

  it("waits longer the further the tile is from the centre", () => {
    const mid = { ...base, loadedAt: 900 };
    const centre = arrivalOf({ ...mid, distanceFromCentre: 0 });
    const out = arrivalOf({ ...mid, distanceFromCentre: 900 });
    expect(centre.alpha).toBeGreaterThan(out.alpha);
    expect(out.alpha).toBe(0);
  });

  it("just appears with reduced motion", () => {
    expect(arrivalOf({ ...base, loadedAt: 1000, reduced: true })).toEqual({
      loaded: true,
      alpha: 1,
      scale: 1,
    });
  });
});

describe("chipSub", () => {
  it("is just the channel when it has no other video on the wall", () => {
    expect(chipSub("Fragtaco", 0)).toBe("Fragtaco");
  });

  it("appends how many more there are from the channel", () => {
    expect(chipSub("Fragtaco", 1)).toBe("Fragtaco, 1 more from this channel");
    expect(chipSub("Fragtaco", 3)).toBe("Fragtaco, 3 more from this channel");
  });

  it("has no dashes", () => {
    expect(chipSub("A", 2)).not.toMatch(/[–—-]/);
  });
});
