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
  unwarp,
  warp,
  type Grid,
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
