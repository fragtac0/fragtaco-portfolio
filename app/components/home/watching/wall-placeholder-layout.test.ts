import { describe, expect, it } from "vitest";
import { PLANE, tileSize } from "./wall-math";
import { placeholderTiles } from "./wall-placeholder-layout";

describe("placeholderTiles", () => {
  it("is empty without a size or without videos", () => {
    expect(placeholderTiles(0, 900, 51)).toEqual([]);
    expect(placeholderTiles(1440, 0, 51)).toEqual([]);
    expect(placeholderTiles(1440, 900, 0)).toEqual([]);
  });

  it("covers the viewport with tiles at the wall's size", () => {
    const tiles = placeholderTiles(1440, 900, 51);
    const { cw } = tileSize(1440);
    expect(tiles.length).toBeGreaterThan(10);
    // near tiles are exactly the wall's tile width
    expect(tiles.some((t) => t.width === cw)).toBe(true);
    // every tile touches the viewport
    for (const t of tiles) {
      expect(t.left).toBeLessThan(1440);
      expect(t.left + t.width).toBeGreaterThan(0);
      expect(t.top).toBeLessThan(900);
      expect(t.top + t.height).toBeGreaterThan(0);
    }
  });

  it("draws far columns smaller about their own centre", () => {
    const { cw, ch } = tileSize(1440);
    const tiles = placeholderTiles(1440, 900, 51);
    const far = tiles.find((t) => t.key.startsWith("1,"));
    const near = tiles.find((t) => t.key.startsWith("0,"));
    expect(far).toBeDefined();
    expect(near).toBeDefined();
    if (!far || !near) return;
    expect(far.width).toBeCloseTo(cw * PLANE.far.scale);
    expect(far.height).toBeCloseTo(ch * PLANE.far.scale);
    expect(far.radius).toBeCloseTo(12 * PLANE.far.scale);
    expect(near.radius).toBe(12);
    // the inset is the same on both sides: the centre has not moved
    const pitchX = tileSize(1440).pitchX;
    expect(far.left + far.width / 2).toBeCloseTo(1 * pitchX + cw / 2);
  });

  it("leaves spare columns empty when there are fewer videos than columns", () => {
    const keys = placeholderTiles(1440, 900, 3).map((t) => Number.parseInt(t.key, 10));
    for (const c of keys) expect(((c % 8) + 8) % 8).toBeLessThan(3);
  });
});
