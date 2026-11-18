import { describe, expect, it } from "vitest";
import { HALF, TILES } from "./glass-field";
import { glowColorAt, glowGradient, glowTilePixels, maskTilePixels, shadeGradient, shadeTilePixels } from "./glass-edge";
import { GLASS, glowAt, shadeAt } from "./glass-math";

const alpha = (px: Uint8ClampedArray, n: number, x: number, y: number) => px[(y * n + x) * 4 + 3];
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
  it("is the preview's band: the same width in pixels at every front radius (0.18 of a corner distance from 90% to 10% new page), not a share of the front", () => {
    // newShare falls from 0.9 to 0.1 over 1.215 half-bands; the field's own slope along a ray is within a fifth of 1, so the same holds for the tile
    const big = 256;
    const ideal = 1.2152 * GLASS.band;
    for (const f of [TILES[0], TILES[8], TILES[16], TILES[19]]) {
      const t = maskTilePixels(big, f);
      for (const a of [0, 1.3, 2.6, 4]) {
        let at90 = -1;
        let at10 = -1;
        for (let r = 0; r < HALF; r += 0.001) {
          const x = Math.round(big / 2 + ((r * Math.cos(a)) / HALF) * (big / 2));
          const y = Math.round(big / 2 + ((r * Math.sin(a)) / HALF) * (big / 2));
          const v = alpha(t, big, Math.min(big - 1, x), Math.min(big - 1, y)) / 255;
          if (at90 < 0 && v < 0.9) at90 = r;
          if (at10 < 0 && v < 0.1) at10 = r;
        }
        expect(at90).toBeGreaterThan(0);
        expect(at10).toBeGreaterThan(at90);
        expect((at10 - at90) / ideal).toBeGreaterThan(0.75);
        expect((at10 - at90) / ideal).toBeLessThan(1.25);
      }
    }
  });
});

describe("glowColorAt", () => {
  it("is cream over the glow's peak at the front, and nothing far from it", () => {
    const [r, g, b, a] = glowColorAt(0);
    expect(a).toBeGreaterThan(0.15);
    expect(a).toBeLessThan(0.17);
    expect(r).toBeGreaterThan(240);
    expect(g).toBeGreaterThan(240);
    expect(b).toBeGreaterThan(200);
    expect(glowColorAt(-3)[3]).toBe(0);
    expect(glowColorAt(4)[3]).toBe(0);
  });
  it("is the glow alone, in cream, with the glow's strength as alpha (the shade is a picture of its own)", () => {
    for (const x of [-0.3, 0.2, 0.9]) {
      const [r, g, b, a] = glowColorAt(x);
      expect(a).toBeCloseTo(glowAt(x), 12);
      expect([r, g, b]).toEqual(glowColorAt(0).slice(0, 3));
    }
  });
});

describe("shade", () => {
  it("shows the glass about 10% darker than the pages in the band, except in the glint", () => {
    expect(shadeAt(0)).toBeCloseTo(0, 9);
    expect(shadeAt(0.5)).toBeGreaterThan(0.05);
    expect(shadeAt(0.5)).toBeLessThanOrEqual(0.1);
    expect(shadeAt(-0.5)).toBeGreaterThan(0.05);
    expect(shadeAt(3)).toBeLessThan(0.001);
  });
});

describe("glowTilePixels", () => {
  const n = 160;
  const px = glowTilePixels(n, 0.8);
  it("is empty in the middle and far outside, and glows round the front", () => {
    expect(alpha(px, n, n / 2, n / 2)).toBe(0);
    expect(alpha(px, n, 0, 0)).toBe(0);
    let strongest = 0;
    for (let x = n / 2; x < n; x++) strongest = Math.max(strongest, alpha(px, n, x, n / 2));
    expect(strongest).toBeGreaterThan(0.12 * 255);
    expect(strongest).toBeLessThanOrEqual(0.2 * 255);
  });
  it("is cream wherever it has any strength (not the warm fringe of round 6's line)", () => {
    let seen = 0;
    for (let i = 0; i < n * n; i++) {
      if (px[i * 4 + 3] === 0) continue;
      seen++;
      expect(px[i * 4]).toBeGreaterThan(240);
      expect(px[i * 4 + 2]).toBeGreaterThan(200);
    }
    expect(seen).toBeGreaterThan(500);
  });
});

describe("shadeTilePixels", () => {
  const n = 160;
  const px = shadeTilePixels(n, 0.8);
  it("is black, clear in the middle and far outside, and up to 10% opaque in the band round the front", () => {
    expect(alpha(px, n, n / 2, n / 2)).toBe(0);
    expect(alpha(px, n, 0, 0)).toBe(0);
    let strongest = 0;
    for (let i = 0; i < n * n; i++) {
      expect(px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]).toBe(0);
      strongest = Math.max(strongest, px[i * 4 + 3]);
    }
    expect(strongest).toBeGreaterThan(0.08 * 255);
    expect(strongest).toBeLessThanOrEqual(0.1 * 255 + 1);
  });
});

describe("the gradients", () => {
  const args = ["var(--change-x) var(--change-y)", "var(--glass-front)", "var(--glass-band)"] as const;
  it("draw the glow as a radial gradient round the front, in the CSS lengths they are given", () => {
    const g = glowGradient(...args);
    expect(g.startsWith("radial-gradient(circle at var(--change-x) var(--change-y), ")).toBe(true);
    expect(g).toContain("calc(var(--glass-front) + 0 * var(--glass-band))");
    expect(g).toContain("calc(var(--glass-front) + -2.4 * var(--glass-band))");
    // stops run outward
    const xs = [...g.matchAll(/\+ (-?[\d.]+) \*/g)].map((m) => Number(m[1]));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    // the stop at the front is the glow's peak, in cream
    expect(g).toMatch(/rgb\(25\d 25\d 2\d\d \/ 0\.16\d*\) calc\(var\(--glass-front\) \+ 0 \*/);
  });
  it("draw the shade as black with its own strength: none at the front's glint, about 10% a half-band either side", () => {
    const g = shadeGradient(...args);
    expect(g).toMatch(/rgb\(0 0 0 \/ 0\) calc\(var\(--glass-front\) \+ 0 \*/);
    const at = (x: number) => Number(g.match(new RegExp(`rgb\\(0 0 0 / ([\\d.]+)\\) calc\\(var\\(--glass-front\\) \\+ ${x} \\*`))?.[1]);
    expect(at(0.5)).toBeCloseTo(shadeAt(0.5), 3);
    expect(at(-0.5)).toBeCloseTo(shadeAt(-0.5), 3);
  });
});
