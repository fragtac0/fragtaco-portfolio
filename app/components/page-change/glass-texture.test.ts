import { describe, expect, it } from "vitest";
import { HALF } from "./glass-field";
import { BEND_MAX, bendTilePixels } from "./glass-texture";

const NEUTRAL = 128;
const at = (px: Uint8ClampedArray, n: number, x: number, y: number) => {
  const i = (y * n + x) * 4;
  return { r: px[i], g: px[i + 1], b: px[i + 2], a: px[i + 3] };
};
/** push in units of the peak push (-BEND_MAX..BEND_MAX) */
const push = (v: number) => ((v - NEUTRAL) / 127) * BEND_MAX;
/** the pixel `rho` corner distances from the middle in direction `a` */
const place = (n: number, rho: number, a: number) => ({
  x: Math.min(n - 1, Math.round(n / 2 + ((rho * Math.cos(a)) / HALF) * (n / 2))),
  y: Math.min(n - 1, Math.round(n / 2 + ((rho * Math.sin(a)) / HALF) * (n / 2))),
});

describe("bendTilePixels", () => {
  const n = 160;
  const front = 0.8;
  const px = bendTilePixels(n, front);
  it("is opaque everywhere and never pushes more than the stored maximum", () => {
    for (let i = 0; i < n * n; i++) {
      expect(px[i * 4 + 3]).toBe(255);
      expect(Math.hypot(push(px[i * 4]), push(px[i * 4 + 1]))).toBeLessThanOrEqual(BEND_MAX + 0.02);
    }
  });
  it("pushes nothing in the middle and nothing a few half-bands outside the front", () => {
    const mid = at(px, n, n / 2, n / 2);
    expect([mid.r, mid.g]).toEqual([NEUTRAL, NEUTRAL]);
    const far = place(n, 1.1, 0);
    const o = at(px, n, far.x, far.y);
    expect(Math.abs(push(o.r))).toBeLessThan(0.05);
  });
  it("pushes along the line from the middle, at the full peak at the front", () => {
    for (const a of [0, 1, 2.2, 3.5, 5]) {
      let strongest = 0;
      for (let rho = front - 0.15; rho <= front + 0.2; rho += 0.005) {
        const p = place(n, rho, a);
        const c = at(px, n, p.x, p.y);
        const m = Math.hypot(push(c.r), push(c.g));
        strongest = Math.max(strongest, m);
        // along the radial direction
        if (m > 0.3) {
          expect(push(c.r) * Math.cos(a) + push(c.g) * Math.sin(a)).toBeGreaterThan(0.25);
        }
      }
      expect(strongest).toBeGreaterThan(0.85);
    }
  });
});
