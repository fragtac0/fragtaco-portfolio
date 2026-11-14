import { describe, expect, it } from "vitest";
import { clamp, ease, lerp, range, smooth } from "./map-math";

describe("map-math", () => {
  it("clamp holds a number between 0 and 1 unless told otherwise", () => {
    expect([clamp(-1), clamp(0.4), clamp(7), clamp(5, 2, 4), clamp(1, 2, 4)]).toEqual([0, 0.4, 1, 4, 2]);
  });

  it("lerp mixes", () => {
    expect([lerp(10, 20, 0), lerp(10, 20, 0.25), lerp(10, 20, 1)]).toEqual([10, 12.5, 20]);
  });

  it("smooth is 0 before, 1 after and 0.5 in the middle", () => {
    expect([smooth(0.2, 1, 0), smooth(0.2, 1, 0.2), smooth(0.2, 1, 1), smooth(0.2, 1, 2)]).toEqual([0, 0, 1, 1]);
    expect(smooth(0.2, 1, 0.6)).toBeCloseTo(0.5, 12);
  });

  it("ease is 0 at 0, 1 at 1, 0.5 in the middle and slow at both ends", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(0.1)).toBeLessThan(0.01);
    expect(ease(0.9)).toBeGreaterThan(0.99);
  });

  it("range is d3.range: from start, not reaching stop", () => {
    expect(range(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(range(190, 196, 2.5)).toEqual([190, 192.5, 195]);
    expect(range(5, 0)).toEqual([]);
    expect(range(-195, 846, 8)).toHaveLength(131);
  });
});
