import { describe, expect, it } from "vitest";
import { blockPlan, centredPan, sizeOfPlan } from "./wall-block";
import { layoutTiles, hitTile } from "./wall-math";
import { WARP_INNER, WARP_MAX, edgeUnwarp, edgeWarp, warpMargin, warpShift } from "./wall-warp";

const sizes: Array<[number, number]> = [
  [1440, 900],
  [1920, 1080],
  [390, 844],
  [2560, 1440],
];

describe("edgeWarp", () => {
  it("is the identity inside 55% of the half-diagonal", () => {
    for (const [vw, vh] of sizes) {
      const hd = Math.hypot(vw / 2, vh / 2);
      for (let a = 0; a < 360; a += 15) {
        const rad = (a * Math.PI) / 180;
        const r = WARP_INNER * hd;
        const x = vw / 2 + Math.cos(rad) * r;
        const y = vh / 2 + Math.sin(rad) * r;
        const [wx, wy] = edgeWarp(x, y, vw, vh);
        expect(wx).toBeCloseTo(x, 9);
        expect(wy).toBeCloseTo(y, 9);
      }
      expect(edgeWarp(vw / 2, vh / 2, vw, vh)).toEqual([vw / 2, vh / 2]);
    }
  });

  it("pulls the corners in by 2.2% of the half-diagonal, toward the centre", () => {
    for (const [vw, vh] of sizes) {
      const hd = Math.hypot(vw / 2, vh / 2);
      for (const [x, y] of [
        [0, 0],
        [vw, 0],
        [0, vh],
        [vw, vh],
      ]) {
        const [wx, wy] = edgeWarp(x, y, vw, vh);
        const moved = Math.hypot(wx - x, wy - y);
        expect(moved).toBeCloseTo(WARP_MAX * hd, 6);
        const before = Math.hypot(x - vw / 2, y - vh / 2);
        const after = Math.hypot(wx - vw / 2, wy - vh / 2);
        expect(after).toBeLessThan(before);
      }
    }
  });

  it("is smooth at the join: no step, and the pull grows without a kink", () => {
    expect(warpShift(WARP_INNER)).toBe(0);
    expect(warpShift(WARP_INNER - 0.1)).toBe(0);
    expect(warpShift(1)).toBeCloseTo(WARP_MAX, 12);
    expect(warpShift(1.2)).toBeCloseTo(WARP_MAX, 12);
    // the slope just past the join is tiny (continuous with the flat part before it)
    const h = 1e-4;
    expect((warpShift(WARP_INNER + h) - warpShift(WARP_INNER)) / h).toBeLessThan(0.001);
    // and the pull never shrinks outward
    let last = 0;
    for (let r = 0; r <= 1.05; r += 0.01) {
      expect(warpShift(r)).toBeGreaterThanOrEqual(last);
      last = warpShift(r);
    }
  });

  it("stays monotonic: a point further out never lands nearer the centre", () => {
    const vw = 1440;
    const vh = 900;
    let last = -1;
    for (let x = vw / 2; x <= vw + 40; x += 2) {
      const [wx] = edgeWarp(x, vh / 2, vw, vh);
      expect(wx).toBeGreaterThan(last);
      last = wx;
    }
  });

  it("copes with a zero-sized view", () => {
    expect(edgeWarp(5, 6, 0, 0)).toEqual([5, 6]);
    expect(edgeUnwarp(5, 6, 0, 0)).toEqual([5, 6]);
  });
});

describe("edgeUnwarp", () => {
  it("inverts edgeWarp to within 0.5 px over the screen and a margin beyond it", () => {
    for (const [vw, vh] of sizes) {
      let worst = 0;
      for (let x = -40; x <= vw + 40; x += vw / 37) {
        for (let y = -40; y <= vh + 40; y += vh / 29) {
          const [wx, wy] = edgeWarp(x, y, vw, vh);
          const [bx, by] = edgeUnwarp(wx, wy, vw, vh);
          worst = Math.max(worst, Math.hypot(bx - x, by - y));
          const [sx, sy] = edgeUnwarp(x, y, vw, vh);
          const [cx, cy] = edgeWarp(sx, sy, vw, vh);
          worst = Math.max(worst, Math.hypot(cx - x, cy - y));
        }
      }
      expect(worst).toBeLessThan(0.5);
    }
  });

  it("is within 0.01 px: the margin is generous", () => {
    const [wx, wy] = edgeWarp(1400, 880, 1440, 900);
    const [bx, by] = edgeUnwarp(wx, wy, 1440, 900);
    expect(Math.hypot(bx - 1400, by - 880)).toBeLessThan(0.01);
  });

  it("pushes the screen corner out to a wall point beyond the view, inside the margin", () => {
    const [wx, wy] = edgeUnwarp(0, 0, 1440, 900);
    expect(wx).toBeLessThan(0);
    expect(wy).toBeLessThan(0);
    const m = warpMargin(1440, 900);
    expect(-wx).toBeLessThanOrEqual(m);
    expect(-wy).toBeLessThanOrEqual(m);
  });
});

describe("a click at a warped corner", () => {
  it("hits the tile drawn there", () => {
    const vw = 1440;
    const vh = 900;
    // a block bigger than the screen, the view in the middle of it
    const plan = blockPlan(400, vw, vh);
    const size = sizeOfPlan(plan);
    const [px, py] = centredPan(plan, vw, vh);
    const tiles = layoutTiles({ viewX: px + 37, viewY: py + 12, vw, vh, plan, count: 400 });
    // every tile that shows on screen: click where its warped centre is, get that tile back
    let checked = 0;
    let corner = 0;
    for (const tl of tiles) {
      const [sx, sy] = edgeWarp(tl.x + size.cw / 2, tl.y + size.ch / 2, vw, vh);
      if (sx < 0 || sx > vw || sy < 0 || sy > vh) continue;
      const [wx, wy] = edgeUnwarp(sx, sy, vw, vh);
      expect(hitTile(tiles, wx, wy, size)).toBe(tl.key);
      checked++;
      if (Math.hypot(sx - vw / 2, sy - vh / 2) > 0.8 * Math.hypot(vw / 2, vh / 2)) corner++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(corner).toBeGreaterThan(2);
  });

  it("takes the tile at the very corner of the screen", () => {
    const vw = 1440;
    const vh = 900;
    const plan = blockPlan(400, vw, vh);
    const size = sizeOfPlan(plan);
    const [px, py] = centredPan(plan, vw, vh);
    const tiles = layoutTiles({ viewX: px, viewY: py, vw, vh, plan, count: 400 });
    for (const [sx, sy] of [
      [2, 2],
      [vw - 2, 2],
      [2, vh - 2],
      [vw - 2, vh - 2],
    ]) {
      const [wx, wy] = edgeUnwarp(sx, sy, vw, vh);
      expect(hitTile(tiles, wx, wy, size)).not.toBeNull();
      // the unwarped point lies where the warp would put it back on the pixel clicked
      const [bx, by] = edgeWarp(wx, wy, vw, vh);
      expect(Math.hypot(bx - sx, by - sy)).toBeLessThan(0.01);
    }
  });
});
