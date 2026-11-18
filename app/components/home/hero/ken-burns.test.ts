import { describe, expect, it } from "vitest";
import { KEN_BURNS_MS, kenBurnsZoom } from "./ken-burns";

describe("kenBurnsZoom", () => {
  it("runs the slow zoom over 12 seconds", () => {
    expect(KEN_BURNS_MS).toBe(12000);
  });
  it("starts at the painting's own zoom and ends 7% closer", () => {
    expect(kenBurnsZoom(1, 0, false)).toBe(1);
    expect(kenBurnsZoom(1, 12000, false)).toBeCloseTo(1.07, 10);
    expect(kenBurnsZoom(1.2, 12000, false)).toBeCloseTo(1.2 * 1.07, 10);
  });
  it("is half way (eased) at 6 seconds and stops after 12", () => {
    expect(kenBurnsZoom(1, 6000, false)).toBeCloseTo(1.035, 10);
    expect(kenBurnsZoom(1, 60000, false)).toBeCloseTo(1.07, 10);
  });
  it("does not drift under reduced motion, however old the painting is", () => {
    expect(kenBurnsZoom(1.2, 0, true)).toBe(1.2);
    expect(kenBurnsZoom(1.2, 12000, true)).toBe(1.2);
  });
});
