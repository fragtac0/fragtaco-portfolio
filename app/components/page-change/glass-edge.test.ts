import { describe, expect, it } from "vitest";
import { ringLinePixels, ringMaskPixels, stripLinePixels, stripMaskPixels } from "./glass-edge";
import { GLASS, REACH, WARP } from "./glass-math";

const K = 1 + REACH * GLASS.band;
const alpha = (px: Uint8ClampedArray, n: number, x: number, y: number) => px[(y * n + x) * 4 + 3];

describe("ringMaskPixels", () => {
  const n = 160;
  const px = ringMaskPixels(n);
  it("is opaque in the middle and clear beyond the front's reach", () => {
    expect(alpha(px, n, n / 2, n / 2)).toBe(255);
    expect(alpha(px, n, 0, 0)).toBe(0);
    expect(alpha(px, n, n - 1, n / 2)).toBe(0);
  });
  it("puts the edge near the nominal front, within the wander and the band, at every angle", () => {
    const front = (n / 2) / K; // in pixels from the middle
    for (let a = 0; a < 2 * Math.PI; a += 0.4) {
      const at = (rho: number) => {
        const x = Math.round(n / 2 + Math.cos(a) * rho * (n / 2) / K);
        const y = Math.round(n / 2 + Math.sin(a) * rho * (n / 2) / K);
        return alpha(px, n, Math.min(n - 1, x), Math.min(n - 1, y));
      };
      expect(at(1 - WARP - GLASS.band - 0.04)).toBe(255); // inside everything that can wander
      expect(at(1 + WARP + GLASS.band + 0.04)).toBe(0); // outside
    }
    expect(front).toBeGreaterThan(0);
  });
  it("wanders: the half-opaque point is not at one radius at every angle", () => {
    const radii = new Set<number>();
    for (let a = 0; a < 2 * Math.PI; a += 0.3) {
      let r = 0;
      while (r < n / 2 - 1 && alpha(px, n, Math.round(n / 2 + Math.cos(a) * r), Math.round(n / 2 + Math.sin(a) * r)) > 127) r++;
      radii.add(r);
    }
    expect(radii.size).toBeGreaterThan(2);
  });
});

describe("ringLinePixels", () => {
  const n = 160;
  const px = ringLinePixels(n);
  it("is empty in the middle and outside, and has a line near the front", () => {
    expect(alpha(px, n, n / 2, n / 2)).toBe(0);
    expect(alpha(px, n, 0, 0)).toBe(0);
    let strongest = 0;
    for (let x = n / 2; x < n; x++) strongest = Math.max(strongest, alpha(px, n, x, n / 2));
    expect(strongest).toBeGreaterThan(60);
    expect(strongest).toBeLessThanOrEqual(255 * 0.75);
  });
  it("is cream at its brightest (not the warm fringe)", () => {
    let best = 0;
    let at = 0;
    for (let i = 0; i < n * n; i++) if (px[i * 4 + 3] > best) [best, at] = [px[i * 4 + 3], i];
    expect(px[at * 4]).toBeGreaterThan(240);
    expect(px[at * 4 + 2]).toBeGreaterThan(180);
  });
});

describe("strips", () => {
  const w = 128;
  const h = 48;
  it("have the revealed side opaque and the far side clear, and swap sides when mirrored", () => {
    const right = stripMaskPixels(w, h, false);
    const left = stripMaskPixels(w, h, true);
    for (let y = 0; y < h; y++) {
      expect(alpha(right, w, 0, y)).toBe(255);
      expect(alpha(right, w, w - 1, y)).toBe(0);
      expect(alpha(left, w, 0, y)).toBe(0);
      expect(alpha(left, w, w - 1, y)).toBe(255);
    }
  });
  it("wander along the front", () => {
    const right = stripMaskPixels(w, h, false);
    const edges = new Set<number>();
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w && alpha(right, w, x, y) > 127) x++;
      edges.add(x);
    }
    expect(edges.size).toBeGreaterThan(2);
  });
  it("carry a line near the middle that is brightest at the front, and the same line mirrored", () => {
    const right = stripLinePixels(w, h, false);
    const left = stripLinePixels(w, h, true);
    let strongest = 0;
    for (let x = 0; x < w; x++) strongest = Math.max(strongest, alpha(right, w, x, 20));
    expect(strongest).toBeGreaterThan(40);
    for (let x = 0; x < w; x++) expect(alpha(left, w, x, 20)).toBe(alpha(right, w, w - 1 - x, 20));
    expect(alpha(right, w, 0, 20)).toBe(0);
    expect(alpha(right, w, w - 1, 20)).toBe(0);
  });
});
