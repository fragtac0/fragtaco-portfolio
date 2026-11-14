import { describe, expect, it } from "vitest";
import { GAP_PX, fitGrid, largestGrid, safeInsets, tileRect } from "./gallery-math";

/** Review Focus: the same screen sizes as the rings' tests, with the odd ones (844 by 390, 820 by 1180). */
const SIZES: [number, number][] = [
  [320, 568],
  [568, 320],
  [844, 390],
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
            const w = Math.min((aw - (c - 1) * GAP_PX) / c, ((ah - (r - 1) * GAP_PX) / r) * aspect);
            best = Math.max(best, w);
          }
          expect(g.tileW).toBeGreaterThanOrEqual(best - 1e-9);
          expect(g.tileW).toBeLessThanOrEqual(best + 1e-9);
        });
      }
    }
  }

  it("keeps an 8 px gap between neighbours by default and takes another", () => {
    const g = fitGrid(8, 1440, 900, 16 / 9, safeFor(1440, 900));
    expect(GAP_PX).toBe(8);
    expect(g.gap).toBe(8);
    const a = tileRect(g, 0);
    const b = tileRect(g, 1);
    expect(b.x - (a.x + a.w)).toBeCloseTo(8, 6);
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

describe("largestGrid", () => {
  /** The two walls at their real counts: 21 long form videos (wide tiles), 35 short form (upright). */
  const WALLS: Array<[string, number, number]> = [
    ["21 wide tiles", 21, 16 / 9],
    ["35 upright tiles", 35, 9 / 16],
  ];
  for (const [vw, vh] of SIZES) {
    for (const [name, n, aspect] of WALLS) {
      const safe = safeFor(vw, vh);
      const aw = vw - 2 * safe.side;
      const ah = vh - safe.top - safe.bottom;

      it(`${name} at ${vw}x${vh}: every tile and every gap inside the safe area, nothing left over`, () => {
        const g = largestGrid(n, vw, vh, aspect, GAP_PX, safe);
        expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
        expect((g.rows - 1) * g.cols).toBeLessThan(n); // no whole row of empty slots
        expect(g.tileW).toBeGreaterThan(0);
        expect(g.tileH).toBeCloseTo(g.tileW / aspect, 9);
        expect(g.cols * g.tileW + (g.cols - 1) * GAP_PX).toBeLessThanOrEqual(aw + 1e-6);
        expect(g.rows * g.tileH + (g.rows - 1) * GAP_PX).toBeLessThanOrEqual(ah + 1e-6);
      });

      it(`${name} at ${vw}x${vh}: no other grid gives a larger tile, and it touches one limit`, () => {
        const g = largestGrid(n, vw, vh, aspect, GAP_PX, safe);
        let best = 0;
        for (let c = 1; c <= n; c++) {
          const r = Math.ceil(n / c);
          best = Math.max(best, Math.min((aw - (c - 1) * GAP_PX) / c, ((ah - (r - 1) * GAP_PX) / r) * aspect));
        }
        expect(g.tileW).toBeCloseTo(best, 9);
        const wide = g.cols * g.tileW + (g.cols - 1) * GAP_PX;
        const tall = g.rows * g.tileH + (g.rows - 1) * GAP_PX;
        expect(Math.min(aw - wide, ah - tall)).toBeLessThan(1e-6);
      });
    }
  }

  it("gives the grids worked out by hand at 1440 by 900 (a 108 px heading band over, a 144 px dock band under)", () => {
    // room: 1324.8 by 648. 21 wide tiles: 5 by 5 is 219.0 px a tile (height limits), 6 by 4 only 214.1, 7 by 3 only 182.4
    const wide = largestGrid(21, 1440, 900, 16 / 9, 8, safeFor(1440, 900));
    expect([wide.cols, wide.rows]).toEqual([5, 5]);
    expect(wide.tileW).toBeCloseTo(((648 - 4 * 8) / 5) * (16 / 9), 6);
    // 35 upright tiles: 12 by 3 is 103.1 px (width limits); 7 by 5, the exact fit, would be only 69.3
    const tall = largestGrid(35, 1440, 900, 9 / 16, 8, safeFor(1440, 900));
    expect([tall.cols, tall.rows]).toEqual([12, 3]);
    expect(tall.tileW).toBeCloseTo((1324.8 - 11 * 8) / 12, 6);
  });

  it("is a few px narrower with a bigger gap and wider with none: the gap is the only thing between tiles", () => {
    const safe = safeFor(1440, 900);
    expect(largestGrid(21, 1440, 900, 16 / 9, 0, safe).tileW).toBeGreaterThan(largestGrid(21, 1440, 900, 16 / 9, 8, safe).tileW);
    expect(largestGrid(21, 1440, 900, 16 / 9, 24, safe).tileW).toBeLessThan(largestGrid(21, 1440, 900, 16 / 9, 8, safe).tileW);
  });

  it("breaks a tie toward fewer empty slots, then the first (fewest columns), and never gives NaN", () => {
    // a square safe area of 100 by 100, square tiles, 4 of them: 2 by 2 (no empty) beats 1 by 4 and 4 by 1
    const g = largestGrid(4, 120, 120, 1, 0, { top: 10, bottom: 10, side: 10 });
    expect([g.cols, g.rows]).toEqual([2, 2]);
    const none = largestGrid(40, 320, 200, 16 / 9, 8, { top: 150, bottom: 150, side: 20 });
    expect(Number.isFinite(none.tileW)).toBe(true);
    expect(none.tileW).toBeGreaterThan(0);
  });
});
