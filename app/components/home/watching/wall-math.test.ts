import { describe, expect, it } from "vitest";
import {
  SPEED,
  atlasLayout,
  cellUv,
  columnOffset,
  focusWeight,
  hitTile,
  layoutTiles,
  thumbUrl,
  tileSize,
  tileTransform,
} from "./wall-math";

describe("tileSize", () => {
  it("clamps the tile width on wide screens", () => {
    const s = tileSize(1440);
    expect(s.cw).toBeCloseTo(276.92, 1);
    expect(s.ch).toBeCloseTo((s.cw * 9) / 16, 5);
    expect(s.gap).toBe(Math.round(s.cw * 0.075));
    expect(s.pitchX).toBeCloseTo(s.cw + s.gap, 5);
    expect(s.pitchY).toBeCloseTo(s.ch + s.gap, 5);
    expect(tileSize(4000).cw).toBe(380);
    expect(tileSize(900).cw).toBe(230);
  });

  it("shows about two columns on small screens", () => {
    expect(tileSize(375).cw).toBeCloseTo(174.4, 1);
  });
});

describe("columnOffset", () => {
  it("drifts near columns forward and far columns backward at 0.72 x 0.6 speed", () => {
    expect(columnOffset(10, 0)).toBeCloseTo(10 * SPEED);
    expect(columnOffset(10, 2)).toBeCloseTo(10 * SPEED + 2 * 53);
    expect(columnOffset(10, 1)).toBeCloseTo(-10 * SPEED * 0.72 * 0.6 + 53);
    expect(columnOffset(10, -1)).toBeCloseTo(-10 * SPEED * 0.72 * 0.6 - 53);
  });
});

describe("atlasLayout", () => {
  it("fits 53 videos into 4096x2048 with 512x288 cells", () => {
    const a = atlasLayout(53, false);
    expect(a).toMatchObject({ cw: 512, ch: 288, aw: 4096, ah: 2048, cols: 8 });
    expect(a.cells).toHaveLength(53);
    for (const c of a.cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + a.cw).toBeLessThanOrEqual(a.aw);
      expect(c.y + a.ch).toBeLessThanOrEqual(a.ah);
    }
    expect(a.capacity).toBeGreaterThanOrEqual(53);
  });

  it("uses 256x144 cells in 2048 wide when small", () => {
    const a = atlasLayout(53, true);
    expect(a).toMatchObject({ cw: 256, ch: 144, aw: 2048, ah: 1024 });
    expect(a.cells).toHaveLength(53);
  });

  it("grows to 4096x4096 for 57 videos", () => {
    const a = atlasLayout(57, false);
    expect(a.ah).toBe(4096);
    expect(a.cells).toHaveLength(57);
  });

  it("caps the atlas at the largest texture that holds whole rows", () => {
    const large = atlasLayout(200, false);
    expect(large.ah).toBe(4096);
    expect(large.capacity).toBe(112);
    expect(large.cells).toHaveLength(112);
    const small = atlasLayout(200, true);
    expect(small.ah).toBe(2048);
    expect(small.capacity).toBe(112);
    expect(small.cells).toHaveLength(112);
    for (const a of [large, small]) {
      for (const c of a.cells) {
        expect(c.y + a.ch).toBeLessThanOrEqual(a.ah);
      }
    }
  });
});

describe("cellUv", () => {
  it("insets each cell by 3 texels", () => {
    const a = atlasLayout(53, false);
    expect(cellUv(0, a)).toEqual([3 / 4096, 3 / 2048, 506 / 4096, 282 / 2048]);
  });

  it("walks 8 cells per row", () => {
    const a = atlasLayout(53, false);
    expect(cellUv(9, a)).toEqual([
      (512 + 3) / 4096,
      (288 + 3) / 2048,
      506 / 4096,
      282 / 2048,
    ]);
  });
});

describe("thumbUrl", () => {
  it("uses the best size a video has", () => {
    expect(thumbUrl({ id: "abc12345678", thumb: "hq" }, "sd")).toMatch(
      /\/abc12345678\/hqdefault\.jpg$/,
    );
    expect(thumbUrl({ id: "abc12345678", thumb: "sd" }, "sd")).toMatch(
      /\/abc12345678\/sddefault\.jpg$/,
    );
    expect(thumbUrl({ id: "abc12345678", thumb: "sd" }, "mq")).toMatch(
      /\/abc12345678\/mqdefault\.jpg$/,
    );
  });
});

describe("focusWeight", () => {
  it("is 1 at the focus and fades out", () => {
    expect(focusWeight(0, 0, 300)).toBe(1);
    expect(focusWeight(3.5 * 300, 0, 300)).toBeLessThan(0.05);
    expect(focusWeight(300, 0, 300)).toBeGreaterThan(focusWeight(600, 0, 300));
  });
});

