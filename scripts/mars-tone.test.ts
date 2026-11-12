import { describe, expect, it } from "vitest";
import { TONE, grey, lift, tone, toneLut } from "./mars-tone.mjs";

describe("the toning numbers", () => {
  it("are the ones from preview 3", () => {
    expect(TONE).toEqual({ contrast: 1.42, brightness: 1.28, orange: [0.86, 0.5, 0.27] });
  });
});

describe("grey", () => {
  it("is 0 for black, 1 for white and weights green most", () => {
    expect(grey(0, 0, 0)).toBe(0);
    expect(grey(255, 255, 255)).toBeCloseTo(1, 12);
    expect(grey(0, 255, 0)).toBeGreaterThan(grey(255, 0, 0));
    expect(grey(255, 0, 0)).toBeGreaterThan(grey(0, 0, 255));
  });
});

describe("lift", () => {
  it("keeps the middle at brightness times 0.5 and clamps both ends", () => {
    expect(lift(0.5)).toBeCloseTo(0.64, 12);
    expect(lift(0)).toBe(0);
    expect(lift(1)).toBe(1);
  });
  it("only rises with the grey value", () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const v = lift(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe("tone and toneLut", () => {
  it("multiplies the orange over the lifted grey", () => {
    expect(tone(1)).toEqual([219, 128, 69]);
    expect(tone(0)).toEqual([0, 0, 0]);
  });
  it("lays out 256 triples that agree with tone", () => {
    const lut = toneLut();
    expect(lut.length).toBe(768);
    expect([...lut.slice(300, 303)]).toEqual(tone(100 / 255));
    expect([...lut.slice(765, 768)]).toEqual([219, 128, 69]);
  });
});
