import { describe, expect, it } from "vitest";
import { blockPlan, clampPan, panRange, SOFT_EDGE } from "./wall-block";
import { layoutTiles } from "./wall-math";
import { cameraPan, chosenRect } from "./wall-spread";

/** The sizes of Review Focus 1 of the round 6 plan. */
const SIZES: Array<[number, number]> = [
  [320, 568],
  [390, 844],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
];

describe("cameraPan", () => {
  const COUNT = 109;
  /** The pan the camera goes to for tile `idx`, and where that leaves the tile's centre on the screen. */
  const run = (vw: number, vh: number, idx: number) => {
    const plan = blockPlan(COUNT, vw, vh);
    const r = chosenRect(vw, vh, vw < 700);
    const place = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const pan = cameraPan({ idx, plan, place, vw, vh });
    const cx = idx % plan.cols;
    const cy = Math.floor(idx / plan.cols);
    const at = {
      x: cx * (plan.tileW + plan.gap) + plan.tileW / 2 - pan.x,
      y: cy * (plan.tileH + plan.gap) + plan.tileH / 2 - pan.y,
    };
    return { plan, place, pan, at };
  };

  it.each(SIZES)("brings every tile to the chosen place, or as near as the block's range allows, at %i by %i", (vw, vh) => {
    const plan = blockPlan(COUNT, vw, vh);
    const [x0, x1] = panRange(plan.width, vw);
    const [y0, y1] = panRange(plan.height, vh);
    for (let idx = 0; idx < COUNT; idx++) {
      const { place, pan, at } = run(vw, vh, idx);
      // always inside the range clampPan keeps (so the block's edge never passes the middle third)
      expect(pan.x).toBeGreaterThanOrEqual(x0 - 1e-9);
      expect(pan.x).toBeLessThanOrEqual(x1 + 1e-9);
      expect(pan.y).toBeGreaterThanOrEqual(y0 - 1e-9);
      expect(pan.y).toBeLessThanOrEqual(y1 + 1e-9);
      // per axis: on the place exactly when the range allows it, else as near as it comes (pinned to an end)
      for (const [a, p, lo, hi, want] of [
        [at.x, pan.x, x0, x1, place.x],
        [at.y, pan.y, y0, y1, place.y],
      ] as const) {
        if (p > lo + 1e-9 && p < hi - 1e-9) expect(a).toBeCloseTo(want, 6);
        else {
          // pinned: no pan in the range comes nearer
          const ideal = p + (a - want);
          expect(Math.abs(a - want)).toBeCloseTo(Math.abs(Math.min(hi, Math.max(lo, ideal)) - ideal), 6);
        }
      }
    }
  });

  it("puts a tile in the middle of the block exactly at the chosen place", () => {
    for (const [vw, vh] of SIZES) {
      const plan = blockPlan(COUNT, vw, vh);
      const idx = Math.floor(plan.rows / 2) * plan.cols + Math.floor(plan.cols / 2);
      const { place, at } = run(vw, vh, idx);
      expect(at.x).toBeCloseTo(place.x, 6);
      expect(at.y).toBeCloseTo(place.y, 6);
    }
  });

  it("leaves a corner tile short of the place by only what the range keeps from it, and on the screen", () => {
    for (const [vw, vh] of SIZES) {
      const plan = blockPlan(COUNT, vw, vh);
      for (const idx of [0, plan.cols - 1, (plan.rows - 1) * plan.cols, COUNT - 1]) {
        const { at } = run(vw, vh, idx);
        expect(at.x).toBeGreaterThan(0);
        expect(at.x).toBeLessThan(vw);
        expect(at.y).toBeGreaterThan(0);
        expect(at.y).toBeLessThan(vh);
      }
    }
  });

  it("is a pan clampPan leaves alone while it is clear of the soft band, and a pinned one sits in that band, never beyond the range", () => {
    for (const [vw, vh] of SIZES) {
      const plan = blockPlan(COUNT, vw, vh);
      const [x0, x1] = panRange(plan.width, vw);
      const [y0, y1] = panRange(plan.height, vh);
      for (let idx = 0; idx < COUNT; idx++) {
        const { pan } = run(vw, vh, idx);
        const [cx, cy] = clampPan(pan.x, pan.y, plan, vw, vh);
        for (const [p, c, lo, hi] of [
          [pan.x, cx, x0, x1],
          [pan.y, cy, y0, y1],
        ] as const) {
          const margin = Math.min(SOFT_EDGE, (hi - lo) / 2);
          if (p >= lo + margin && p <= hi - margin) expect(c).toBe(p);
          else {
            // in the band (a tile near the block's corner, R85): the soft stop pulls it in by under a quarter of its length, and keeps it in the range
            expect(Math.abs(c - p)).toBeLessThanOrEqual(margin / 4 + 1e-9);
            expect(c).toBeGreaterThanOrEqual(lo - 1e-9);
            expect(c).toBeLessThanOrEqual(hi + 1e-9);
          }
        }
      }
    }
  });

  it("moves with the tile: the next column along is one pitch further, until the range stops it", () => {
    const vw = 1440;
    const vh = 900;
    const plan = blockPlan(COUNT, vw, vh);
    const row = Math.floor(plan.rows / 2) * plan.cols;
    const a = run(vw, vh, row + 4).pan;
    const b = run(vw, vh, row + 5).pan;
    expect(b.x - a.x).toBeCloseTo(plan.tileW + plan.gap, 6);
    expect(b.y).toBeCloseTo(a.y, 9);
  });

  it("survives a block with no columns and a block smaller than the screen", () => {
    expect(cameraPan({ idx: 3, plan: blockPlan(0, 1440, 900), place: { x: 1, y: 1 }, vw: 1440, vh: 900 })).toEqual({ x: 0, y: 0 });
    const tiny = blockPlan(2, 1440, 900);
    const p = cameraPan({ idx: 1, plan: tiny, place: { x: 720, y: 400 }, vw: 1440, vh: 900 });
    expect(p.x).toBeCloseTo((tiny.width - 1440) / 2, 6);
    expect(layoutTiles({ viewX: p.x, viewY: p.y, vw: 1440, vh: 900, plan: tiny, count: 2 }).length).toBe(2);
  });
});
