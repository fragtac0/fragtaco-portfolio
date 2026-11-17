import { describe, expect, it } from "vitest";
import { halfBands, HALF, turnFor } from "./glass-field";
import { BEND_RANGE, bendTilePixels } from "./glass-texture";
import { noiseStrength, NOISE_S_MAX } from "./glass-noise";

describe("bendTilePixels (the push's strength, R58 and Ruling R129: the noise is in the vignette's picture)", () => {
  const n = 128;
  const front = 0.8;
  const px = bendTilePixels(n, front);
  const turn = turnFor(front);
  /** every pixel of the tile: its index and how many half-bands it is outside the front */
  const pixels: Array<{ i: number; x: number }> = [];
  for (let py = 0; py < n; py++) {
    for (let pxl = 0; pxl < n; pxl++) {
      const u = (((pxl + 0.5) / n) * 2 - 1) * HALF;
      const v = (((py + 0.5) / n) * 2 - 1) * HALF;
      pixels.push({ i: (py * n + pxl) * 4, x: halfBands(u, v, front, turn) });
    }
  }

  it("is stored over the strength's maximum", () => {
    expect(BEND_RANGE).toBe(NOISE_S_MAX);
  });
  it("is opaque everywhere, red and green hold the same unsigned strength, blue is unused", () => {
    for (let i = 0; i < n * n; i++) {
      expect(px[i * 4 + 3]).toBe(255);
      expect(px[i * 4]).toBe(px[i * 4 + 1]);
      expect(px[i * 4 + 2]).toBe(0);
    }
  });
  it("holds nothing more than 1.2 half-bands outside the front", () => {
    for (const p of pixels) {
      if (p.x <= 1.2) continue;
      expect([px[p.i], px[p.i + 1]]).toEqual([0, 0]);
    }
  });
  it("is `noiseStrength` over its range wherever it is made, to one level", () => {
    let checked = 0;
    for (const p of pixels) {
      if (p.x > 3.5) continue;
      expect(Math.abs(px[p.i] - (255 * noiseStrength(p.x)) / BEND_RANGE)).toBeLessThanOrEqual(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });
  it("has a wake: pixels 1.5 to 3 half-bands inside the front hold 8 or more levels", () => {
    const wake = pixels.filter((p) => p.x < -1.5 && p.x > -3);
    expect(wake.length).toBeGreaterThan(100);
    expect(wake.some((p) => px[p.i] >= 8)).toBe(true);
  });
  it("is strongest at the front, and at its strongest holds the full 255 where the strength is at its maximum", () => {
    let at = 0;
    let wake = 0;
    for (const p of pixels) {
      if (Math.abs(p.x) < 0.3) at = Math.max(at, px[p.i]);
      if (p.x < -2.5 && p.x > -3.5) wake = Math.max(wake, px[p.i]);
    }
    expect(at).toBeGreaterThan(wake);
    expect(at).toBeGreaterThan(245);
  });
});
