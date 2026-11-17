import { describe, expect, it } from "vitest";
import {
  BEND_EARLY,
  BEND_EARLY_STEP,
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
  wanderAmp,
} from "./glass-field";
import { easeGlass, FRONT_CLEAR, FRONT_START, frontAt, GLASS, SPAN, UNCOVERED_AT, WARP } from "./glass-math";

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
  it("has a tile every 0.05 from behind the middle to HAND_OVER, then every tile of the ladder (R58: the noise is fixed on the screen, so the steps are the 4% ones)", () => {
    expect(BEND_EARLY[0]).toBe(-0.25);
    expect(BEND_EARLY.length).toBeGreaterThan(7);
    for (let i = 1; i < BEND_EARLY.length; i++) expect(BEND_EARLY[i] - BEND_EARLY[i - 1]).toBeCloseTo(BEND_EARLY_STEP, 9);
    expect(BEND_EARLY[BEND_EARLY.length - 1]).toBeLessThan(HAND_OVER);
    expect(BEND_TILES[BEND_EARLY.length]).toBe(HAND_OVER);
    expect(BEND_TILES.length).toBe(BEND_EARLY.length + TILES.length);
    for (let i = 1; i < BEND_TILES.length; i++) expect(BEND_TILES[i]).toBeGreaterThan(BEND_TILES[i - 1]);
  });
  it("puts a small front within half a step of a tile, and a larger one on a scaled tile within 4%", () => {
    for (let r = -0.3; r < HAND_OVER; r += 0.007) {
      const p = pickBendTile(r);
      expect(p.scale).toBe(1);
      expect(Math.abs(BEND_TILES[p.index] - Math.min(Math.max(r, -0.25), BEND_EARLY[BEND_EARLY.length - 1]))).toBeLessThanOrEqual(BEND_EARLY_STEP / 2 + 1e-4);
    }
    for (let r = HAND_OVER; r < 1.5; r += 0.011) {
      const p = pickBendTile(r);
      expect(BEND_TILES[p.index] * p.scale).toBeCloseTo(r, 9);
      expect(p.scale).toBeGreaterThan(1 / 1.045);
      expect(p.scale).toBeLessThan(1.045);
    }
    expect(pickBendTile(9).index).toBe(BEND_TILES.length - 1);
  });
  it("never scales a tile by more than 4% from HAND_OVER to TILE_TOP", () => {
    for (let k = 0; k < 200; k++) {
      const r = HAND_OVER + ((TILE_TOP - HAND_OVER) * k) / 199;
      expect(Math.abs(pickBendTile(r).scale - 1)).toBeLessThanOrEqual(0.04);
    }
  });
});

