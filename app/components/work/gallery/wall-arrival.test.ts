import { describe, expect, it } from "vitest";
import { GAP_PX, fitGrid } from "./gallery-math";
import {
  ARRIVAL,
  FIRST_PICTURES,
  START_DEADLINE_MS,
  arrival,
  arrivalDelay,
  arrivalEnd,
  arrivalOrder,
  canStart,
  ringOf,
} from "./wall-arrival";
import { wallSafe } from "./wall-layout";

/** The grids a wall can end up with: every size up to 40 by 40, the real ones included. */
const GRIDS: Array<[number, number]> = [];
for (const cols of [1, 2, 3, 4, 5, 6, 7, 9, 12, 14, 40]) for (const rows of [1, 2, 3, 4, 5, 7, 10, 40]) GRIDS.push([cols, rows]);

describe("ringOf", () => {
  it("is 0 at the middle tile of an odd grid and counts outward", () => {
    expect(ringOf(3, 1, 7, 3)).toBe(0);
    expect(ringOf(4, 1, 7, 3)).toBe(1);
    expect(ringOf(6, 1, 7, 3)).toBe(3);
    expect(ringOf(0, 0, 7, 3)).toBe(3); // the corner: 3 across, 1 up, about 3.2
  });
  it("starts at ring 0 for the middle tiles of an even grid, which has no single middle", () => {
    expect(ringOf(2, 1, 6, 4)).toBe(0);
    expect(ringOf(3, 2, 6, 4)).toBe(0);
    expect(ringOf(0, 0, 6, 4)).toBeGreaterThan(0);
    expect(ringOf(0, 0, 1, 1)).toBe(0);
  });
});

describe("arrival", () => {
  it("stays inside the bounds: scale 0.86 to 1, alpha 0 to 1, for every tile of every grid at every moment", () => {
    for (const [cols, rows] of GRIDS) {
      for (let row = 0; row < rows; row += Math.max(1, Math.floor(rows / 4))) {
        for (let col = 0; col < cols; col += Math.max(1, Math.floor(cols / 4))) {
          for (let t = -50; t <= 1200; t += 61) {
            const a = arrival(col, row, cols, rows, t);
            expect(a.scale).toBeGreaterThanOrEqual(ARRIVAL.scaleFrom - 1e-12);
            expect(a.scale).toBeLessThanOrEqual(1 + 1e-12);
            expect(a.alpha).toBeGreaterThanOrEqual(0);
            expect(a.alpha).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("only ever grows: scale and alpha never go back", () => {
    for (const [cols, rows] of [[7, 3], [5, 5], [12, 3], [1, 9]] as const) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let prev = arrival(col, row, cols, rows, -10);
          for (let t = 0; t <= 1000; t += 5) {
            const a = arrival(col, row, cols, rows, t);
            expect(a.scale).toBeGreaterThanOrEqual(prev.scale - 1e-12);
            expect(a.alpha).toBeGreaterThanOrEqual(prev.alpha - 1e-12);
            prev = a;
          }
        }
      }
    }
  });

  it("starts the middle at once at 0.86 and nothing showing, and ends every tile whole 420 ms after its own start", () => {
    const start = arrival(3, 1, 7, 3, 0);
    expect(start).toEqual({ scale: ARRIVAL.scaleFrom, alpha: 0 });
    for (const [cols, rows] of GRIDS) {
      for (let row = 0; row < rows; row += Math.max(1, Math.floor(rows / 3))) {
        for (let col = 0; col < cols; col += Math.max(1, Math.floor(cols / 3))) {
          const d = arrivalDelay(col, row, cols, rows);
          expect(arrival(col, row, cols, rows, d)).toEqual({ scale: ARRIVAL.scaleFrom, alpha: 0 });
          expect(arrival(col, row, cols, rows, d + ARRIVAL.tileMs)).toEqual({ scale: 1, alpha: 1 });
          const mid = arrival(col, row, cols, rows, d + ARRIVAL.tileMs / 2);
          expect(mid.alpha).toBeGreaterThan(0.5); // an ease-out: more than half done at half time
          expect(mid.alpha).toBeLessThan(1);
        }
      }
    }
  });

  it("is 45 ms later for each ring out from the middle", () => {
    expect(arrivalDelay(3, 1, 7, 3)).toBe(0);
    expect(arrivalDelay(4, 1, 7, 3)).toBe(45);
    expect(arrivalDelay(5, 1, 7, 3)).toBe(90);
    expect(arrivalDelay(6, 1, 7, 3)).toBe(135);
    expect(ARRIVAL.ringMs).toBe(45);
    expect(ARRIVAL.tileMs).toBe(420);
  });

  it("comes in from the middle outward: at any moment an outer tile is no further on than an inner one", () => {
    const [cols, rows] = [9, 7];
    for (let t = 0; t <= 900; t += 25) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const a = arrival(col, row, cols, rows, t).alpha;
          const inner = arrival(4, 3, cols, rows, t).alpha;
          if (ringOf(col, row, cols, rows) > 0) expect(a).toBeLessThanOrEqual(inner + 1e-12);
        }
      }
    }
  });

  it("is done within 900 ms whatever the grid: the delay is capped", () => {
    for (const [cols, rows] of GRIDS) {
      expect(arrivalEnd(cols, rows)).toBeLessThanOrEqual(ARRIVAL.totalMs);
      for (let row = 0; row < rows; row += Math.max(1, Math.floor(rows / 5))) {
        for (let col = 0; col < cols; col += Math.max(1, Math.floor(cols / 5))) {
          expect(arrival(col, row, cols, rows, ARRIVAL.totalMs)).toEqual({ scale: 1, alpha: 1 });
        }
      }
    }
    // a huge grid hits the cap exactly: ring 11 and beyond all start at 480
    expect(arrivalEnd(40, 40)).toBe(900);
    expect(arrivalDelay(0, 0, 40, 40)).toBe(480);
  });

  it("takes about half a second for the real walls: 21 wide and 35 upright tiles at the audit sizes", () => {
    const sizes: Array<[number, number]> = [[1440, 900], [390, 844], [844, 390], [320, 568], [820, 1180], [2560, 1440]];
    for (const [vw, vh] of sizes) {
      for (const [n, aspect] of [[21, 16 / 9], [35, 9 / 16]] as const) {
        const g = fitGrid(n, vw, vh, aspect, wallSafe(vw, vh, 100, 140), GAP_PX);
        const end = arrivalEnd(g.cols, g.rows);
        expect(end).toBeGreaterThan(ARRIVAL.tileMs);
        expect(end).toBeLessThanOrEqual(ARRIVAL.totalMs);
      }
    }
    expect(arrivalEnd(5, 5)).toBe(135 + 420); // 21 wide tiles at 1440 by 900: corner ring 3
  });

  it("with reduced motion fades every tile together, at full size, in 160 ms", () => {
    for (const [col, row] of [[0, 0], [3, 1], [6, 2]] as const) {
      expect(arrival(col, row, 7, 3, 0, true)).toEqual({ scale: 1, alpha: 0 });
      expect(arrival(col, row, 7, 3, 80, true)).toEqual({ scale: 1, alpha: 0.5 });
      expect(arrival(col, row, 7, 3, 160, true)).toEqual({ scale: 1, alpha: 1 });
      expect(arrival(col, row, 7, 3, 500, true)).toEqual({ scale: 1, alpha: 1 });
    }
    expect(arrivalDelay(6, 2, 7, 3, true)).toBe(0);
    expect(arrivalEnd(7, 3, true)).toBe(ARRIVAL.reducedMs);
    expect(ARRIVAL.reducedMs).toBeLessThanOrEqual(200);
  });
});

