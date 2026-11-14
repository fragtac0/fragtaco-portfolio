import { describe, expect, it } from "vitest";
import {
  BEND_EARLY,
  BEND_TILES,
  fieldAt,
  HALF,
  halfBands,
  HAND_OVER,
  newShare,
  pickBendTile,
  pickTile,
  progressFor,
  sheetLayout,
  tileCell,
  TILE_RATIO,
  TILE_TOP,
  TILES,
  TURN,
  turnFor,
  wander,
} from "./glass-field";
import { FRONT_CLEAR, FRONT_START, GLASS, WARP } from "./glass-math";

describe("TILES", () => {
  it("is a ladder of front radii from HAND_OVER to past the corner, each the ratio above the one before", () => {
    expect(TILES[0]).toBe(HAND_OVER);
    expect(TILES[TILES.length - 1]).toBeGreaterThanOrEqual(TILE_TOP);
    expect(TILES[TILES.length - 2]).toBeLessThan(TILE_TOP);
    for (let i = 1; i < TILES.length; i++) expect(TILES[i] / TILES[i - 1]).toBeCloseTo(TILE_RATIO, 9);
    expect(TILES.length).toBeGreaterThan(20);
    expect(TILES.length).toBeLessThan(40);
  });
});

describe("pickTile", () => {
  it("is nothing below HAND_OVER (the gradients draw a front that small)", () => {
    expect(pickTile(0.19)).toBeNull();
    expect(pickTile(-0.2)).toBeNull();
    expect(pickTile(Number.NaN)).toBeNull();
    expect(pickTile(HAND_OVER)).toEqual({ index: 0, scale: 1 });
  });
  it("picks the nearest tile and a scale that lands its edge exactly on the front, within 4% of the tile's own size", () => {
    for (let r = HAND_OVER; r <= 1.7; r += 0.0137) {
      const pick = pickTile(r);
      expect(pick).not.toBeNull();
      if (!pick) continue;
      expect(TILES[pick.index] * pick.scale).toBeCloseTo(r, 9);
      if (r <= TILES[TILES.length - 1]) {
        expect(pick.scale).toBeGreaterThan(1 / 1.04);
        expect(pick.scale).toBeLessThan(1.04);
      }
    }
    expect(pickTile(TILES[5])).toEqual({ index: 5, scale: 1 });
    expect(pickTile(9)?.index).toBe(TILES.length - 1);
  });
  it("moves on to the next tile as the front grows, never back", () => {
    let last = 0;
    for (let r = HAND_OVER; r <= 1.7; r += 0.005) {
      const i = pickTile(r)?.index ?? -1;
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
  });
});

describe("pickBendTile", () => {
  it("has a tile every 0.05 from behind the middle to HAND_OVER, then every other tile of the ladder", () => {
    expect(BEND_EARLY[0]).toBe(-0.25);
    expect(BEND_EARLY.length).toBeGreaterThan(7);
    for (let i = 1; i < BEND_EARLY.length; i++) expect(BEND_EARLY[i] - BEND_EARLY[i - 1]).toBeCloseTo(0.05, 9);
    expect(BEND_EARLY[BEND_EARLY.length - 1]).toBeLessThan(HAND_OVER);
    expect(BEND_TILES[BEND_EARLY.length]).toBe(HAND_OVER);
    for (let i = 1; i < BEND_TILES.length; i++) expect(BEND_TILES[i]).toBeGreaterThan(BEND_TILES[i - 1]);
  });
  it("puts a small front within half a step of a tile, and a larger one on a scaled tile within 8%", () => {
    for (let r = -0.3; r < HAND_OVER; r += 0.007) {
      const p = pickBendTile(r);
      expect(p.scale).toBe(1);
      expect(Math.abs(BEND_TILES[p.index] - Math.min(Math.max(r, -0.25), BEND_EARLY[BEND_EARLY.length - 1]))).toBeLessThanOrEqual(0.0251);
    }
    for (let r = HAND_OVER; r < 1.5; r += 0.011) {
      const p = pickBendTile(r);
      expect(BEND_TILES[p.index] * p.scale).toBeCloseTo(r, 9);
      expect(p.scale).toBeGreaterThan(1 / 1.09);
      expect(p.scale).toBeLessThan(1.09);
    }
    expect(pickBendTile(9).index).toBe(BEND_TILES.length - 1);
  });
});

describe("wander", () => {
  it("stays within -1 and 1 and has five or six lobes round the front", () => {
    for (const rho of [0.3, 0.6, 1]) {
      for (const turn of [0, TURN / 2, TURN]) {
        let peaks = 0;
        const n = 720;
        const at = (i: number) => wander(((i % n) / n) * 2 * Math.PI, rho, turn);
        for (let i = 0; i < n; i++) {
          const v = at(i);
          expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-9);
          if (v > at(i - 1 + n) && v >= at(i + 1) && v > 0.15) peaks++;
        }
        expect(peaks).toBeGreaterThanOrEqual(5);
        expect(peaks).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("fieldAt", () => {
  it("is the distance in the middle and never more than WARP away from it", () => {
    expect(fieldAt(0, 0, 0)).toBe(0);
    expect(fieldAt(0.05, 0.03, 1)).toBeCloseTo(Math.hypot(0.05, 0.03), 12);
    let sawLobe = false;
    for (let a = 0; a < 2 * Math.PI; a += 0.05) {
      for (const rho of [0.3, 0.7, 1.1]) {
        const d = fieldAt(rho * Math.cos(a), rho * Math.sin(a), 0.2) - rho;
        expect(Math.abs(d)).toBeLessThanOrEqual(WARP + 1e-9);
        if (Math.abs(d) > 0.8 * WARP) sawLobe = true;
      }
    }
    expect(sawLobe).toBe(true);
  });
  it("grows with the distance along every ray, so the edge is one closed curve with no folds", () => {
    for (let a = 0; a < 2 * Math.PI; a += 0.07) {
      let last = -1;
      for (let rho = 0; rho <= 1.4; rho += 0.01) {
        const d = fieldAt(rho * Math.cos(a), rho * Math.sin(a), TURN * 0.6);
        expect(d).toBeGreaterThan(last);
        last = d;
      }
    }
  });
  it("puts none of the new page on the screen at the start, and all of it from FRONT_CLEAR (spec 4: no dead time, clear at 0.95)", () => {
    for (let a = 0; a < 2 * Math.PI; a += 0.05) {
      for (let rho = 0; rho <= 1; rho += 0.02) {
        const u = rho * Math.cos(a);
        const v = rho * Math.sin(a);
        expect(newShare(halfBands(u, v, FRONT_START, 0))).toBeLessThan(1e-9);
        expect(newShare(halfBands(u, v, FRONT_CLEAR, TURN))).toBeGreaterThan(1 - 1e-9);
      }
    }
  });
  it("changes shape over the change (not one stamp growing): the edge's lobes at 0.4 and at 1.1 are not the same outline", () => {
    const outline = (front: number) => {
      const out: number[] = [];
      for (let a = 0; a < 2 * Math.PI; a += 0.1) {
        // the radius at which the field reaches the front, scaled to the front
        let lo = 0;
        let hi = front * 2;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (fieldAt(mid * Math.cos(a), mid * Math.sin(a), turnFor(front)) < front) lo = mid;
          else hi = mid;
        }
        out.push(lo / front - 1);
      }
      return out;
    };
    const a = outline(0.4);
    const b = outline(1.1);
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0);
    const corr = dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));
    expect(corr).toBeLessThan(0.9);
  });
});

describe("turn", () => {
  it("runs from 0 at the start to TURN (about 25 degrees) at the end of the front's path", () => {
    expect(TURN).toBeCloseTo((25 * Math.PI) / 180, 12);
    expect(progressFor(FRONT_START)).toBe(0);
    expect(turnFor(FRONT_START - 1)).toBe(0);
    expect(turnFor(9)).toBe(TURN);
    expect(turnFor(0.2)).toBeLessThan(turnFor(1));
    expect(turnFor(1)).toBeLessThan(TURN);
  });
});

describe("newShare", () => {
  it("is the preview's one minus smoothstep(-1, 1, x): 1 well inside, one half at the front, 0 well outside", () => {
    expect(newShare(-1)).toBe(1);
    expect(newShare(-3)).toBe(1);
    expect(newShare(0)).toBeCloseTo(0.5, 12);
    expect(newShare(1)).toBe(0);
    expect(newShare(4)).toBe(0);
    expect(newShare(-0.5) + newShare(0.5)).toBeCloseTo(1, 12);
  });
});

describe("sheets", () => {
  it("lays tiles out in rows of `cols`", () => {
    expect(sheetLayout(28, 7)).toEqual({ cols: 7, rows: 4 });
    expect(sheetLayout(29, 7)).toEqual({ cols: 7, rows: 5 });
    expect(tileCell(0, 7)).toEqual({ col: 0, row: 0 });
    expect(tileCell(9, 7)).toEqual({ col: 2, row: 1 });
  });
  it("covers the whole screen: a tile reaches past the farthest corner even at its smallest scale", () => {
    expect(HALF / 1.04).toBeGreaterThan(1);
    expect(GLASS.band).toBeGreaterThan(0);
  });
});
