import { describe, expect, it } from "vitest";
import { GLASS, REACH } from "./glass-math";
import { fbm, ringPixels } from "./glass-texture";

const NEUTRAL = 128;
const at = (px: Uint8ClampedArray, n: number, x: number, y: number) => {
  const i = (y * n + x) * 4;
  return { r: px[i], g: px[i + 1], b: px[i + 2], a: px[i + 3] };
};
/** push in units of the strongest push (-1..1) */
const push = (v: number) => (v - NEUTRAL) / 127;

describe("fbm", () => {
  it("is deterministic and stays between 0 and 1", () => {
    for (let i = 0; i < 50; i++) {
      const v = fbm(i * 0.37, i * 0.91);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fbm(i * 0.37, i * 0.91)).toBe(v);
    }
  });
});

describe("ringPixels", () => {
  const n = 128;
  const px = ringPixels(n);
  it("is opaque everywhere and never pushes more than the full push", () => {
    for (let i = 0; i < n * n; i++) {
      expect(px[i * 4 + 3]).toBe(255);
      expect(Math.abs(push(px[i * 4])) ** 2 + Math.abs(push(px[i * 4 + 1])) ** 2).toBeLessThanOrEqual(1.02);
    }
  });
  it("pushes nothing at the middle and at the edge of the square, and something at the front", () => {
    const mid = at(px, n, n / 2, n / 2);
    expect([mid.r, mid.g]).toEqual([NEUTRAL, NEUTRAL]);
    const corner = at(px, n, 0, 0);
    expect([corner.r, corner.g]).toEqual([NEUTRAL, NEUTRAL]);
    // the front is at 1 / (1 + REACH * band) of the half-size from the middle
    const front = Math.round((n / 2) * (1 + (1 / (1 + REACH * GLASS.band))));
    let strongest = 0;
    for (let x = front - 3; x <= front + 3; x++) {
      const p = at(px, n, Math.min(n - 1, x), n / 2);
      strongest = Math.max(strongest, Math.hypot(push(p.r), push(p.g)));
    }
    expect(strongest).toBeGreaterThan(0.2);
  });
});