describe("arrivalOrder", () => {
  it("lists every tile once, the middle first, then outward", () => {
    for (const [cols, rows, count] of [[7, 3, 21], [12, 3, 35], [5, 5, 21], [6, 4, 23], [1, 4, 4], [3, 1, 3]] as const) {
      const order = arrivalOrder(cols, rows, count);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i));
    }
    expect(arrivalOrder(7, 3, 21)[0]).toBe(10); // column 3 of row 1
    const o = arrivalOrder(5, 5, 21); // the last row has one tile, shifted to the middle: it is as near as a middle tile
    expect(o[0]).toBe(12);
    expect(o).toHaveLength(21);
  });
});

describe("canStart", () => {
  const base = { pictures: 0, count: 21, settled: false, artReady: true, elapsedMs: 0 };
  it("waits for the first pictures", () => {
    expect(canStart(base)).toBe(false);
    expect(canStart({ ...base, pictures: FIRST_PICTURES - 1 })).toBe(false);
    expect(canStart({ ...base, pictures: FIRST_PICTURES })).toBe(true);
  });
  it("a small wall needs only what it has", () => {
    expect(canStart({ ...base, count: 3, pictures: 3 })).toBe(true);
    expect(canStart({ ...base, count: 3, pictures: 2 })).toBe(false);
  });
  it("does not wait for pictures that are not coming: when everything has settled it goes at once", () => {
    expect(canStart({ ...base, settled: true })).toBe(true);
  });
  it("never starts before the art under the tiles is in, until the deadline", () => {
    expect(canStart({ ...base, artReady: false, pictures: 21, settled: true, elapsedMs: 300 })).toBe(false);
  });
  it("goes ahead after 1.2 s whatever is missing", () => {
    expect(START_DEADLINE_MS).toBe(1200);
    expect(canStart({ ...base, artReady: false, elapsedMs: 1199 })).toBe(false);
    expect(canStart({ ...base, artReady: false, elapsedMs: 1200 })).toBe(true);
    expect(canStart({ ...base, elapsedMs: 1200 })).toBe(true);
  });
});
