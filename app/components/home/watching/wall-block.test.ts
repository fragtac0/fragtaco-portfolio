import { describe, expect, it } from "vitest";
import file from "../../../../content/site/videos.json";
import {
  FLOAT_MAX,
  floatWithin,
  MAX_GROW,
  MIN_TILE_W,
  SOFT_EDGE,
  WALL_SEED,
  blockPlan,
  centredPan,
  clampPan,
  loadOrder,
  panRange,
  pullLimits,
  restFloat,
  sizeOfPlan,
  stepTile,
  tileWidthFor,
  wallOrder,
} from "./wall-block";
import { tileSize } from "./wall-math";

/** The Review Focus sizes, plus the ones the wall is judged at. */
const SCREENS: Array<[number, number]> = [
  [320, 568],
  [390, 844],
  [844, 390],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];

describe("tileWidthFor", () => {
  it("is half of round 6's width, never under 96 px", () => {
    expect(tileWidthFor(1440)).toBeCloseTo(tileSize(1440).cw / 2, 6);
    expect(tileWidthFor(4000)).toBe(190);
    expect(tileWidthFor(320)).toBe(MIN_TILE_W);
    expect(tileWidthFor(390)).toBe(MIN_TILE_W);
    for (const [vw] of SCREENS) expect(tileWidthFor(vw)).toBeGreaterThanOrEqual(MIN_TILE_W);
    expect(tileWidthFor(0)).toBe(MIN_TILE_W);
  });
});

describe("blockPlan", () => {
  it.each(SCREENS)("holds every one of the 109 videos at %i by %i", (vw, vh) => {
    const p = blockPlan(109, vw, vh);
    expect(p.cols * p.rows).toBeGreaterThanOrEqual(109);
    // no whole empty row
    expect((p.rows - 1) * p.cols).toBeLessThan(109);
    expect(p.tileW).toBeGreaterThanOrEqual(MIN_TILE_W);
    expect(p.tileH).toBeCloseTo((p.tileW * 9) / 16, 6);
    expect(p.width).toBeCloseTo(p.cols * (p.tileW + p.gap) - p.gap, 6);
    expect(p.height).toBeCloseTo(p.rows * (p.tileH + p.gap) - p.gap, 6);
  });

  it.each(SCREENS)("is larger than the screen in both directions at %i by %i", (vw, vh) => {
    const p = blockPlan(109, vw, vh);
    expect(p.width).toBeGreaterThan(vw);
    expect(p.height).toBeGreaterThan(vh);
  });

  it("never grows the tiles when the block already covers the screen, and keeps them near half of round 6's", () => {
    expect(blockPlan(109, 1440, 900).tileW).toBeCloseTo(tileWidthFor(1440), 9);
    for (const [vw, vh] of SCREENS) {
      expect(blockPlan(109, vw, vh).tileW).toBeLessThanOrEqual(tileWidthFor(vw) * MAX_GROW + 1e-6);
    }
  });

  it("is the same size on every visit and never changes with the order of calls", () => {
    expect(blockPlan(109, 1440, 900)).toEqual(blockPlan(109, 1440, 900));
  });

  it("keeps the round 6 gap ratio, so neighbours that spread keep room", () => {
    for (const [vw, vh] of SCREENS) {
      const s = sizeOfPlan(blockPlan(109, vw, vh));
      expect(s.gap / s.pitchX).toBeGreaterThan(0.069);
      expect(s.pitchX).toBeCloseTo(s.cw + s.gap, 9);
      expect(s.pitchY).toBeCloseTo(s.ch + s.gap, 9);
    }
  });

  it("at 1440 by 900 is a 10 by 11 grid of about 138 px tiles", () => {
    const p = blockPlan(109, 1440, 900);
    expect(p.tileW).toBeCloseTo(138.46, 1);
    expect([p.cols, p.rows]).toEqual([10, 11]);
  });

  it("covers a landscape phone and a small phone in both directions, and the tablet as far as 109 tiles reach", () => {
    for (const [vw, vh] of [
      [844, 390],
      [320, 568],
    ]) {
      const p = blockPlan(109, vw, vh);
      expect(p.width).toBeGreaterThan(vw);
      expect(p.height).toBeGreaterThan(vh);
    }
    // 820 by 1180: 109 of the smallest tiles (115 px) hold about the screen's area and just fail to
    // cover it, so the tiles grow a little (never past MAX_GROW) until they do
    const t = blockPlan(109, 820, 1180);
    expect(t.width).toBeGreaterThan(820);
    expect(t.height).toBeGreaterThan(1180);
    expect(t.tileW).toBeGreaterThan(115);
    expect(t.tileW).toBeLessThanOrEqual(115 * MAX_GROW + 1e-6);
  });

  it("gives the grid that covers the screen best when the count cannot cover it", () => {
    const p = blockPlan(12, 2560, 1440);
    expect(p.cols * p.rows).toBeGreaterThanOrEqual(12);
    const q = blockPlan(1, 1440, 900);
    expect([q.cols, q.rows]).toEqual([1, 1]);
  });

  it("is empty for no videos or no screen", () => {
    expect(blockPlan(0, 1440, 900)).toMatchObject({ cols: 0, rows: 0, width: 0, height: 0 });
    expect(blockPlan(10, 0, 0)).toMatchObject({ cols: 0, rows: 0 });
  });

  it("scales to every count without an empty row", () => {
    for (const n of [1, 2, 3, 7, 50, 109, 112, 400]) {
      const p = blockPlan(n, 1440, 900);
      expect(p.cols * p.rows).toBeGreaterThanOrEqual(n);
      expect((p.rows - 1) * p.cols).toBeLessThan(n);
    }
  });
});

