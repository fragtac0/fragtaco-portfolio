import { describe, expect, it } from "vitest";
import { fbm, NOISE_NORM, NOISE_S_MAX, NOISE_SCALE, NOISE_STEP, noiseGradient, noiseStrength, WAKE_REACH } from "./glass-noise";

describe("fbm (the hero shader's)", () => {
  it("stays within 0 and 1 and is smooth (a small step moves it a little)", () => {
    for (let v = -3; v <= 3; v += 0.37) {
      for (let u = -3; u <= 3; u += 0.41) {
        const a = fbm(u, v);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
        expect(Math.abs(fbm(u + 0.001, v) - a)).toBeLessThan(0.02);
      }
    }
  });
  it("is the same formula as the hero's: three octaves at 0.55, 0.3 and 0.15 of 1, 2.03 and 4.07 times the scale", () => {
    // at an integer point the value noise is the lattice's own hash, so the octaves are easy to name: noise(0, 0) = hash(0, 0) = 0
    expect(fbm(0, 0)).toBeCloseTo(0.3 * hashed(7.1, 7.1) + 0.15 * hashed(-3.7, -3.7), 6);
  });
});

/** the hero's value noise at a lattice-free point, written out again from its parts (the test's own copy of the formula) */
function hashed(px: number, py: number): number {
  const fract = (v: number) => v - Math.floor(v);
  const h = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const fx = sm(fract(px));
  const fy = sm(fract(py));
  const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * fx;
  const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * fx;
  return a + (b - a) * fy;
}

describe("noiseGradient", () => {
  it("is the numbers of the spike: scale 2.9, a step of 0.02, divided by 1.55", () => {
    expect(NOISE_SCALE).toBe(2.9);
    expect(NOISE_STEP).toBe(0.02);
    expect(NOISE_NORM).toBe(1.55);
    const u = 0.31;
    const v = -0.42;
    const c = fbm(u * 2.9, v * 2.9);
    const want = { x: (fbm(u * 2.9 + 0.02, v * 2.9) - c) / 0.02 / 1.55, y: (fbm(u * 2.9, v * 2.9 + 0.02) - c) / 0.02 / 1.55 };
    const len = Math.hypot(want.x, want.y);
    const k = len > 1 ? 1 / len : 1;
    const g = noiseGradient(u, v);
    expect(g.x).toBeCloseTo(want.x * k, 9);
    expect(g.y).toBeCloseTo(want.y * k, 9);
  });
  it("is never longer than 1 and uses its range", () => {
    let max = 0;
    for (let v = -1.12; v <= 1.12; v += 0.02) {
      for (let u = -1.12; u <= 1.12; u += 0.02) {
        const g = noiseGradient(u, v);
        max = Math.max(max, Math.hypot(g.x, g.y));
      }
    }
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
    expect(max).toBeGreaterThan(0.9);
  });
  it("is not radial (a lens would score 1)", () => {
    let sum = 0;
    let count = 0;
    for (let v = -1; v <= 1; v += 0.05) {
      for (let u = -1; u <= 1; u += 0.05) {
        const g = noiseGradient(u, v);
        const len = Math.hypot(g.x, g.y);
        const rho = Math.hypot(u, v);
        if (len < 1e-6 || rho < 1e-6) continue;
        sum += Math.abs((g.x * u + g.y * v) / (len * rho));
        count++;
      }
    }
    expect(sum / count).toBeLessThan(0.8);
  });
});

describe("noiseStrength", () => {
  it("is the hero's band and wake: 1.3 at the front, nothing outside it, a wake behind it that ends at WAKE_REACH", () => {
    expect(WAKE_REACH).toBe(3.7);
    expect(noiseStrength(0)).toBeCloseTo(1.3, 6);
    expect(noiseStrength(1)).toBe(0);
    expect(noiseStrength(2)).toBe(0);
    expect(noiseStrength(-1)).toBeCloseTo(0.492, 2);
    expect(noiseStrength(-WAKE_REACH)).toBe(0);
    expect(noiseStrength(-5)).toBe(0);
  });
  it("never goes over NOISE_S_MAX", () => {
    expect(NOISE_S_MAX).toBe(1.3);
    for (let x = -5; x <= 2; x += 0.01) expect(noiseStrength(x)).toBeLessThanOrEqual(NOISE_S_MAX + 1e-9);
  });
  it("has no step where the wake ends (the strength is within 0.02 of its neighbour at every 0.01 half-band)", () => {
    let last = noiseStrength(-5);
    for (let x = -4.99; x <= 2; x += 0.01) {
      expect(Math.abs(noiseStrength(x) - last)).toBeLessThan(0.02);
      last = noiseStrength(x);
    }
  });
});
