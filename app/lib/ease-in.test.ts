import { describe, expect, it } from "vitest";
import { EASE_IN_MS, easeInRate } from "./ease-in";

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