describe("clampPan", () => {
  const vw = 1440;
  const vh = 900;
  const plan = blockPlan(109, vw, vh);

  it("leaves a pan inside the range alone", () => {
    const [x0, x1] = panRange(plan.width, vw);
    const [y0, y1] = panRange(plan.height, vh);
    const mid: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
    expect(clampPan(mid[0], mid[1], plan, vw, vh)).toEqual(mid);
    expect(clampPan(x0 + SOFT_EDGE, y1 - SOFT_EDGE, plan, vw, vh)).toEqual([x0 + SOFT_EDGE, y1 - SOFT_EDGE]);
  });

  it("keeps the block's edge out of the screen's middle third, however far it is pulled", () => {
    for (const pull of [0, 1, 79, 200, 5000, 1e9]) {
      for (const sign of [-1, 1]) {
        const [x, y] = clampPan(sign * pull + plan.width / 2, sign * pull + plan.height / 2, plan, vw, vh);
        // the block's left edge is on screen at -x, its right edge at width - x, and so for y
        expect(-x).toBeLessThanOrEqual(vw / 3 + 1e-9);
        expect(plan.width - x).toBeGreaterThanOrEqual((2 * vw) / 3 - 1e-9);
        expect(-y).toBeLessThanOrEqual(vh / 3 + 1e-9);
        expect(plan.height - y).toBeGreaterThanOrEqual((2 * vh) / 3 - 1e-9);
      }
    }
  });

  it("stops softly: the last 80 px resist, and the edge is reached and never passed", () => {
    const [, hi] = panRange(plan.width, vw);
    const soft = (x: number) => clampPan(x, 0, plan, vw, vh)[0];
    // the step per px of pull falls from 1 to 0 across the soft part
    const slope = (x: number) => soft(x + 0.01) - soft(x);
    expect(slope(hi - SOFT_EDGE - 1) / 0.01).toBeCloseTo(1, 6);
    expect(slope(hi - SOFT_EDGE / 2) / 0.01).toBeLessThan(0.9);
    expect(slope(hi - SOFT_EDGE / 2) / 0.01).toBeGreaterThan(0.1);
    expect(slope(hi + SOFT_EDGE) / 0.01).toBeLessThan(0.02);
    expect(soft(hi + 2 * SOFT_EDGE)).toBeCloseTo(hi, 6);
    expect(soft(hi + 1e6)).toBeCloseTo(hi, 6);
  });

  it("never moves the wall against the pull (monotonic) and is continuous", () => {
    let last = -Infinity;
    for (let x = -1200; x <= plan.width + 1200; x += 7) {
      const v = clampPan(x, 0, plan, vw, vh)[0];
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      if (last > -Infinity) expect(v - last).toBeLessThanOrEqual(7 + 1e-9);
      last = v;
    }
  });

  it("works on both axes independently and symmetrically at the start edge", () => {
    const [x0] = panRange(plan.width, vw);
    expect(clampPan(x0 - 1e6, 123, plan, vw, vh)[0]).toBeCloseTo(x0, 6);
    expect(clampPan(x0 - 1e6, 123, plan, vw, vh)[1]).toBe(123);
    const [y0] = panRange(plan.height, vh);
    expect(clampPan(123, y0 - 1e6, plan, vw, vh)[1]).toBeCloseTo(y0, 6);
  });

  it("centres a block that is much smaller than the screen", () => {
    const tiny = blockPlan(1, 1440, 900);
    const [x, y] = clampPan(5000, -5000, tiny, 1440, 900);
    expect(x).toBeCloseTo((tiny.width - 1440) / 2, 6);
    expect(y).toBeCloseTo((tiny.height - 900) / 2, 6);
  });

  it.each(SCREENS)("holds at %i by %i, at the centred pan and its extremes", (vw2, vh2) => {
    const p = blockPlan(109, vw2, vh2);
    const [cx, cy] = centredPan(p, vw2, vh2);
    expect(clampPan(cx, cy, p, vw2, vh2)).toEqual([cx, cy]);
    const lim = pullLimits(p, vw2, vh2);
    for (const x of lim.x) for (const y of lim.y) {
      const [rx, ry] = clampPan(x, y, p, vw2, vh2);
      const [x0, x1] = panRange(p.width, vw2);
      const [y0, y1] = panRange(p.height, vh2);
      expect(rx).toBeGreaterThanOrEqual(x0 - 1e-9);
      expect(rx).toBeLessThanOrEqual(x1 + 1e-9);
      expect(ry).toBeGreaterThanOrEqual(y0 - 1e-9);
      expect(ry).toBeLessThanOrEqual(y1 + 1e-9);
    }
  });
});

