import { describe, expect, it } from "vitest";
import {
  COVER_PX_MAX,
  COVER_PX_MIN,
  coverNeedsRepaint,
  coverPixels,
  LIFT,
  liftPhases,
  OPEN_SECONDS,
  RENDER_DPR_MAX,
  RISE_END,
  stepOpen,
  TURN_START,
} from "./shelf-math";

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

describe("coverPixels", () => {
  it("paints a cover at its size on screen times the renderer's pixel ratio (at most 1.75)", () => {
    expect(RENDER_DPR_MAX).toBe(1.75);
    expect(coverPixels(295, 2)).toBe(516); // a phone: the cover is 295 CSS px wide, drawn at 1.75
    expect(coverPixels(330, 1)).toBe(330); // a desktop screen
    expect(coverPixels(330, 2)).toBe(578); // a retina laptop: 330 * 1.75
    expect(coverPixels(330, 3)).toBe(578); // the ratio counts to 1.75 only
  });
  it("is never smaller than the floor or larger than the memory cap, and ignores a ratio under 1", () => {
    expect(coverPixels(100, 2)).toBe(COVER_PX_MIN);
    expect(coverPixels(900, 2)).toBe(COVER_PX_MAX);
    expect(coverPixels(500, 0.5)).toBe(500);
  });
  it("grows with the cover and with the ratio", () => {
    let last = 0;
    for (let w = 100; w <= 700; w += 25) {
      const p = coverPixels(w, 2);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(coverPixels(400, 1.5)).toBeGreaterThan(coverPixels(400, 1));
  });
});

describe("coverNeedsRepaint", () => {
  it("repaints only when the width would change by more than 1.4 times, either way", () => {
    expect(coverNeedsRepaint(516, 516)).toBe(false);
    expect(coverNeedsRepaint(516, 700)).toBe(false); // 1.36
    expect(coverNeedsRepaint(516, 730)).toBe(true); // 1.41
    expect(coverNeedsRepaint(700, 516)).toBe(false);
    expect(coverNeedsRepaint(730, 516)).toBe(true);
  });
  it("covers a turn of the phone: 844 by 390 to 390 by 844 changes the open cover about 1.9 times", () => {
    expect(coverNeedsRepaint(coverPixels(160, 2), coverPixels(300, 2))).toBe(true);
    expect(coverNeedsRepaint(coverPixels(300, 2), coverPixels(160, 2))).toBe(true);
  });
  it("never asks for a repaint on a missing size", () => {
    expect(coverNeedsRepaint(0, 500)).toBe(false);
    expect(coverNeedsRepaint(500, Number.NaN)).toBe(false);
  });
});
