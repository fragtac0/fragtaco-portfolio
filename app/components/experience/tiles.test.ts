import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { levelFor, tilePath, tilesFor } from "./tiles";
import { MAX_SCALE, clampView, fitScale, fitView, type View } from "./view";

const m = { levels: 5, size: 8192, tile: 512 };
const SCREENS: [number, number][] = [[1440, 900], [390, 844], [2560, 1440], [320, 568]];

describe("levelFor", () => {
  it("picks the coarsest level with a picture pixel for every screen pixel", () => {
    expect(levelFor(1, m)).toBe(4);
    expect(levelFor(0.5, m)).toBe(3);
    expect(levelFor(0.51, m)).toBe(4);
    expect(levelFor(0.25, m)).toBe(2);
    expect(levelFor(0.13, m)).toBe(2);
    expect(levelFor(0.0625, m)).toBe(0);
  });

  it("stays between the first and the last level", () => {
    expect(levelFor(0.0001, m)).toBe(0);
    expect(levelFor(9, m)).toBe(4);
  });

  it("is level 2 at the overview of a desktop screen and level 0 on a phone", () => {
    expect(levelFor(fitScale(1440, 900, m), m)).toBe(2);
    expect(levelFor(fitScale(1920, 1080, m), m)).toBe(2);
    expect(levelFor(fitScale(390, 844, m), m)).toBe(0);
  });

  it("never shows a picture pixel larger than a screen pixel, except at the top level", () => {
    for (let i = 0; i <= 40; i++) {
      const scale = 0.05 * 20 ** (i / 40); // 0.05 to 1

      expect(scale * 2 ** (m.levels - 1 - levelFor(scale, m))).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("tilesFor", () => {
  const covers = (v: View, vw: number, vh: number) => {
    const tiles = tilesFor(v, vw, vh, m);
    // every screen point that is on the picture must be in a tile
    const left = Math.max(0, (0 - (v.cx * v.scale - vw / 2)));
    const top = Math.max(0, (0 - (v.cy * v.scale - vh / 2)));
    const right = Math.min(vw, m.size * v.scale - (v.cx * v.scale - vw / 2));
    const bottom = Math.min(vh, m.size * v.scale - (v.cy * v.scale - vh / 2));

    for (let i = 0; i <= 16; i++) {
      for (let j = 0; j <= 16; j++) {
        const sx = left + ((right - left) * i) / 16 - (i === 16 ? 1e-6 : 0);
        const sy = top + ((bottom - top) * j) / 16 - (j === 16 ? 1e-6 : 0);
        const hit = tiles.some((t) => sx >= t.left - 1e-6 && sx < t.left + t.size + 1e-6 && sy >= t.top - 1e-6 && sy < t.top + t.size + 1e-6);

        expect(hit).toBe(true);
      }
    }

    return tiles;
  };

  it("covers the screen at the overview, at the level of its scale, with no duplicate", () => {
    for (const [vw, vh] of SCREENS) {
      const v = fitView(vw, vh, m);
      const tiles = covers(v, vw, vh);

      expect(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length);
      expect(new Set(tiles.map((t) => t.z)).size).toBe(1);
      expect(tiles[0].z).toBe(levelFor(v.scale, m));
    }
  });

  it("at the overview of a wide screen shows the whole picture: all 16 tiles of level 2, centred", () => {
    const tiles = tilesFor(fitView(1440, 900, m), 1440, 900, m);

    expect(tiles).toHaveLength(16);
    expect(tiles.every((t) => t.z === 2)).toBe(true);
    // 8192 * fit, centred on the screen
    const size = 8192 * fitView(1440, 900, m).scale;
    expect(tiles[0].left).toBeCloseTo((1440 - size) / 2, 6);
    expect(tiles[0].top).toBeCloseTo((900 - size) / 2, 6);
    expect(tiles[0].size).toBeCloseTo(size / 4, 6);
  });

  it("covers the screen at every scale and for scattered, clamped centres, with no duplicate and sane sizes", () => {
    for (const [vw, vh] of SCREENS) {
      const fit = fitScale(vw, vh, m);

      for (let i = 0; i <= 12; i++) {
        const scale = fit * (MAX_SCALE / fit) ** (i / 12);

        for (const [cx, cy] of [[0, 0], [8192, 8192], [4096, 4096], [1000, 7000], [6500, 900]]) {
          const v = clampView({ cx, cy, scale }, vw, vh, m);
          const tiles = covers(v, vw, vh);
          const keys = tiles.map((t) => `${t.z}/${t.x}/${t.y}`);

          expect(new Set(keys).size).toBe(keys.length);
          expect(tiles.length).toBeGreaterThan(0);
          for (const t of tiles) {
            expect(t.z).toBe(levelFor(v.scale, m));
            expect(t.x).toBeGreaterThanOrEqual(0);
            expect(t.x).toBeLessThan(2 ** t.z);
            expect(t.y).toBeGreaterThanOrEqual(0);
            expect(t.y).toBeLessThan(2 ** t.z);
            expect(t.size).toBeCloseTo((8192 / 2 ** t.z) * v.scale, 9);
            // no tile is wholly off screen
            expect(t.left + t.size).toBeGreaterThan(0);
            expect(t.left).toBeLessThan(vw);
            expect(t.top + t.size).toBeGreaterThan(0);
            expect(t.top).toBeLessThan(vh);
          }
        }
      }
    }
  });

  it("uses the top level at the native size, and fewer than 20 tiles on screen", () => {
    const tiles = tilesFor({ cx: 4096, cy: 4096, scale: 1 }, 1440, 900, m);

    expect(tiles.every((t) => t.z === 4)).toBe(true);
    expect(tiles.length).toBeLessThan(20);
    expect(tiles[0].size).toBe(512);
  });

  it("places tiles edge to edge, row by row", () => {
    const tiles = tilesFor({ cx: 4096, cy: 4096, scale: 1 }, 1440, 900, m);
    const [a, b] = tiles;

    expect(b.left - a.left).toBeCloseTo(a.size, 9);
    expect(b.top).toBe(a.top);
    expect(tiles.map((t) => [t.y, t.x])).toEqual([...tiles.map((t) => [t.y, t.x])].sort((p, q) => p[0] - q[0] || p[1] - q[1]));
  });

  it("returns nothing when the view is wholly off the picture", () => {
    expect(tilesFor({ cx: -20000, cy: 4096, scale: 1 }, 1440, 900, m)).toEqual([]);
  });

  it("names tiles that exist in public/mars", () => {
    for (const t of tilesFor({ cx: 5000, cy: 3000, scale: 0.8 }, 1440, 900, m)) {
      expect(existsSync(path.join(process.cwd(), "public", tilePath(t)))).toBe(true);
    }
    expect(tilePath({ z: 3, x: 5, y: 2 })).toBe("/mars/3/5_2.webp");
  });
});