describe("wander", () => {
  it("stays within -1 and 1 and has five or six lobes round the front", () => {
    {
      for (const turn of [0, TURN / 2, TURN]) {
        let peaks = 0;
        const n = 720;
        const at = (i: number) => wander(((i % n) / n) * 2 * Math.PI, turn);
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

describe("wanderAmp", () => {
  it("is 12% of the front's radius (R111), tapered to nothing while the front is small", () => {
    expect(wanderAmp(-0.3)).toBe(0);
    expect(wanderAmp(0)).toBe(0);
    expect(wanderAmp(0.1)).toBe(0);
    expect(wanderAmp(0.2)).toBeGreaterThan(0);
    expect(wanderAmp(0.2)).toBeLessThan(0.2 * WARP * 0.3);
    for (const front of [0.6, 0.8, 1.2, FRONT_CLEAR]) expect(wanderAmp(front)).toBeCloseTo(WARP * front, 12);
    let last = 0;
    for (let f = 0; f <= 1.4; f += 0.01) {
      expect(wanderAmp(f)).toBeGreaterThanOrEqual(last);
      last = wanderAmp(f);
    }
  });
});

describe("fieldAt", () => {
  it("is the distance in the middle and never more than 12% of the front's radius away from it", () => {
    expect(fieldAt(0, 0, 0, 0.5)).toBe(0);
    expect(fieldAt(0.05, 0.03, 1, 0.05)).toBeCloseTo(Math.hypot(0.05, 0.03), 12);
    for (const front of [0.3, 0.7, 1.1]) {
      let biggest = 0;
      for (let a = 0; a < 2 * Math.PI; a += 0.05) {
        const d = fieldAt(front * Math.cos(a), front * Math.sin(a), 0.2, front) - front;
        expect(Math.abs(d)).toBeLessThanOrEqual(WARP * front + 1e-9);
        biggest = Math.max(biggest, Math.abs(d));
      }
      // a lobe gets most of the way to the limit once the taper is over
      if (front >= 0.5) expect(biggest).toBeGreaterThan(0.8 * WARP * front);
    }
  });
  it("grows with the distance along every ray, so the edge is one closed curve with no folds", () => {
    for (const front of [0.3, 0.9, FRONT_CLEAR]) {
      for (let a = 0; a < 2 * Math.PI; a += 0.07) {
        let last = -1;
        for (let rho = 0; rho <= 1.4; rho += 0.01) {
          const d = fieldAt(rho * Math.cos(a), rho * Math.sin(a), TURN * 0.6, front);
          expect(d).toBeGreaterThan(last);
          last = d;
        }
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
          if (fieldAt(mid * Math.cos(a), mid * Math.sin(a), turnFor(front), front) < front) lo = mid;
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
  it("hardly steps where the front moves on from one tile to the next: the two tiles put the edge within 0.7% of a corner distance (6 px at 1440 by 900) of each other", () => {
    for (let i = 0; i + 1 < TILES.length; i++) {
      const at = Math.sqrt(TILES[i] * TILES[i + 1]);
      if (at > FRONT_CLEAR) break; // the front never gets past this switch
      const edge = (k: number, a: number) => {
        let lo = 0;
        let hi = TILES[k] * 2;
        for (let j = 0; j < 40; j++) {
          const mid = (lo + hi) / 2;
          if (fieldAt(mid * Math.cos(a), mid * Math.sin(a), turnFor(TILES[k]), TILES[k]) < TILES[k]) lo = mid;
          else hi = mid;
        }
        return (lo * at) / TILES[k];
      };
      for (let a = 0; a < 2 * Math.PI; a += 0.05) expect(Math.abs(edge(i, a) - edge(i + 1, a))).toBeLessThan(0.007);
    }
  });
});

describe("the change's first frames (R109)", () => {
  /** the new page's share at the middle of the screen `t` of the way through the change */
  const shareAtMiddle = (t: number) => {
    const front = frontAt(t, { radius: 1 }).radius;
    return newShare(halfBands(0, 0, front, turnFor(front)));
  };
  it("shows nothing of the new page at t = 0 and the first visible part (over 1% at the middle) before t = 0.12", () => {
    expect(shareAtMiddle(0)).toBe(0);
    let first = -1;
    for (let t = 0; t <= 1; t += 0.002) {
      if (shareAtMiddle(t) > 0.01) {
        first = t;
        break;
      }
    }
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.12);
  });
  it("has a clear part of the new page in the middle by 20% of the time (the drawn share, not the opening)", () => {
    expect(shareAtMiddle(0.2)).toBeGreaterThan(0.1);
    expect(shareAtMiddle(0.4)).toBeGreaterThan(0.9);
    // it grows and never shrinks
    let last = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      expect(shareAtMiddle(t)).toBeGreaterThanOrEqual(last - 1e-12);
      last = shareAtMiddle(t);
    }
  });
  it("is clear at UNCOVERED_AT: the farthest corner is all the new page, under the wander at its worst", () => {
    const front = frontAt(UNCOVERED_AT, { radius: 1 }).radius;
    expect(front).toBeCloseTo(FRONT_CLEAR, 9);
    for (let a = 0; a < 2 * Math.PI; a += 0.02) {
      expect(newShare(halfBands(Math.cos(a), Math.sin(a), front, turnFor(front)))).toBeGreaterThan(1 - 1e-9);
    }
    expect(easeGlass(UNCOVERED_AT) * SPAN + FRONT_START).toBeCloseTo(FRONT_CLEAR, 9);
  });
});

describe("turn", () => {
  it("runs from 0 at HAND_OVER to TURN (about 25 degrees) once the front has cleared the screen, mostly early, and never back", () => {
    expect(TURN).toBeCloseTo((25 * Math.PI) / 180, 12);
    expect(progressFor(FRONT_START)).toBe(0);
    expect(turnFor(FRONT_START)).toBe(0);
    expect(turnFor(HAND_OVER)).toBe(0);
    expect(turnFor(FRONT_CLEAR)).toBeCloseTo(TURN, 12);
    expect(turnFor(9)).toBe(TURN);
    expect(turnFor(0.6)).toBeGreaterThan(0.5 * TURN);
    let last = 0;
    for (let f = 0; f <= 1.5; f += 0.01) {
      expect(turnFor(f)).toBeGreaterThanOrEqual(last);
      last = turnFor(f);
    }
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
  it("covers the whole screen: at every front radius the scaled tile reaches past the farthest corner, with the soft edge's band to spare", () => {
    for (let r = HAND_OVER; r <= FRONT_CLEAR; r += 0.01) {
      const pick = pickTile(r);
      expect(pick).not.toBeNull();
      if (pick) expect(HALF * pick.scale).toBeGreaterThan(1 + GLASS.band / 2);
    }
  });
});