describe("pullLimits", () => {
  it("lets the pull go 80 px past the range and no more", () => {
    const plan = blockPlan(109, 1440, 900);
    const [x0, x1] = panRange(plan.width, 1440);
    const lim = pullLimits(plan, 1440, 900);
    expect(lim.x[0]).toBeCloseTo(x0 - SOFT_EDGE, 6);
    expect(lim.x[1]).toBeCloseTo(x1 + SOFT_EDGE, 6);
  });
});

describe("restFloat", () => {
  it("moves the block a few pixels, never more than FLOAT_MAX", () => {
    let moved = 0;
    for (let t = 0; t < 600; t += 0.37) {
      const [x, y] = restFloat(t);
      expect(Math.abs(x)).toBeLessThanOrEqual(FLOAT_MAX);
      expect(Math.abs(y)).toBeLessThanOrEqual(FLOAT_MAX);
      moved = Math.max(moved, Math.abs(x), Math.abs(y));
    }
    expect(moved).toBeGreaterThan(2);
  });

  it("is a small offset even at t = 0: whether the block floats is the caller's choice", () => {
    const [x, y] = restFloat(0);
    expect(Math.hypot(x, y)).toBeGreaterThan(1);
    expect(Math.hypot(x, y)).toBeLessThan(FLOAT_MAX * 2);
  });

  it("is smooth: no jump between near moments", () => {
    for (let t = 0; t < 120; t += 0.1) {
      const a = restFloat(t);
      const b = restFloat(t + 0.016);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.1);
    }
  });
});

