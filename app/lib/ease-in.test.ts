import { describe, expect, it } from "vitest";
import { EASE_IN_MS, easeInRate, easeInTime } from "./ease-in";

describe("easeInRate", () => {
  it("starts from standstill and reaches full speed at the end of the ramp, and stays there", () => {
    expect(easeInRate(0)).toBe(0);
    expect(easeInRate(EASE_IN_MS)).toBe(1);
    expect(easeInRate(EASE_IN_MS * 3)).toBe(1);
    expect(easeInRate(-50)).toBe(0);
  });

  it("only ever speeds up, with no jump", () => {
    let last = 0;
    for (let t = 0; t <= EASE_IN_MS; t += 10) {
      const r = easeInRate(t);
      expect(r).toBeGreaterThanOrEqual(last);
      expect(r - last).toBeLessThan(0.05);
      last = r;
    }
  });

  it("takes at least 800 ms (the spec's floor) to reach its speed", () => {
    expect(EASE_IN_MS).toBeGreaterThanOrEqual(800);
    expect(easeInRate(EASE_IN_MS * 0.5)).toBeCloseTo(0.5, 5);
    expect(easeInRate(790)).toBeLessThan(1);
  });
});

describe("easeInTime", () => {
  it("is 0 at the start, half the ramp at its end, and then keeps pace with the clock", () => {
    expect(easeInTime(0)).toBe(0);
    expect(easeInTime(-10)).toBe(0);
    expect(easeInTime(EASE_IN_MS)).toBeCloseTo(EASE_IN_MS / 2, 6);
    expect(easeInTime(EASE_IN_MS + 400)).toBeCloseTo(EASE_IN_MS / 2 + 400, 6);
  });

  it("is the integral of easeInRate", () => {
    let sum = 0;
    for (let t = 0; t < 700; t += 1) sum += easeInRate(t + 0.5);
    expect(easeInTime(700)).toBeCloseTo(sum, 0);
  });

  it("has moved less than a fifth of a second's worth after 700 ms: the first moments are nearly still", () => {
    expect(easeInTime(700)).toBeLessThan(250);
  });
});
