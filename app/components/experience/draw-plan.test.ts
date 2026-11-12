import { describe, expect, it } from "vitest";
import { edgeBands, EDGE_BAND, EDGE_OUTSET, EDGE_STOPS, pictureRect, planDraw } from "./draw-plan";
import { fitView } from "./view";
import type { Tile } from "./tiles";

const tile = (z: number, x: number, y: number, left: number, top: number, size: number): Tile => ({ z, x, y, left, top, size });
const M = { size: 8192 };

describe("planDraw", () => {
  it("draws a loaded tile whole, at its own size", () => {
    const p = planDraw([tile(2, 1, 1, 100, 200, 300)], 512, 1, () => true);

    expect(p).toEqual([{ z: 2, x: 1, y: 1, sx: 0, sy: 0, sw: 512, sh: 512, dx: 100, dy: 200, dw: 300, dh: 300 }]);
  });

  it("falls back to the nearest loaded ancestor and takes the right sub-rectangle of it", () => {
    // tile (3, 5, 2) sits in ancestor (2, 2, 1) (its right half, upper... x odd = right, y even = top) and in (1, 1, 0) and (0, 0, 0)
    const has = (z: number, x: number, y: number) => z === 2 && x === 2 && y === 1;
    const [p] = planDraw([tile(3, 5, 2, 0, 0, 256)], 512, 1, has);

    expect(p).toMatchObject({ z: 2, x: 2, y: 1, sx: 256, sy: 0, sw: 256, sh: 256 });
  });

  it("prefers the nearer ancestor over a farther one", () => {
    const [p] = planDraw([tile(3, 5, 2, 0, 0, 256)], 512, 1, (z) => z <= 2);

    expect(p.z).toBe(2);
  });

  it("goes down to level 0 and takes a 1/2^k part of it", () => {
    const [p] = planDraw([tile(3, 7, 7, 0, 0, 256)], 512, 1, (z) => z === 0);

    expect(p).toMatchObject({ z: 0, x: 0, y: 0, sx: 448, sy: 448, sw: 64, sh: 64 });
  });

  it("leaves a tile out when nothing coarser is loaded", () => {
    expect(planDraw([tile(3, 7, 7, 0, 0, 256)], 512, 1, () => false)).toEqual([]);
  });

  it("snaps edges outwards to device pixels so neighbours overlap and never leave a gap", () => {
    for (const dpr of [1, 1.5, 2]) {
      const size = 123.37;
      const tiles = [0, 1, 2, 3].map((i) => tile(4, i, 0, 10.3 + i * size, 5.9, size));
      const ps = planDraw(tiles, 512, dpr, () => true);

      for (let i = 0; i < ps.length - 1; i++) {
        expect(ps[i].dx + ps[i].dw).toBeGreaterThanOrEqual(ps[i + 1].dx - 1e-9);
      }
      for (const p of ps) {
        expect(p.dw).toBeGreaterThanOrEqual(size - 1e-9);
        expect(p.dx * dpr).toBeCloseTo(Math.round(p.dx * dpr), 6);
      }
    }
  });
});

describe("pictureRect", () => {
  it("centres the picture at the overview and sizes it by the scale", () => {
    const v = fitView(1440, 900, M);
    const r = pictureRect(v, 1440, 900, M);

    expect(r.side).toBeCloseTo(8192 * v.scale, 6);
    expect(r.left + r.side / 2).toBeCloseTo(720, 6);
    expect(r.top + r.side / 2).toBeCloseTo(450, 6);
  });
});

describe("edgeBands", () => {
  it("shows the left and right bands at the overview of a wide screen, where the picture does not fill the width", () => {
    const v = fitView(1440, 900, M);
    const bands = edgeBands(v, 1440, 900, M);
    const sides = bands.map((b) => b.side).sort();

    expect(sides).toContain("left");
    expect(sides).toContain("right");
    const left = bands.find((b) => b.side === "left");
    const side = 8192 * v.scale;

    expect(left?.w).toBeCloseTo(side * EDGE_BAND + EDGE_OUTSET, 6);
    expect(left?.x).toBeCloseTo((1440 - side) / 2 - EDGE_OUTSET, 6);
    // the gradient runs from just outside the picture's edge inward
    expect(left?.x0).toBeCloseTo((1440 - side) / 2 - EDGE_OUTSET, 6);
    expect(left!.x1).toBeGreaterThan(left!.x0);
  });

  it("clips every band to the screen", () => {
    for (const [vw, vh] of [[1440, 900], [390, 844], [1024, 768]] as const) {
      const v = fitView(vw, vh, M);

      for (const b of edgeBands(v, vw, vh, M)) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(vw + 1e-6);
        expect(b.y + b.h).toBeLessThanOrEqual(vh + 1e-6);
        expect(b.w).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
      }
    }
  });

  it("leaves out every band when zoomed in on the middle of the picture", () => {
    const v = { cx: 4096, cy: 4096, scale: 1 };

    expect(edgeBands(v, 1440, 900, M)).toEqual([]);
  });

  it("shows the band of the edge the view is panned to", () => {
    const v = { cx: 720, cy: 4096, scale: 1 }; // the screen's left edge is at the picture's left edge
    const bands = edgeBands(v, 1440, 900, M);

    expect(bands.map((b) => b.side)).toEqual(["left"]);
    expect(bands[0].x).toBeCloseTo(0, 6);
    expect(bands[0].w).toBeCloseTo(8192 * EDGE_BAND, 2); // 983 px of band, still inside the 1440 px screen
  });

  it("keeps the band's own picture: the edge is fully the ground and the inside fades to nothing", () => {
    expect(EDGE_STOPS[0]).toEqual([0, 1]);
    expect(EDGE_STOPS[EDGE_STOPS.length - 1]).toEqual([1, 0]);
    for (let i = 1; i < EDGE_STOPS.length; i++) {
      expect(EDGE_STOPS[i][0]).toBeGreaterThan(EDGE_STOPS[i - 1][0]);
      expect(EDGE_STOPS[i][1]).toBeLessThan(EDGE_STOPS[i - 1][1]);
    }
  });

  it("stays clear of the cliff ring at the overview: the band is narrower than the gap between ring and picture edge", () => {
    // the ring is 0.67 of the picture across, so it is 0.165 of the side from each edge
    expect(EDGE_BAND).toBeLessThan((1 - 0.67) / 2);
  });
});
