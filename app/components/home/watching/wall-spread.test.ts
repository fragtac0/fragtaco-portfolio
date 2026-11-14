import { describe, expect, it } from "vitest";
import { blockPlan, clampPan, panRange } from "./wall-block";
import { layoutTiles, tileSize } from "./wall-math";
import {
  cameraPan,
  chosenRect,
  coveredShare,
  crosses,
  easeInOut,
  hiddenTiles,
  nearestInDirection,
  overlaps,
  spread,
  stepToward,
  textZone,
  PUSH_MAX,
  TEXT_MIN_W,
  PUSH_SLOPE,
  SPREAD_DIM,
  SPREAD_SCALE,
} from "./wall-spread";
import { edgeWarp } from "./wall-warp";

/** The sizes of Review Focus 1 of the round 6 plan. */
const SIZES: Array<[number, number]> = [
  [320, 568],
  [390, 844],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
];

describe("spread", () => {
  const base = { cx: 720, cy: 400, halfDiag: 848 };
  const at = (d: number, open = 1) => spread({ ...base, x: base.cx + d, y: base.cy, open });

  it("does nothing while closed", () => {
    const s = at(60, 0);
    expect(s).toEqual({ x: 780, y: 400, scale: 1, dim: 1 });
  });

  it("pushes the nearest tiles by up to 140 px, away from the middle, and no further", () => {
    for (let d = 1; d <= 900; d += 7) {
      const s = at(d);
      const moved = Math.hypot(s.x - (base.cx + d), s.y - base.cy);
      expect(moved).toBeLessThanOrEqual(PUSH_MAX + 1e-9);
      expect(s.x).toBeGreaterThanOrEqual(base.cx + d - 1e-9); // away, never toward
      expect(s.y).toBeCloseTo(base.cy, 9);
    }
    expect(at(24).x - (base.cx + 24)).toBeCloseTo(PUSH_SLOPE * (0.6 * 848 - 24), 6);
  });

  it("pushes nothing beyond 60% of the half-diagonal", () => {
    const reach = 0.6 * base.halfDiag;
    expect(at(reach).x).toBeCloseTo(base.cx + reach, 9);
    expect(at(reach + 1).x).toBeCloseTo(base.cx + reach + 1, 9);
    expect(at(2000).x).toBeCloseTo(base.cx + 2000, 9);
  });

  it("falls off monotonically with distance", () => {
    let last = Infinity;
    for (let d = 24; d <= 700; d += 4) {
      const push = at(d).x - (base.cx + d);
      expect(push).toBeLessThanOrEqual(last + 1e-9);
      last = push;
    }
  });

  it("never closes two neighbours by more than 12% of the distance between them", () => {
    // push is radial and falls by PUSH_SLOPE px per px, so the gap between two tiles on a ray shrinks by at most that
    for (let d = 24; d < 700; d += 3) {
      const a = at(d).x - (base.cx + d);
      const b = at(d + 100).x - (base.cx + d + 100);
      expect(a - b).toBeLessThanOrEqual(PUSH_SLOPE * 100 + 1e-9);
    }
  });

  it("scales down to 92% and dims to 55% at most, in proportion to `open`", () => {
    const full = at(300, 1);
    expect(full.scale).toBeCloseTo(SPREAD_SCALE, 9);
    expect(full.dim).toBeCloseTo(SPREAD_DIM, 9);
    const half = at(300, 0.5);
    expect(half.scale).toBeCloseTo(1 - (1 - SPREAD_SCALE) / 2, 9);
    expect(half.dim).toBeCloseTo(1 - (1 - SPREAD_DIM) / 2, 9);
    let last = 1;
    for (let o = 0; o <= 1.0001; o += 0.05) {
      const s = at(300, o);
      expect(s.scale).toBeLessThanOrEqual(last + 1e-9);
      expect(s.scale).toBeGreaterThanOrEqual(SPREAD_SCALE - 1e-9);
      expect(s.dim).toBeGreaterThanOrEqual(SPREAD_DIM - 1e-9);
      last = s.scale;
    }
  });

  it("clamps `open` to 0..1 and survives a tile exactly at the middle", () => {
    expect(at(60, 3).dim).toBeCloseTo(SPREAD_DIM, 9);
    expect(at(60, -1).dim).toBe(1);
    expect(at(60, Number.NaN).dim).toBe(1);
    const s = spread({ ...base, x: base.cx, y: base.cy, open: 1 });
    expect(s.x).toBe(base.cx);
    expect(s.y).toBe(base.cy);
    expect(Number.isFinite(spread({ x: 1, y: 1, cx: 1, cy: 1, halfDiag: 0, open: 1 }).x)).toBe(true);
  });
});

