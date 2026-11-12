import { describe, expect, it } from "vitest";
import { proximity } from "./wall-proximity";

describe("proximity", () => {
  it("grows a tile 4% when the pointer is on its centre, with no push", () => {
    expect(proximity(0, 0)).toEqual({ scale: 1.04, pushX: 0, pushY: 0 });
  });

  it("does nothing at 220 px and beyond", () => {
    expect(proximity(220, 0)).toEqual({ scale: 1, pushX: 0, pushY: 0 });
    expect(proximity(0, -400)).toEqual({ scale: 1, pushX: 0, pushY: 0 });
    expect(proximity(1e6, 1e6)).toEqual({ scale: 1, pushX: 0, pushY: 0 });
  });

  it("falls from 1.04 to 1 without a bump", () => {
    let last = 1.04 + 1e-9;
    for (let d = 0; d <= 220; d += 5) {
      const s = proximity(d, 0).scale;
      expect(s).toBeLessThanOrEqual(last);
      expect(s).toBeGreaterThanOrEqual(1);
      last = s;
    }
  });

  it("stays between 1 and 1.04 and pushes at most 4 px, anywhere", () => {
    for (let x = -300; x <= 300; x += 7) {
      for (let y = -300; y <= 300; y += 7) {
        const p = proximity(x, y);
        expect(p.scale).toBeGreaterThanOrEqual(1);
        expect(p.scale).toBeLessThanOrEqual(1.04);
        expect(Math.hypot(p.pushX, p.pushY)).toBeLessThanOrEqual(4 + 1e-9);
      }
    }
  });

  it("pushes away from the pointer", () => {
    const right = proximity(100, 0);
    expect(right.pushX).toBeGreaterThan(0);
    expect(right.pushY).toBe(0);
    const up = proximity(0, -100);
    expect(up.pushY).toBeLessThan(0);
    const diag = proximity(-60, 60);
    expect(diag.pushX).toBeLessThan(0);
    expect(diag.pushY).toBeGreaterThan(0);
    expect(Math.abs(diag.pushX)).toBeCloseTo(Math.abs(diag.pushY), 9);
  });

  it("reaches close to the full 4 px somewhere inside the reach", () => {
    let best = 0;
    for (let d = 1; d < 220; d++) best = Math.max(best, Math.hypot(proximity(d, 0).pushX, 0));
    expect(best).toBeGreaterThan(3.5);
  });

  it("is smooth where the push ramps in, with no NaN at the centre", () => {
    const near = proximity(0.001, 0);
    expect(Number.isFinite(near.pushX)).toBe(true);
    expect(Math.abs(near.pushX)).toBeLessThan(0.01);
    expect(proximity(Number.NaN, 0)).toEqual({ scale: 1, pushX: 0, pushY: 0 });
  });
});
