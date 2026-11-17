import { describe, expect, it } from "vitest";
import { bendPxFor, SPLIT } from "./glass-math";
import { BEND_RANGE } from "./glass-texture";
import { noiseGradient } from "./glass-noise";
import { DAMP, edgeDamp, maxPush, VIGNETTE_CELL, vignettePixels, vignetteRows, vignetteSize } from "./glass-vignette";

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

describe("vignettePixels (the hero's noise gradient, fixed on the screen, times the edge damping: R129)", () => {
  const w = 1440;
  const h = 900;
  const push = maxPush(bendPxFor(h));
  const px = vignettePixels(w, h, push);
  const size = vignetteSize(w, h);
  const at = (x: number, y: number, c = 0) => px[(y * size.w + x) * 4 + c];
  it("has a texel for every VIGNETTE_CELL px, all opaque, blue neutral", () => {
    expect(size).toEqual({ w: Math.ceil(w / VIGNETTE_CELL), h: Math.ceil(h / VIGNETTE_CELL) });
    expect(px.length).toBe(size.w * size.h * 4);
    for (let i = 0; i < px.length; i += 4 * 13) {
      expect(px[i + 2]).toBe(128);
      expect(px[i + 3]).toBe(255);
    }
  });
  it("is neutral (128) along every edge, and holds the noise's direction well inside", () => {
    for (const [x, y] of [[0, 100], [size.w - 1, 100], [100, 0], [100, size.h - 1]]) {
      expect(Math.abs(at(x, y) - 128)).toBeLessThan(6);
      expect(Math.abs(at(x, y, 1) - 128)).toBeLessThan(6);
    }
    // well inside the damping is 1: the texel is 128 + 127 * the gradient at its centre, in farthest-corner distances from the middle
    const far = Math.hypot(w / 2, h / 2);
    let strong = 0;
    for (const [x, y] of [[180, 112], [90, 60], [270, 170], [300, 60], [60, 160], [200, 150]]) {
      const g = noiseGradient(((x + 0.5) * VIGNETTE_CELL - w / 2) / far, ((y + 0.5) * VIGNETTE_CELL - h / 2) / far);
      expect(at(x, y)).toBe(Math.round(128 + 127 * g.x));
      expect(at(x, y, 1)).toBe(Math.round(128 + 127 * g.y));
      if (Math.hypot(g.x, g.y) > 0.3) strong++;
    }
    expect(strong).toBeGreaterThan(0);
  });
  it("carries the noise: a good share of the texels are well off neutral, in both directions", () => {
    let moved = 0;
    let left = 0;
    let right = 0;
    for (let i = 0; i < px.length; i += 4 * 7) {
      if (Math.abs(px[i] - 128) > 20 || Math.abs(px[i + 1] - 128) > 20) moved++;
      if (px[i] < 108) left++;
      if (px[i] > 148) right++;
    }
    expect(moved).toBeGreaterThan(500);
    expect(left).toBeGreaterThan(100);
    expect(right).toBeGreaterThan(100);
  });
  it("only takes away from the bare noise: the damping never makes a push bigger (a push of 0 has no damping)", () => {
    const flat = vignettePixels(w, h, 0);
    for (let y = 0; y < size.h; y += 9) {
      for (let x = 0; x < size.w; x += 9) {
        const i = (y * size.w + x) * 4;
        expect(Math.hypot(px[i] - 128, px[i + 1] - 128)).toBeLessThanOrEqual(Math.hypot(flat[i] - 128, flat[i + 1] - 128) + 1.5);
      }
    }
  });
  it("is made the same a few rows at a time as all at once", () => {
    const out = new Uint8ClampedArray(size.w * size.h * 4);
    for (let y = 0; y < size.h; y += 7) vignetteRows(out, w, h, push, y, y + 7);
    expect(Array.from(out)).toEqual(Array.from(px));
  });
});