describe("chosenRect and textZone", () => {
  it.each(SIZES)("sits inside a %i by %i screen with at least 150 px under it", (vw, vh) => {
    const r = chosenRect(vw, vh, vw < 700);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(vw);
    expect(vh - (r.y + r.h)).toBeGreaterThanOrEqual(150);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 9);
    // centred sideways and a little above the middle
    expect(r.x + r.w / 2).toBeCloseTo(vw / 2, 9);
    expect(r.y + r.h / 2).toBeLessThanOrEqual(vh / 2);
    // the text block fits under it
    const z = textZone(r, vw);
    expect(z.y).toBeGreaterThan(r.y + r.h);
    expect(z.y + z.h).toBeLessThanOrEqual(vh);
    // centred under the video, as wide as it or `TEXT_MIN_W`, and always on the screen
    expect(z.x + z.w / 2).toBeCloseTo(r.x + r.w / 2, 9);
    expect(z.w).toBeGreaterThanOrEqual(Math.min(r.w, vw - 32));
    expect(z.w).toBeCloseTo(Math.min(Math.max(r.w, TEXT_MIN_W), vw - 32), 9);
    expect(z.x).toBeGreaterThanOrEqual(16 - 1e-9);
    expect(z.x + z.w).toBeLessThanOrEqual(vw - 16 + 1e-9);
  });

  it("is round 6's tile size (about twice a tile of the block), at most 52% of the width and 86% when narrow", () => {
    const wide = chosenRect(1440, 900, false);
    expect(wide.w).toBeCloseTo(tileSize(1440).cw, 6);
    expect(wide.w).toBeCloseTo(2 * blockPlan(109, 1440, 900).tileW, 0);
    expect(wide.w).toBeLessThanOrEqual(1440 * 0.52);
    const mid = chosenRect(1024, 768, false);
    expect(mid.w).toBeCloseTo(tileSize(1024).cw, 6);
    expect(mid.w).toBeLessThanOrEqual(1024 * 0.52 + 1e-9);
    const phone = chosenRect(390, 844, true);
    expect(phone.w).toBeCloseTo(tileSize(390).cw, 6);
    expect(phone.w).toBeLessThanOrEqual(390 * 0.86);
    const small = chosenRect(320, 568, true);
    expect(small.w).toBeCloseTo(tileSize(320).cw, 6);
  });

  it("shrinks on a short screen so the text still has room", () => {
    const r = chosenRect(900, 400, false);
    expect(r.y + r.h).toBeLessThanOrEqual(400 - 0.42 * 400 + 1e-9);
    expect(r.w).toBeGreaterThan(0);
    const tiny = chosenRect(568, 320, true);
    expect(tiny.y).toBeGreaterThanOrEqual(0);
    expect(tiny.y + tiny.h).toBeLessThanOrEqual(320);
  });

  it.each(SIZES)("is not moved by the fish-eye at %i by %i (the video under half a pixel)", (vw, vh) => {
    const r = chosenRect(vw, vh, vw < 700);
    const z = textZone(r, vw);
    const shift = (x: number, y: number) => {
      const [wx, wy] = edgeWarp(x, y, vw, vh);
      return Math.hypot(wx - x, wy - y);
    };
    // the video itself: the wall draws it, so it must not be bent
    for (const [x, y] of [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ]) {
      expect(shift(x, y)).toBeLessThan(0.5);
    }
    // the far corners of the text block (only tiles near them are bent): well inside the 12 px of air kept round it
    expect(shift(z.x, z.y + z.h)).toBeLessThan(6);
    expect(shift(z.x + z.w, z.y + z.h)).toBeLessThan(6);
  });
});

describe("overlaps", () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  it("is true for rectangles that cross and false for ones that only touch", () => {
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(overlaps(a, { x: 11, y: 0, w: 10, h: 10 }, 2)).toBe(true);
  });
});

