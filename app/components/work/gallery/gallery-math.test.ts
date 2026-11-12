import { describe, expect, it } from "vitest";
import {
  fitGrid,
  safeInsets,
  tileRect,
  unwarp,
  warp,
} from "./gallery-math";

/** Review Focus 1: the same screen sizes as the rings' tests. */
const SIZES: [number, number][] = [
  [320, 568],
  [568, 320],
  [640, 360],
  [667, 375],
  [375, 667],
  [360, 640],
  [500, 400],
  [390, 844],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
  [1920, 1080],
];
const COUNTS = [1, 8, 35, 40];
const ASPECTS = [16 / 9, 9 / 16];
/** A heading band of 72 px above and the dock's 108 px below, as the wall page would pass them. */
const safeFor = (vw: number, vh: number) => safeInsets(vw, vh, 72, 108);
const EPS = 1e-6;

describe("safeInsets", () => {
  it("is a 4% margin plus the heading band above and the dock band below", () => {
    const s = safeInsets(1000, 800, 72, 108);
    expect(s.side).toBeCloseTo(40, 6);
    expect(s.top).toBeCloseTo(32 + 72, 6);
    expect(s.bottom).toBeCloseTo(32 + 108, 6);
  });
  it("without bands is the margin alone", () => {
    expect(safeInsets(1000, 800)).toEqual({ top: 32, bottom: 32, side: 40 });
  });
});

describe("fitGrid", () => {
  for (const [vw, vh] of SIZES) {
    for (const aspect of ASPECTS) {
      for (const n of COUNTS) {
        const safe = safeFor(vw, vh);
        const name = `${n} tiles at ${vw}x${vh}, aspect ${aspect.toFixed(2)}`;

        it(`puts every tile inside the safe area: ${name}`, () => {
          const g = fitGrid(n, vw, vh, aspect, safe);
          expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
          expect(g.tileW).toBeGreaterThan(0);
          expect(g.tileH).toBeCloseTo(g.tileW / aspect, 6);
          for (let i = 0; i < n; i++) {
            const r = tileRect(g, i);
            expect(r.x).toBeGreaterThanOrEqual(safe.side - EPS);
            expect(r.x + r.w).toBeLessThanOrEqual(vw - safe.side + EPS);
            expect(r.y).toBeGreaterThanOrEqual(safe.top - EPS);
            expect(r.y + r.h).toBeLessThanOrEqual(vh - safe.bottom + EPS);
          }
        });

        it(`no other columns and rows give a larger tile: ${name}`, () => {
          const g = fitGrid(n, vw, vh, aspect, safe);
          const aw = vw - 2 * safe.side;
          const ah = vh - safe.top - safe.bottom;
          let best = 0;
          for (let c = 1; c <= n; c++) {
            const r = Math.ceil(n / c);
            const w = Math.min((aw - (c - 1) * 10) / c, ((ah - (r - 1) * 10) / r) * aspect);
            best = Math.max(best, w);
          }
          expect(g.tileW).toBeGreaterThanOrEqual(best - 1e-9);
          expect(g.tileW).toBeLessThanOrEqual(best + 1e-9);
        });
      }
    }
  }

  it("keeps a 10 px gap between neighbours by default and takes another", () => {
    const g = fitGrid(8, 1440, 900, 16 / 9, safeFor(1440, 900));
    expect(g.gap).toBe(10);
    const a = tileRect(g, 0);
    const b = tileRect(g, 1);
    expect(b.x - (a.x + a.w)).toBeCloseTo(10, 6);
    const c = fitGrid(8, 1440, 900, 16 / 9, safeFor(1440, 900), 4);
    expect(c.gap).toBe(4);
    expect(c.tileW).toBeGreaterThan(g.tileW);
  });

  it("a single tile is as large as the safe area lets it, centred", () => {
    const safe = { top: 100, bottom: 100, side: 40 };
    const g = fitGrid(1, 1000, 800, 16 / 9, safe);
    expect([g.cols, g.rows]).toEqual([1, 1]);
    expect(g.tileW).toBeCloseTo(920, 6);
    const r = tileRect(g, 0);
    expect(r.x + r.w / 2).toBeCloseTo(500, 6);
    expect(r.y + r.h / 2).toBeCloseTo(400, 6);
  });

  it("centres a short last row and leaves full rows alone", () => {
    const g = fitGrid(8, 1440, 900, 16 / 9, safeFor(1440, 900));
    const inLast = 8 - (g.rows - 1) * g.cols;
    if (inLast < g.cols) {
      expect(g.lastRowOffset).toBeCloseTo(((g.cols - inLast) * (g.tileW + g.gap)) / 2, 6);
      const first = tileRect(g, (g.rows - 1) * g.cols);
      const last = tileRect(g, 7);
      expect((first.x + last.x + last.w) / 2).toBeCloseTo(1440 / 2, 6);
    }
    const full = fitGrid(40, 1440, 900, 16 / 9, safeFor(1440, 900));
    if (40 % full.cols === 0) expect(full.lastRowOffset).toBe(0);
  });

  it("a short last row is centred on the grid in every case", () => {
    for (const [vw, vh] of SIZES) {
      for (const n of COUNTS) {
        const g = fitGrid(n, vw, vh, 16 / 9, safeFor(vw, vh));
        const inLast = n - (g.rows - 1) * g.cols;
        if (inLast === g.cols) {
          expect(g.lastRowOffset).toBe(0);
          continue;
        }
        const a = tileRect(g, (g.rows - 1) * g.cols);
        const b = tileRect(g, n - 1);
        const mid = (a.x + b.x + b.w) / 2;
        const gridMid = g.originX + (g.cols * g.tileW + (g.cols - 1) * g.gap) / 2;
        expect(mid).toBeCloseTo(gridMid, 6);
      }
    }
  });

  it("copes with a safe area that has no room (a tiny positive tile, never NaN)", () => {
    const g = fitGrid(40, 320, 200, 16 / 9, { top: 150, bottom: 150, side: 20 });
    expect(Number.isFinite(g.tileW)).toBe(true);
    expect(g.tileW).toBeGreaterThan(0);
  });
});

