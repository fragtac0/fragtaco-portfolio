import { describe, expect, it } from "vitest";
import { tileSize } from "./wall-math";
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
    expect(tiles.every((t) => t.width === cw)).toBe(true);
    // every tile touches the viewport
    for (const t of tiles) {
      expect(t.left).toBeLessThan(1440);
      expect(t.left + t.width).toBeGreaterThan(0);
      expect(t.top).toBeLessThan(900);
      expect(t.top + t.height).toBeGreaterThan(0);
    }
  });

  it("gives every tile the wall's size, so no column is smaller", () => {
    const { cw, ch } = tileSize(1440);
    for (const t of placeholderTiles(1440, 900, 51)) {
      expect(t.width).toBe(cw);
      expect(t.height).toBe(ch);
      expect(t.radius).toBe(12);
    }
  });

  it("leaves spare columns empty when there are fewer videos than columns", () => {
    const keys = placeholderTiles(1440, 900, 3).map((t) => Number.parseInt(t.key, 10));
    for (const c of keys) expect(((c % 8) + 8) % 8).toBeLessThan(3);
  });
});