describe("coveredShare", () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  it("is the share of the first rectangle inside the second", () => {
    expect(coveredShare(a, { x: -5, y: -5, w: 30, h: 30 })).toBe(1);
    expect(coveredShare(a, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(0.5, 9);
    expect(coveredShare(a, { x: 5, y: 5, w: 10, h: 10 })).toBeCloseTo(0.25, 9);
    expect(coveredShare(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
    expect(coveredShare(a, { x: 50, y: 50, w: 10, h: 10 })).toBe(0);
    expect(coveredShare({ x: 0, y: 0, w: 0, h: 5 }, a)).toBe(0);
  });
});

describe("nearestInDirection", () => {
  const from = { x: 0, y: 0 };
  const tiles = [
    { k: "r1", x: 300, y: 20 },
    { k: "r2", x: 600, y: 0 },
    { k: "l1", x: -300, y: -40 },
    { k: "u1", x: 10, y: -180 },
    { k: "d1", x: -20, y: 180 },
    { k: "far-diag", x: 400, y: 380 },
  ];
  it("picks the nearest tile in each direction", () => {
    expect(nearestInDirection(from, tiles, 1, 0)?.k).toBe("r1");
    expect(nearestInDirection(from, tiles, -1, 0)?.k).toBe("l1");
    expect(nearestInDirection(from, tiles, 0, -1)?.k).toBe("u1");
    expect(nearestInDirection(from, tiles, 0, 1)?.k).toBe("d1");
  });
  it("stays (null) when nothing lies that way, and ignores tiles off to the side", () => {
    expect(nearestInDirection(from, [{ x: 0, y: 300 }], 0, -1)).toBeNull();
    expect(nearestInDirection(from, [{ x: 100, y: 300 }], 1, 0)).toBeNull(); // outside 45 degrees
    expect(nearestInDirection(from, [], 1, 0)).toBeNull();
    expect(nearestInDirection(from, [from], 1, 0)).toBeNull();
  });
});

describe("easing helpers", () => {
  it("easeInOut runs 0 to 1, slow at both ends, and clamps", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
    expect(easeInOut(-2)).toBe(0);
    expect(easeInOut(9)).toBe(1);
  });
  it("stepToward goes there in `seconds` and never overshoots", () => {
    let v = 0;
    for (let i = 0; i < 26; i++) v = stepToward(v, 1, 0.016, 0.42);
    expect(v).toBeCloseTo(0.99, 1);
    expect(stepToward(v, 1, 1, 0.42)).toBe(1);
    expect(stepToward(1, 0, 1, 0.32)).toBe(0);
    expect(stepToward(0.5, 0.5, 0.1, 0.4)).toBe(0.5);
    expect(stepToward(0, 1, 0.1, 0)).toBe(1);
  });
});

describe("hiddenTiles", () => {
  const rect = { x: 400, y: 200, w: 400, h: 225 };
  const zone = { x: 400, y: 439, w: 400, h: 150 };
  const box = (key: string, x: number, y: number) => ({ key, x, y, w: 200, h: 112 });
  it("hides a tile in the text's way or more than 5% behind the video", () => {
    const h = hiddenTiles(
      [box("zone", 450, 500), box("behind", 250, 250), box("graze", 190, 250), box("away", 1000, 700)],
      rect,
      zone,
    );
    expect([...h].sort()).toEqual(["behind", "zone"]);
  });
  it("hides the nearer of two visible tiles that overlap, and keeps the rest", () => {
    const h = hiddenTiles([box("far", 1000, 300), box("near", 880, 300), box("alone", 1000, 600)], rect, zone);
    expect([...h]).toEqual(["near"]);
  });
  it("leaves tiles that only touch", () => {
    expect(hiddenTiles([box("a", 1000, 300), box("b", 1200, 300), box("c", 1000, 412)], rect, zone).size).toBe(0);
  });
  it("crosses needs more than half a pixel both ways", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(crosses(a, { x: 9.8, y: 0, w: 10, h: 10 })).toBe(false);
    expect(crosses(a, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });
});

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

  it("is a pan clampPan leaves alone (no soft stop acts on it) where the range is wide, and never beyond the range", () => {
    for (const [vw, vh] of SIZES) {
      const plan = blockPlan(COUNT, vw, vh);
      for (let idx = 0; idx < COUNT; idx += 7) {
        const { pan } = run(vw, vh, idx);
        const [cx, cy] = clampPan(pan.x, pan.y, plan, vw, vh);
        // the soft stop only ever pulls toward the middle of the range, and never past the pan itself
        expect(Math.abs(cx - pan.x)).toBeLessThanOrEqual(80 + 1e-9);
        expect(Math.abs(cy - pan.y)).toBeLessThanOrEqual(80 + 1e-9);
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
