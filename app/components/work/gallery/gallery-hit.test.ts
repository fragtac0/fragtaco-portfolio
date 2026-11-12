import { describe, expect, it } from "vitest";
import {
  DRIFT_PERIOD_S,
  DRIFT_RADIUS_PX,
  NUDGE_MAX_PX,
  approach,
  atlasLayout,
  coverRect,
  driftAt,
  fitGrid,
  rubberBand,
  safeInsets,
  settleNudge,
  tileAt,
  tileRect,
  warp,
  type Grid,
} from "./gallery-math";

const ASPECTS = [16 / 9, 9 / 16];
const safeFor = (vw: number, vh: number) => safeInsets(vw, vh, 72, 108);

describe("tileAt", () => {
  const vw = 1440;
  const vh = 900;
  const g = fitGrid(35, vw, vh, 16 / 9, safeFor(vw, vh));
  const drift = { x: 3, y: -2 };
  /** Where a point in layout space is on the screen. */
  const screen = (x: number, y: number) => warp(x + drift.x, y + drift.y, vw, vh);

  it("returns the right tile at every tile centre", () => {
    for (let i = 0; i < 35; i++) {
      const r = tileRect(g, i);
      const [sx, sy] = screen(r.x + r.w / 2, r.y + r.h / 2);
      expect(tileAt(sx, sy, g, drift, vw, vh)).toBe(i);
    }
  });

  it("returns the corner tiles near the corners of the grid", () => {
    const first = tileRect(g, 0);
    const [ax, ay] = screen(first.x + 2, first.y + 2);
    expect(tileAt(ax, ay, g, drift, vw, vh)).toBe(0);
    const last = tileRect(g, 34);
    const [bx, by] = screen(last.x + last.w - 2, last.y + last.h - 2);
    expect(tileAt(bx, by, g, drift, vw, vh)).toBe(34);
    const topRight = tileRect(g, g.cols - 1);
    const [cx, cy] = screen(topRight.x + topRight.w - 2, topRight.y + 2);
    expect(tileAt(cx, cy, g, drift, vw, vh)).toBe(g.cols - 1);
  });

  it("is null at the four corners of the screen and in the margins", () => {
    for (const [x, y] of [
      [0, 0],
      [vw, 0],
      [0, vh],
      [vw, vh],
      [vw / 2, 2],
      [vw / 2, vh - 2],
      [2, vh / 2],
    ]) {
      expect(tileAt(x, y, g, drift, vw, vh)).toBeNull();
    }
  });

  it("is null in the gaps between tiles, across and down", () => {
    const a = tileRect(g, 0);
    const [hx, hy] = screen(a.x + a.w + g.gap / 2, a.y + a.h / 2);
    expect(tileAt(hx, hy, g, drift, vw, vh)).toBeNull();
    const [vx, vy] = screen(a.x + a.w / 2, a.y + a.h + g.gap / 2);
    expect(tileAt(vx, vy, g, drift, vw, vh)).toBeNull();
  });

  it("is null where a short last row has no tile", () => {
    const n = 34;
    const sg = fitGrid(n, vw, vh, 16 / 9, safeFor(vw, vh));
    const inLast = n - (sg.rows - 1) * sg.cols;
    expect(inLast).toBeLessThan(sg.cols); // 34 leaves the last row short at this size
    const last = tileRect(sg, n - 1);
    const [sx, sy] = screen(last.x + last.w + sg.gap + last.w / 2, last.y + last.h / 2);
    expect(tileAt(sx, sy, sg, drift, vw, vh)).toBeNull();
    const first = tileRect(sg, (sg.rows - 1) * sg.cols);
    const [ex, ey] = screen(first.x - sg.gap - first.w / 2, first.y + first.h / 2);
    expect(tileAt(ex, ey, sg, drift, vw, vh)).toBeNull();
  });

  it("follows the drift: the same screen point lands on a tile or not as the grid moves", () => {
    const r = tileRect(g, 0);
    const [sx, sy] = warp(r.x + 1, r.y + 1, vw, vh);
    expect(tileAt(sx, sy, g, { x: 0, y: 0 }, vw, vh)).toBe(0);
    expect(tileAt(sx, sy, g, { x: 6, y: 6 }, vw, vh)).toBeNull();
  });

  it("tests the hovered tile's grown box first, so its visible fringe still hits it", () => {
    const a = tileRect(g, 9);
    // 3 px outside the tile's right edge, level with its middle: in the gap
    const [sx, sy] = screen(a.x + a.w + 3, a.y + a.h / 2);
    expect(tileAt(sx, sy, g, drift, vw, vh)).toBeNull();
    // with the tile grown 4% (about 3 px a side here) the point is on its fringe
    const grown = { i: 9, grow: 0.04 };
    const wide = a.w * 0.02;
    expect(wide).toBeGreaterThan(2.9);
    expect(tileAt(sx, sy, g, drift, vw, vh, grown)).toBe(9);
    // not grown yet: no change
    expect(tileAt(sx, sy, g, drift, vw, vh, { i: 9, grow: 0 })).toBeNull();
    // a point inside a neighbour's nominal box but under the grown fringe belongs to the grown tile
    const [nx, ny] = screen(a.x + a.w + g.gap + 0.5, a.y + a.h / 2);
    expect(tileAt(nx, ny, g, drift, vw, vh)).toBe(10);
    expect(tileAt(nx, ny, g, drift, vw, vh, { i: 9, grow: 0.5 })).toBe(9);
  });

  it("works on a grid object of any fit (phone, portrait tiles)", () => {
    const pg: Grid = fitGrid(40, 390, 844, 9 / 16, safeFor(390, 844));
    for (let i = 0; i < 40; i++) {
      const r = tileRect(pg, i);
      const [sx, sy] = warp(r.x + r.w / 2, r.y + r.h / 2, 390, 844);
      expect(tileAt(sx, sy, pg, { x: 0, y: 0 }, 390, 844)).toBe(i);
    }
  });
});

