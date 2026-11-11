import { describe, expect, it } from "vitest";
import { STOPS, curve, gradeLut, ramp } from "./mars-grade.mjs";

const hex = ([r, g, b]: number[]) =>
  "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");

const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function hue([r, g, b]: number[]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const steps = Array.from({ length: 101 }, (_, i) => i / 100);

describe("ramp", () => {
  it("starts at the deep shadow and ends at the highlight", () => {
    expect(hex(ramp(0))).toBe("#1a0a04");
    expect(hex(ramp(1))).toBe("#ffd9b0");
  });

  it("passes through the mid and light stops exactly", () => {
    const mid = STOPS[1];
    const light = STOPS[2];
    expect(hex(ramp(mid.at))).toBe("#c2410c");
    expect(hex(ramp(light.at))).toBe("#ff8a3d");
  });

  it("has four stops in increasing order from 0 to 1", () => {
    expect(STOPS).toHaveLength(4);
    expect(STOPS[0].at).toBe(0);
    expect(STOPS[3].at).toBe(1);
    for (let i = 1; i < STOPS.length; i++) expect(STOPS[i].at).toBeGreaterThan(STOPS[i - 1].at);
  });

  it("gets lighter with every step", () => {
    let last = -1;
    for (const v of steps) {
      const l = luma(ramp(v));
      expect(l).toBeGreaterThanOrEqual(last);
      last = l;
    }
  });

  it("keeps the hue between 15 and 35 degrees all the way up", () => {
    for (const v of steps) {
      const h = hue(ramp(v));
      expect(h).toBeGreaterThanOrEqual(15);
      expect(h).toBeLessThanOrEqual(35);
    }
  });

  it("clamps values outside 0..1", () => {
    expect(ramp(-0.5)).toEqual(ramp(0));
    expect(ramp(1.5)).toEqual(ramp(1));
  });
});

describe("curve", () => {
  const flat = { black: 0, white: 1, gamma: 1 };

  it("is the identity with flat levels and gamma 1", () => {
    for (const v of [0, 0.25, 0.5, 0.9, 1]) expect(curve(v, flat)).toBeCloseTo(v, 10);
  });

  it("clips at the black and white points", () => {
    const p = { black: 0.2, white: 0.8, gamma: 1 };
    expect(curve(0.1, p)).toBe(0);
    expect(curve(0.9, p)).toBe(1);
    expect(curve(0.5, p)).toBeCloseTo(0.5, 10);
  });

  it("a gamma above 1 lifts the mids and keeps the ends", () => {
    const p = { black: 0, white: 1, gamma: 1.5 };
    expect(curve(0, p)).toBe(0);
    expect(curve(1, p)).toBe(1);
    expect(curve(0.5, p)).toBeGreaterThan(0.5);
  });

  it("never goes down as the input goes up", () => {
    const p = { black: 0.15, white: 0.85, gamma: 1.3 };
    let last = -1;
    for (const v of steps) {
      const c = curve(v, p);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });
});

describe("gradeLut", () => {
  it("has one rgb triple for each of the 256 grey values", () => {
    const lut = gradeLut({ black: 0, white: 1, gamma: 1 });
    expect(lut).toHaveLength(256 * 3);
    expect(hex([lut[0], lut[1], lut[2]])).toBe("#1a0a04");
    expect(hex([lut[765], lut[766], lut[767]])).toBe("#ffd9b0");
  });
});
