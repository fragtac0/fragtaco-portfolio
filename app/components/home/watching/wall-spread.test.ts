import { describe, expect, it } from "vitest";
import { tileSize } from "./wall-math";
import {
  chosenRect,
  coveredShare,
  easeInOut,
  nearestInDirection,
  overlaps,
  spread,
  stepToward,
  textZone,
  PUSH_MAX,
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
    expect(Math.hypot(at(24).x - (base.cx + 24), 0)).toBeCloseTo(PUSH_MAX * (1 - smoothAt(24)), 6);
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

/** The same smoothstep falloff as the module, for one expectation. */
function smoothAt(d: number): number {
  const u = Math.min(1, d / (0.6 * 848));
  return u * u * (3 - 2 * u);
}

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
    const z = textZone(r);
    expect(z.y).toBeGreaterThan(r.y + r.h);
    expect(z.y + z.h).toBeLessThanOrEqual(vh);
    expect(z.x).toBe(r.x);
    expect(z.w).toBe(r.w);
  });

  it("is about twice a tile, at most 52% of the width, and 86% when narrow", () => {
    const wide = chosenRect(1440, 900, false);
    expect(wide.w).toBeCloseTo(2 * tileSize(1440).cw, 6);
    expect(wide.w).toBeLessThanOrEqual(1440 * 0.52);
    const mid = chosenRect(1024, 768, false);
    expect(mid.w).toBeLessThanOrEqual(1024 * 0.52 + 1e-9);
    const phone = chosenRect(390, 844, true);
    expect(phone.w).toBeCloseTo(390 * 0.86, 6);
    const small = chosenRect(320, 568, true);
    expect(small.w).toBeCloseTo(320 * 0.86, 6);
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
    const z = textZone(r);
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
