import { describe, expect, it } from "vitest";
import file from "../../../../content/site/videos.json";
import { blockPlan, sizeOfPlan } from "./wall-block";
import {
  atlasLayout,
  cellUv,
  hitTile,
  layoutTiles,
  thumbUrl,
  tileSize,
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

  it("is round 6's size, which the wall's tiles (blockPlan) are about half of", () => {
    expect(blockPlan(109, 1440, 900).tileW).toBeCloseTo(tileSize(1440).cw / 2, 1);
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

  it("holds every video of videos.json at both cell sizes (a re-sync past the capacity must raise it first)", () => {
    const n = (file.items as unknown[]).length;
    for (const small of [false, true]) {
      const a = atlasLayout(n, small);
      expect(a.capacity, `videos.json has ${n} videos; the atlas holds ${a.capacity}`).toBeGreaterThanOrEqual(n);
      expect(a.cells).toHaveLength(n);
    }
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

  it("asks for hqdefault when hq is wanted, whatever the video has", () => {
    expect(thumbUrl({ id: "abc12345678", thumb: "sd" }, "hq")).toMatch(
      /\/abc12345678\/hqdefault\.jpg$/,
    );
  });
});

describe("layoutTiles", () => {
  const vw = 1440;
  const vh = 800;
  const plan = blockPlan(109, vw, vh);
  const size = sizeOfPlan(plan);
  const base = { vw, vh, plan, count: 109 };

  it("returns only valid video indices, each tile of the grid once", () => {
    for (const [viewX, viewY] of [
      [0, 0],
      [-5000, 7000],
      [123456, -98765],
      [200, 100],
    ]) {
      const tiles = layoutTiles({ ...base, viewX, viewY });
      for (const tl of tiles) {
        expect(Number.isInteger(tl.idx)).toBe(true);
        expect(tl.idx).toBeGreaterThanOrEqual(0);
        expect(tl.idx).toBeLessThan(109);
      }
      expect(new Set(tiles.map((tl) => tl.key)).size).toBe(tiles.length);
      expect(new Set(tiles.map((tl) => tl.idx)).size).toBe(tiles.length);
    }
  });

  it("lays the videos out in reading order: tile (cx, cy) is video cy * cols + cx", () => {
    const all = layoutTiles({ ...base, viewX: -vw, viewY: -vh, vw: plan.width + 2 * vw, vh: plan.height + 2 * vh });
    expect(all).toHaveLength(109);
    for (const tl of all) {
      const [cx, cy] = tl.key.split(",").map(Number);
      expect(tl.idx).toBe(cy * plan.cols + cx);
      expect(tl.x).toBeCloseTo(cx * size.pitchX + vw, 6);
      expect(tl.y).toBeCloseTo(cy * size.pitchY + vh, 6);
    }
  });

  it("covers the viewport where the block does, and nothing beyond the block (no wrap)", () => {
    const tiles = layoutTiles({ ...base, viewX: 111, viewY: 57 });
    for (let x = 0; x <= vw; x += 37) {
      for (let y = 0; y <= vh; y += 29) {
        const bx = x + 111;
        const by = y + 57;
        const inBlock = bx < plan.width && by < plan.height;
        const hit = tiles.some(
          (tl) => x >= tl.x && x < tl.x + size.pitchX && y >= tl.y && y < tl.y + size.pitchY,
        );
        if (inBlock && (Math.floor(by / size.pitchY) * plan.cols + Math.floor(bx / size.pitchX)) < 109) {
          expect(hit).toBe(true);
        }
      }
    }
    const far = layoutTiles({ ...base, viewX: plan.width + 10, viewY: 0 });
    expect(far.length).toBeLessThanOrEqual(plan.rows * 2);
    for (const tl of far) expect(tl.x).toBeLessThan(vw + size.pitchX);
  });

  it("keeps a key bound to the same video however the view moves", () => {
    const a = layoutTiles({ ...base, viewX: 0, viewY: 0 });
    const b = layoutTiles({ ...base, viewX: 90, viewY: 40 });
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

  it("holds every video once and leaves the empty end of the last row empty", () => {
    const small = blockPlan(7, 1440, 800);
    const all = layoutTiles({ viewX: 0, viewY: 0, vw: 20000, vh: 20000, plan: small, count: 7 });
    expect(all.map((tl) => tl.idx).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("is empty for no videos", () => {
    expect(layoutTiles({ ...base, viewX: 0, viewY: 0, count: 0 })).toEqual([]);
  });
});

describe("hitTile", () => {
  const plan = blockPlan(109, 1440, 800);
  const size = sizeOfPlan(plan);
  const tiles = layoutTiles({ viewX: 0, viewY: 0, vw: 1440, vh: 800, plan, count: 109 });

  it("finds the tile under the pointer", () => {
    const tl = tiles[Math.floor(tiles.length / 2)];
    expect(hitTile(tiles, tl.x + size.cw / 2, tl.y + size.ch / 2, size)).toBe(
      tl.key,
    );
  });

  it("resolves a point in a gap to the nearer neighbour, never null", () => {
    const moving = layoutTiles({ viewX: 13.3, viewY: 7.9, vw: 1440, vh: 800, plan, count: 109 });
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
