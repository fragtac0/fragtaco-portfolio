import { describe, expect, it } from "vitest";
import { halfBands, HALF, turnFor } from "./glass-field";
import { BEND_RANGE, bendTilePixels } from "./glass-texture";
import { NOISE_S_MAX } from "./glass-noise";

const NEUTRAL = 128;
/** push in units of the peak push (-BEND_RANGE..BEND_RANGE) */
const push = (v: number) => ((v - NEUTRAL) / 127) * BEND_RANGE;

describe("bendTilePixels (the hero's liquid, 17 November design 4)", () => {
  const n = 128;
  const front = 0.8;
  const px = bendTilePixels(n, front);
  const turn = turnFor(front);
  /** every pixel of the tile: its index, its place and how many half-bands it is outside the front */
  const pixels: Array<{ i: number; u: number; v: number; x: number }> = [];
  for (let py = 0; py < n; py++) {
    for (let pxl = 0; pxl < n; pxl++) {
      const u = (((pxl + 0.5) / n) * 2 - 1) * HALF;
      const v = (((py + 0.5) / n) * 2 - 1) * HALF;
      pixels.push({ i: (py * n + pxl) * 4, u, v, x: halfBands(u, v, front, turn) });
    }
  }

  it("is stored over the strength's maximum", () => {
    expect(BEND_RANGE).toBe(NOISE_S_MAX);
  });
  it("is opaque everywhere and never pushes more than the range", () => {
    for (let i = 0; i < n * n; i++) {
      expect(px[i * 4 + 3]).toBe(255);
      expect(Math.hypot(push(px[i * 4]), push(px[i * 4 + 1]))).toBeLessThanOrEqual(BEND_RANGE + 0.02);
    }
  });
  it("pushes nothing more than 1.2 half-bands outside the front", () => {
    for (const p of pixels) {
      if (p.x <= 1.2) continue;
      expect([px[p.i], px[p.i + 1]]).toEqual([NEUTRAL, NEUTRAL]);
    }
  });
  it("has a wake: pixels 1.5 to 3 half-bands inside the front are pushed by 8 or more levels", () => {
    const wake = pixels.filter((p) => p.x < -1.5 && p.x > -3);
    expect(wake.length).toBeGreaterThan(100);
    expect(wake.some((p) => Math.abs(px[p.i] - NEUTRAL) >= 8 || Math.abs(px[p.i + 1] - NEUTRAL) >= 8)).toBe(true);
  });
  it("is strongest at the front", () => {
    let at = 0;
    let wake = 0;
    for (const p of pixels) {
      const m = Math.hypot(px[p.i] - NEUTRAL, px[p.i + 1] - NEUTRAL);
      if (Math.abs(p.x) < 0.3) at = Math.max(at, m);
      if (p.x < -2.5 && p.x > -3.5) wake = Math.max(wake, m);
    }
    expect(at).toBeGreaterThan(wake);
  });
  it("is not a lens: the push is not along the line from the middle (a lens would score 1)", () => {
    let sum = 0;
    let count = 0;
    for (const p of pixels) {
      const dx = px[p.i] - NEUTRAL;
      const dy = px[p.i + 1] - NEUTRAL;
      const len = Math.hypot(dx, dy);
      const rho = Math.hypot(p.u, p.v);
      if (len < 4 || rho < 1e-6) continue;
      sum += Math.abs((dx * p.u + dy * p.v) / (len * rho));
      count++;
    }
    expect(count).toBeGreaterThan(500);
    expect(sum / count).toBeLessThan(0.8);
  });
});
