import { describe, expect, it } from "vitest";
import { LIFT, liftPhases, OPEN_SECONDS, RISE_END, stepOpen, TURN_START } from "./shelf-math";

describe("liftPhases", () => {
  it("is down at 0 and fully lifted and turned at 1", () => {
    expect(liftPhases(0)).toEqual({ rise: 0, turn: 0 });
    expect(liftPhases(1)).toEqual({ rise: 1, turn: 1 });
  });
  it("finishes the rise at 45% and starts the turn at 40%", () => {
    expect(RISE_END).toBe(0.45);
    expect(TURN_START).toBe(0.4);
    expect(liftPhases(0.45).rise).toBe(1);
    expect(liftPhases(0.44).rise).toBeLessThan(1);
    expect(liftPhases(0.4).turn).toBe(0);
    expect(liftPhases(0.41).turn).toBeGreaterThan(0);
  });
  it("never turns before the rise is well under way, and rises first", () => {
    for (let o = 0; o <= 0.4; o += 0.01) expect(liftPhases(o).turn).toBe(0);
    expect(liftPhases(0.4).rise).toBeGreaterThan(0.95);
  });
  it("only ever moves forward as o rises", () => {
    let last = liftPhases(0);
    for (let i = 1; i <= 200; i++) {
      const cur = liftPhases(i / 200);
      expect(cur.rise).toBeGreaterThanOrEqual(last.rise);
      expect(cur.turn).toBeGreaterThanOrEqual(last.turn);
      last = cur;
    }
  });
  it("clamps o outside 0..1", () => {
    expect(liftPhases(-0.5)).toEqual({ rise: 0, turn: 0 });
    expect(liftPhases(1.5)).toEqual({ rise: 1, turn: 1 });
  });
  it("lifts by 38% of the book's height", () => {
    expect(LIFT).toBe(0.38);
  });
});

describe("stepOpen", () => {
  const run = (from: number, to: 0 | 1, seconds: number, dt = 1 / 60) => {
    let o = from;
    for (let t = 0; t < seconds - 1e-9; t += dt) o = stepOpen(o, to, dt);
    return o;
  };
  it("takes 620 ms to open or close, at a steady rate", () => {
    expect(OPEN_SECONDS).toBe(0.62);
    expect(run(0, 1, 0.31)).toBeCloseTo(0.5, 1);
    expect(run(0, 1, 0.62 + 0.05)).toBe(1);
    expect(run(1, 0, 0.62 + 0.05)).toBe(0);
  });
  it("closing is the opening run backwards", () => {
    const up = [0.1, 0.3, 0.5, 0.7, 0.9].map((o) => stepOpen(o, 1, 0.01) - o);
    const down = [0.1, 0.3, 0.5, 0.7, 0.9].map((o) => o - stepOpen(o, 0, 0.01));
    up.forEach((d, i) => expect(d).toBeCloseTo(down[i], 12));
  });
  it("turns round from where it is when the target changes mid-way", () => {
    const mid = run(0, 1, 0.3);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    const back = stepOpen(mid, 0, 1 / 60);
    expect(back).toBeLessThan(mid);
    expect(back).toBeGreaterThan(0);
  });
  it("never goes past its target or outside 0..1, whatever the step", () => {
    expect(stepOpen(0.99, 1, 5)).toBe(1);
    expect(stepOpen(0.01, 0, 5)).toBe(0);
    expect(stepOpen(0, 0, 0.1)).toBe(0);
    expect(stepOpen(1, 1, 0.1)).toBe(1);
  });
});