describe("driftAt", () => {
  it("is a closed path: the same point one period later", () => {
    for (const t of [0, 7.3, 13, 24.9, 41]) {
      const a = driftAt(t);
      const b = driftAt(t + DRIFT_PERIOD_S);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
    }
    expect(DRIFT_PERIOD_S).toBe(50);
  });
  it("stays within 6 px and really moves", () => {
    let maxX = 0;
    let maxY = 0;
    let minX = 0;
    let moved = 0;
    let prev = driftAt(0);
    for (let t = 0; t <= 100; t += 0.05) {
      const d = driftAt(t);
      maxX = Math.max(maxX, Math.abs(d.x));
      maxY = Math.max(maxY, Math.abs(d.y));
      minX = Math.min(minX, d.x);
      moved = Math.max(moved, Math.hypot(d.x - prev.x, d.y - prev.y) / 0.05);
      prev = d;
    }
    expect(DRIFT_RADIUS_PX).toBe(6);
    expect(maxX).toBeLessThanOrEqual(6 + 1e-9);
    expect(maxY).toBeLessThanOrEqual(6 + 1e-9);
    expect(maxX).toBeGreaterThan(5); // it uses its room
    expect(minX).toBeLessThan(-5);
    expect(moved).toBeLessThan(2); // very slow: under 2 px a second
    expect(moved).toBeGreaterThan(0.2);
  });
});

describe("nudge helpers", () => {
  it("rubberBand is the identity near zero and never passes the maximum", () => {
    const small = rubberBand({ x: 1, y: -1 }, NUDGE_MAX_PX);
    expect(small.x).toBeCloseTo(1, 1);
    expect(small.y).toBeCloseTo(-1, 1);
    const big = rubberBand({ x: 1e6, y: 1e6 }, NUDGE_MAX_PX);
    expect(Math.hypot(big.x, big.y)).toBeLessThanOrEqual(NUDGE_MAX_PX + 1e-9);
    expect(rubberBand({ x: 0, y: 0 }, NUDGE_MAX_PX)).toEqual({ x: 0, y: 0 });
  });
  it("settleNudge decays toward zero and snaps the last fraction of a pixel", () => {
    let p = { x: 20, y: -10 };
    let prev = Math.hypot(p.x, p.y);
    for (let i = 0; i < 400; i++) {
      p = settleNudge(p, 1 / 60);
      const m = Math.hypot(p.x, p.y);
      expect(m).toBeLessThanOrEqual(prev);
      prev = m;
    }
    expect(p).toEqual({ x: 0, y: 0 });
  });
});

describe("approach", () => {
  it("eases toward the target without passing it and snaps when close", () => {
    let v = 0;
    for (let i = 0; i < 20; i++) {
      const n = approach(v, 1, 1 / 60, 14);
      expect(n).toBeGreaterThanOrEqual(v);
      expect(n).toBeLessThanOrEqual(1);
      v = n;
    }
    expect(v).toBeGreaterThan(0.9);
    for (let i = 0; i < 200; i++) v = approach(v, 1, 1 / 60, 14);
    expect(v).toBe(1);
    expect(approach(0.5, 0, 1, 1e9)).toBe(0);
  });
});

describe("atlasLayout", () => {
  it("fits every cell in the texture limit with the cell's aspect", () => {
    for (const aspect of ASPECTS) {
      for (const n of [1, 8, 35, 40, 400]) {
        const a = atlasLayout(n, aspect, 320, 4096);
        expect(a.cols * a.rows).toBeGreaterThanOrEqual(n);
        expect(a.width).toBeLessThanOrEqual(4096);
        expect(a.height).toBeLessThanOrEqual(4096);
        expect(a.width).toBe(a.cols * a.cellW);
        expect(a.height).toBe(a.rows * a.cellH);
        expect(a.cellW / a.cellH).toBeCloseTo(aspect, 1);
        expect(Math.max(a.cellW, a.cellH)).toBeLessThanOrEqual(320);
      }
    }
  });
  it("is as square as it can be (a tall strip is not a layout)", () => {
    const a = atlasLayout(40, 16 / 9, 300, 16384);
    expect(Math.max(a.width, a.height) / Math.min(a.width, a.height)).toBeLessThan(1.6);
    const b = atlasLayout(40, 9 / 16, 300, 16384);
    expect(Math.max(b.width, b.height) / Math.min(b.width, b.height)).toBeLessThan(1.6);
  });
  it("keeps the asked cell size when it fits and shrinks it when it cannot", () => {
    const fits = atlasLayout(40, 16 / 9, 320, 4096);
    expect(fits.cellW).toBe(320);
    const tight = atlasLayout(400, 16 / 9, 512, 2048);
    expect(tight.cellW).toBeLessThan(512);
    expect(tight.width).toBeLessThanOrEqual(2048);
  });
});

describe("coverRect", () => {
  it("crops the longer side of the picture, centred, so it fills the tile", () => {
    expect(coverRect(1000, 500, 100, 100)).toEqual({ sx: 250, sy: 0, sw: 500, sh: 500 });
    expect(coverRect(500, 1000, 100, 100)).toEqual({ sx: 0, sy: 250, sw: 500, sh: 500 });
    expect(coverRect(640, 360, 320, 180)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 360 });
  });
});