describe("floatWithin", () => {
  it("adds the float whole where there is room", () => {
    expect(floatWithin(100, 3, 0, 200)).toBe(103);
    expect(floatWithin(100, -3, 0, 200)).toBe(97);
    expect(floatWithin(100, 0, 0, 200)).toBe(100);
  });
  it("scales it down within FLOAT_MAX of the end it moves toward, to nothing at the end", () => {
    expect(floatWithin(200, 3, 0, 200)).toBe(200);
    expect(floatWithin(0, -3, 0, 200)).toBe(0);
    expect(floatWithin(198, 3, 0, 200)).toBeCloseTo(198 + 3 * (2 / FLOAT_MAX), 9);
    // moving away from the near end it keeps its whole size
    expect(floatWithin(200, -3, 0, 200)).toBe(197);
  });
  it("never leaves the range, at any float and any position in or near it", () => {
    for (let p = -2; p <= 12; p += 0.5) {
      for (let t = 0; t < 200; t += 1.7) {
        const [f] = restFloat(t);
        const v = floatWithin(Math.min(10, Math.max(0, p)), f, 0, 10);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(10 + 1e-9);
      }
    }
  });
  it("is smooth in the float", () => {
    expect(Math.abs(floatWithin(198, 0.01, 0, 200) - floatWithin(198, -0.01, 0, 200))).toBeLessThan(0.02);
  });
  it("holds a block with no room (a range of one point) still", () => {
    expect(floatWithin(5, 4, 5, 5)).toBe(5);
    expect(floatWithin(5, -4, 5, 5)).toBe(5);
  });
});

describe("stepTile", () => {
  const plan = { cols: 4, rows: 3 };
  it("moves one tile along the grid", () => {
    expect(stepTile(plan, 12, 1, 1, 1, 0)).toEqual({ cx: 2, cy: 1 });
    expect(stepTile(plan, 12, 1, 1, -1, 0)).toEqual({ cx: 0, cy: 1 });
    expect(stepTile(plan, 12, 1, 1, 0, 1)).toEqual({ cx: 1, cy: 2 });
    expect(stepTile(plan, 12, 1, 1, 0, -1)).toEqual({ cx: 1, cy: 0 });
  });
  it("stays at the block's edge", () => {
    expect(stepTile(plan, 12, 0, 0, -1, 0)).toEqual({ cx: 0, cy: 0 });
    expect(stepTile(plan, 12, 3, 2, 1, 0)).toEqual({ cx: 3, cy: 2 });
    expect(stepTile(plan, 12, 3, 2, 0, 1)).toEqual({ cx: 3, cy: 2 });
    expect(stepTile(plan, 12, 0, 0, 0, -1)).toEqual({ cx: 0, cy: 0 });
  });
  it("does not step onto the empty end of the last row", () => {
    expect(stepTile(plan, 10, 1, 2, 1, 0)).toEqual({ cx: 1, cy: 2 });
    expect(stepTile(plan, 10, 2, 1, 0, 1)).toEqual({ cx: 2, cy: 1 });
    expect(stepTile(plan, 10, 1, 1, 0, 1)).toEqual({ cx: 1, cy: 2 });
  });
});

describe("loadOrder", () => {
  it("lists every video once, the middle of the block first", () => {
    const plan = { cols: 5, rows: 5 };
    const order = loadOrder(plan, 25);
    expect(order[0]).toBe(12);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(order.slice(-4).sort((a, b) => a - b)).toEqual([0, 4, 20, 24]);
  });
  it("copes with no videos", () => {
    expect(loadOrder({ cols: 0, rows: 0 }, 0)).toEqual([]);
  });
});

describe("wallOrder", () => {
  const list = file.items as Array<{ id: string }>;
  it("is the same order on every call, and holds the same 109 videos", () => {
    expect(list).toHaveLength(109);
    const a = wallOrder(list);
    expect(a.map((v) => v.id)).toEqual(wallOrder(list).map((v) => v.id));
    expect([...a.map((v) => v.id)].sort()).toEqual([...list.map((v) => v.id)].sort());
    expect(a.map((v) => v.id)).not.toEqual(list.map((v) => v.id));
    expect(WALL_SEED).toBe(109);
  });
  it("does not change the list it is given", () => {
    const before = list.map((v) => v.id);
    wallOrder(list);
    expect(list.map((v) => v.id)).toEqual(before);
  });
});
