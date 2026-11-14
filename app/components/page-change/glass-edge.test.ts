import { describe, expect, it } from "vitest";
import { HALF, TILES } from "./glass-field";
import { lineColorAt, lineGradient, lineTilePixels, maskTilePixels } from "./glass-edge";
import { glowAt, shadeAt } from "./glass-math";

const alpha = (px: Uint8ClampedArray, n: number, x: number, y: number) => px[(y * n + x) * 4 + 3];
/** the pixel at distance `rho` (farthest-corner distances) along +x from the middle of an `n` tile */
const along = (n: number, rho: number) => ({ x: Math.min(n - 1, Math.round(n / 2 + (rho / HALF) * (n / 2))), y: n / 2 });

describe("maskTilePixels", () => {
  const n = 128;
  const front = 0.7;
  const px = maskTilePixels(n, front);
  it("is black, opaque in the middle and clear well outside the front", () => {
    expect(alpha(px, n, n / 2, n / 2)).toBe(255);
    expect(alpha(px, n, 0, 0)).toBe(0);
    for (let i = 0; i < n * n; i++) expect(px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]).toBe(0);
  });
  it("has the same soft edge round the whole front, half opaque on it, within the wander", () => {
    // along +x and +y the half-way point is within the wander (WARP) of the front
    for (const dir of [0, Math.PI / 2, Math.PI, 3.4, 5]) {
      let half = -1;
      for (let r = 0.2; r < 1.1; r += 0.004) {
        const x = Math.round(n / 2 + ((r * Math.cos(dir)) / HALF) * (n / 2));
        const y = Math.round(n / 2 + ((r * Math.sin(dir)) / HALF) * (n / 2));
        if (alpha(px, n, x, y) < 128) {
          half = r;
          break;
        }
      }
      expect(half).toBeGreaterThan(front - 0.13);
      expect(half).toBeLessThan(front + 0.13);
    }
  });
  it("wanders: the half-opaque radius is not the same at every angle, by close to the wander", () => {
    const radii: number[] = [];
    for (let a = 0; a < 2 * Math.PI; a += 0.15) {
      let half = 0;
      for (let r = 0.3; r < 1.1; r += 0.003) {
        const x = Math.round(n / 2 + ((r * Math.cos(a)) / HALF) * (n / 2));
        const y = Math.round(n / 2 + ((r * Math.sin(a)) / HALF) * (n / 2));
        if (alpha(px, n, x, y) < 128) {
          half = r;
          break;
        }
      }
      radii.push(half);
    }
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.1);
  });
  it("is the preview's band: 0.15 of a corner distance each side, in every tile (the same width in pixels, not a share of the front)", () => {
    // along +x, going from opaque to clear takes about 2 bands wherever the lobes are at their middle, in a small and a large tile
    for (const f of [TILES[0], TILES[12], TILES[TILES.length - 1] * 0.8]) {
      const t = maskTilePixels(n, f);
      let first = -1;
      let last = -1;
      for (let r = 0; r < 1.1; r += 0.002) {
        const p = along(n, r);
        const a = alpha(t, n, p.x, p.y);
        if (first < 0 && a < 250) first = r;
        if (a > 5) last = r;
      }
      if (first >= 0 && f < 1) expect(last - first).toBeGreaterThan(0.2);
    }
  });
});

describe("lineColorAt", () => {
  it("is cream over the glow's peak at the front, and nothing far from it", () => {
    const [r, g, b, a] = lineColorAt(0);
    expect(a).toBeGreaterThan(0.15);
    expect(a).toBeLessThan(0.17);
    expect(r).toBeGreaterThan(240);
    expect(g).toBeGreaterThan(240);
    expect(b).toBeGreaterThan(200);
    expect(lineColorAt(-3)[3]).toBe(0);
    expect(lineColorAt(4)[3]).toBe(0);
  });
  it("is the glow and the shade together: the shade is black under the glow, so alpha is both and the colour darkens with the shade", () => {
    const x = 0.3;
    const glow = glowAt(x);
    const shade = shadeAt(x);
    const [r, , , a] = lineColorAt(x);
    expect(a).toBeCloseTo(glow + shade * (1 - glow), 9);
    expect(r).toBeCloseTo((253 * glow) / a, 6);
    // where there is only shade, the colour is black
    expect(lineColorAt(-0.9)[0]).toBeLessThan(5);
    expect(lineColorAt(-0.9)[3]).toBeGreaterThan(0.02);
  });
  it("shows the glass about 10% darker than the pages in the band, except in the glint", () => {
    expect(shadeAt(0)).toBeCloseTo(0, 9);
    expect(shadeAt(0.5)).toBeGreaterThan(0.05);
    expect(shadeAt(0.5)).toBeLessThanOrEqual(0.1);
    expect(shadeAt(-0.5)).toBeGreaterThan(0.05);
    expect(shadeAt(3)).toBeLessThan(0.001);
  });
});

describe("lineTilePixels", () => {
  const n = 160;
  const px = lineTilePixels(n, 0.8);
  it("is empty in the middle and far outside, and glows round the front", () => {
    expect(alpha(px, n, n / 2, n / 2)).toBe(0);
    expect(alpha(px, n, 0, 0)).toBe(0);
    let strongest = 0;
    for (let x = n / 2; x < n; x++) strongest = Math.max(strongest, alpha(px, n, x, n / 2));
    expect(strongest).toBeGreaterThan(0.12 * 255);
    expect(strongest).toBeLessThanOrEqual(0.3 * 255);
  });
  it("is cream at its brightest (not the warm fringe of round 6's line)", () => {
    let best = 0;
    let at = 0;
    for (let i = 0; i < n * n; i++) {
      // brightest glow: the pixel with the most cream in it
      const v = px[i * 4] * (px[i * 4 + 3] / 255);
      if (v > best) [best, at] = [v, i];
    }
    expect(px[at * 4]).toBeGreaterThan(240);
    expect(px[at * 4 + 2]).toBeGreaterThan(200);
  });
});

describe("lineGradient", () => {
  it("is a radial gradient of the glow and the shade round the front, in the CSS lengths it is given", () => {
    const g = lineGradient("var(--change-x) var(--change-y)", "var(--glass-front)", "var(--glass-band)");
    expect(g.startsWith("radial-gradient(circle at var(--change-x) var(--change-y), ")).toBe(true);
    expect(g).toContain("calc(var(--glass-front) + 0 * var(--glass-band))");
    expect(g).toContain("calc(var(--glass-front) + -2.4 * var(--glass-band))");
    // stops run outward
    const xs = [...g.matchAll(/\+ (-?[\d.]+) \*/g)].map((m) => Number(m[1]));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    // the stop at the front is the glow's peak
    expect(g).toMatch(/rgb\(25\d 25\d 2\d\d \/ 0\.16\d*\) calc\(var\(--glass-front\) \+ 0 \*/);
  });
});