describe("layoutTiles", () => {
  const size = tileSize(1440);
  const base = {
    vw: 1440,
    vh: 800,
    pitchX: size.pitchX,
    pitchY: size.pitchY,
    count: 53,
  };

  it("returns only valid video indices", () => {
    for (const [panX, panY, t] of [
      [0, 0, 0],
      [-5000, 7000, 123],
      [123456, -98765, 9999],
    ]) {
      const tiles = layoutTiles({ ...base, panX, panY, t });
      expect(tiles.length).toBeGreaterThan(0);
      for (const tl of tiles) {
        expect(Number.isInteger(tl.idx)).toBe(true);
        expect(tl.idx).toBeGreaterThanOrEqual(0);
        expect(tl.idx).toBeLessThan(53);
      }
    }
  });

  it("covers the viewport", () => {
    const tiles = layoutTiles({ ...base, panX: 311, panY: 207, t: 4.2 });
    for (let x = 0; x <= base.vw; x += 37) {
      for (let y = 0; y <= base.vh; y += 29) {
        const hit = tiles.some(
          (tl) =>
            x >= tl.x &&
            x < tl.x + size.pitchX &&
            y >= tl.y &&
            y < tl.y + size.pitchY,
        );
        expect(hit).toBe(true);
      }
    }
  });

  it("keeps a key bound to the same video across frames", () => {
    const a = layoutTiles({ ...base, panX: 0, panY: 0, t: 1 });
    const b = layoutTiles({ ...base, panX: 90, panY: 40, t: 2.5 });
    const byKey = new Map(a.map((tl) => [tl.key, tl.idx]));
    let shared = 0;
    for (const tl of b) {
      const idx = byKey.get(tl.key);
      if (idx !== undefined) {
        shared++;
        expect(tl.idx).toBe(idx);
      }
    }
    expect(shared).toBeGreaterThan(0);
  });

  it("wraps each column over only its own videos", () => {
    const tiles = layoutTiles({
      ...base,
      panX: 0,
      panY: 0,
      t: 0,
      vh: 20000,
    });
    for (const tl of tiles) {
      const cx = Number(tl.key.split(",")[0]);
      const c = ((cx % 8) + 8) % 8;
      expect(tl.idx % 8).toBe(c);
    }
  });
});

describe("layoutTiles with few videos", () => {
  it("skips columns that have no video", () => {
    const size = tileSize(1440);
    const tiles = layoutTiles({
      panX: 0,
      panY: 0,
      vw: 1440,
      vh: 800,
      pitchX: size.pitchX,
      pitchY: size.pitchY,
      t: 0,
      count: 3,
    });
    expect(tiles.length).toBeGreaterThan(0);
    for (const tl of tiles) {
      expect(tl.idx).toBeGreaterThanOrEqual(0);
      expect(tl.idx).toBeLessThan(3);
      const cx = Number(tl.key.split(",")[0]);
      expect(((cx % 8) + 8) % 8).toBeLessThan(3);
    }
    expect(new Set(tiles.map((tl) => tl.idx))).toEqual(new Set([0, 1, 2]));
  });
});

describe("hitTile", () => {
  const size = tileSize(1440);
  const tiles = layoutTiles({
    panX: 0,
    panY: 0,
    vw: 1440,
    vh: 800,
    pitchX: size.pitchX,
    pitchY: size.pitchY,
    t: 0,
    count: 53,
  });

  it("finds the tile under the pointer", () => {
    const tl = tiles[Math.floor(tiles.length / 2)];
    expect(hitTile(tiles, tl.x + size.cw / 2, tl.y + size.ch / 2, size)).toBe(
      tl.key,
    );
  });

  it("resolves a point in a gap to the nearer neighbour, never null", () => {
    const moving = layoutTiles({
      panX: 0,
      panY: 0,
      vw: 1440,
      vh: 800,
      pitchX: size.pitchX,
      pitchY: size.pitchY,
      t: 7.3,
      count: 53,
    });
    const tl = moving.find(
      (t) => t.x > 200 && t.x < 800 && t.y > 100 && t.y < 500,
    );
    expect(tl).toBeDefined();
    if (!tl) return;
    const [cx, cy] = tl.key.split(",").map(Number);
    const gy = tl.y + size.ch / 2;
    // a quarter of the way across the gap to the right: still this tile
    expect(hitTile(moving, tl.x + size.cw + size.gap * 0.25, gy, size)).toBe(
      tl.key,
    );
    // three quarters across: the column to the right
    const right = hitTile(moving, tl.x + size.cw + size.gap * 0.75, gy, size);
    expect(right).not.toBeNull();
    expect(Number(right?.split(",")[0])).toBe(cx + 1);
    // a quarter of the way down the gap below: still this tile
    const gx = tl.x + size.cw / 2;
    expect(hitTile(moving, gx, tl.y + size.ch + size.gap * 0.25, size)).toBe(
      tl.key,
    );
    // three quarters down: the tile below, same column
    expect(hitTile(moving, gx, tl.y + size.ch + size.gap * 0.75, size)).toBe(
      `${cx},${cy + 1}`,
    );
  });

  it("returns null outside the grid", () => {
    expect(hitTile(tiles, -100000, -100000, size)).toBeNull();
  });
});

describe("tileTransform", () => {
  const cw = 300;
  const ch = 169;

  it("grows the hovered tile by 13 percent", () => {
    const r = tileTransform({ cx: 500, cy: 400, dx: 0, dy: 0, f: 1, weight: 0, cw, ch });
    expect(r.w).toBeCloseTo(cw * 1.13, 5);
    expect(r.h).toBeCloseTo(ch * 1.13, 5);
    expect(r.cx).toBe(500);
    expect(r.cy).toBe(400);
    expect(r.rad).toBeCloseTo(12 * 1.13, 5);
  });

  it("shrinks a neighbour and pushes it away from the focus", () => {
    const r = tileTransform({ cx: 500, cy: 400, dx: 100, dy: -50, f: 0, weight: 1, cw, ch });
    expect(r.w).toBeCloseTo(cw * 0.965, 5);
    expect(r.h).toBeCloseTo(ch * 0.965, 5);
    expect(r.cx).toBeCloseTo(500 + 100 * 0.16, 5);
    expect(r.cy).toBeCloseTo(400 - 50 * 0.16, 5);
  });

  it("leaves a tile alone with no focus", () => {
    const r = tileTransform({ cx: 10, cy: 20, dx: 5, dy: 5, f: 0, weight: 0, cw, ch });
    expect(r).toEqual({ cx: 10, cy: 20, w: cw, h: ch, rad: 12 });
  });
});