describe("warp and unwarp", () => {
  const points = (vw: number, vh: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) out.push([(vw * i) / 10, (vh * j) / 10]);
    return out;
  };
  for (const [vw, vh] of SIZES) {
    it(`invert each other to within 0.5 px anywhere at ${vw}x${vh}`, () => {
      for (const [x, y] of points(vw, vh)) {
        const [wx, wy] = warp(x, y, vw, vh);
        const [ux, uy] = unwarp(wx, wy, vw, vh);
        expect(Math.hypot(ux - x, uy - y)).toBeLessThan(0.5);
        const [vx, vy] = unwarp(x, y, vw, vh);
        const [bx, by] = warp(vx, vy, vw, vh);
        expect(Math.hypot(bx - x, by - y)).toBeLessThan(0.5);
      }
    });
  }
  it("leaves the centre alone and pulls the rest toward it (barrel), most at the corners", () => {
    expect(warp(720, 450, 1440, 900)).toEqual([720, 450]);
    const [cx, cy] = warp(0, 0, 1440, 900);
    expect(cx).toBeGreaterThan(0);
    expect(cy).toBeGreaterThan(0);
    // a point on the left edge moves in by about 5% of the half width, at the corner about 10%
    expect(cx).toBeCloseTo(72, 6);
    const [ex] = warp(0, 450, 1440, 900);
    expect(ex).toBeCloseTo(720 * 0.05, 3);
  });
  it("is the identity at k = 0", () => {
    const [wx, wy] = warp(10, 20, 100, 100, 0);
    expect(wx).toBeCloseTo(10, 9);
    expect(wy).toBeCloseTo(20, 9);
    expect(unwarp(10, 20, 100, 100, 0)[0]).toBeCloseTo(10, 9);
  });
});
