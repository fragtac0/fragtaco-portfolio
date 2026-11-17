import { describe, expect, it } from "vitest";
import { bendPxFor, SPLIT } from "./glass-math";
import { BEND_RANGE } from "./glass-texture";
import { DAMP, edgeDamp, maxPush, VIGNETTE_CELL, vignettePixels, vignetteSize } from "./glass-vignette";

describe("maxPush", () => {
  it("is the peak push times the red split times the map's range (77 * 1.4 * 1.3 at 900 high)", () => {
    expect(maxPush(77)).toBeCloseTo(77 * 1.4 * 1.3, 6);
    expect(maxPush(51)).toBeCloseTo(51 * SPLIT.r * BEND_RANGE, 9);
    expect(maxPush(bendPxFor(900))).toBeGreaterThan(140);
    expect(maxPush(0)).toBe(0);
  });
});

describe("edgeDamp", () => {
  it("is 0 at the edge, 1 from DAMP times the biggest push inwards, and smooth between", () => {
    expect(edgeDamp(0, 70)).toBe(0);
    expect(edgeDamp(-5, 70)).toBe(0);
    expect(edgeDamp(DAMP * 70, 70)).toBe(1);
    expect(edgeDamp(1000, 70)).toBe(1);
    let last = 0;
    for (let d = 0; d <= 200; d += 1) {
      expect(edgeDamp(d, 70)).toBeGreaterThanOrEqual(last);
      last = edgeDamp(d, 70);
    }
  });
  it("never lets the biggest push take a pixel past the edge: damp(d) * push <= d everywhere", () => {
    for (const push of [30, 70, 95]) {
      for (let d = 0; d <= 3 * push; d += 0.5) expect(edgeDamp(d, push) * push).toBeLessThanOrEqual(d + 1e-9);
    }
  });
  it("is no damping when there is no push", () => {
    expect(edgeDamp(0, 0)).toBe(1);
  });
});

describe("vignettePixels", () => {
  const w = 1440;
  const h = 900;
  const push = maxPush(bendPxFor(h));
  const px = vignettePixels(w, h, push);
  const size = vignetteSize(w, h);
  const at = (x: number, y: number) => px[(y * size.w + x) * 4];
  it("has a texel for every VIGNETTE_CELL px, all opaque grey", () => {
    expect(size).toEqual({ w: Math.ceil(w / VIGNETTE_CELL), h: Math.ceil(h / VIGNETTE_CELL) });
    expect(px.length).toBe(size.w * size.h * 4);
    for (let i = 0; i < px.length; i += 4 * 13) {
      expect(px[i]).toBe(px[i + 1]);
      expect(px[i]).toBe(px[i + 2]);
      expect(px[i + 3]).toBe(255);
    }
  });
  it("is nearly 0 along every edge, full well inside, and symmetric", () => {
    expect(at(0, 100)).toBeLessThan(5);
    expect(at(size.w - 1, 100)).toBeLessThan(5);
    expect(at(100, 0)).toBeLessThan(5);
    expect(at(100, size.h - 1)).toBeLessThan(5);
    expect(at(size.w >> 1, size.h >> 1)).toBe(255);
    expect(at(10, 50)).toBe(at(size.w - 11, 50));
    expect(at(50, 10)).toBe(at(50, size.h - 11));
  });
});
