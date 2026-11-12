import { describe, expect, it } from "vitest";
import { canRunGround, groundScale, GROUND_MAX_DPR, libraryDprCap } from "./can-run";

describe("canRunGround", () => {
  it("runs with WebGPU and no request for less", () => {
    expect(canRunGround({ gpu: true, reduced: false, saveData: false })).toBe(true);
  });
  it("does not run without WebGPU", () => {
    expect(canRunGround({ gpu: false, reduced: false, saveData: false })).toBe(false);
  });
  it("does not run for reduced motion", () => {
    expect(canRunGround({ gpu: true, reduced: true, saveData: false })).toBe(false);
  });
  it("does not run for save-data", () => {
    expect(canRunGround({ gpu: true, reduced: false, saveData: true })).toBe(false);
  });
});

describe("libraryDprCap", () => {
  it("is 2 on a desktop and 1.5 on a phone or small tablet", () => {
    expect(libraryDprCap({ coarse: false, longSide: 1440 })).toBe(2);
    expect(libraryDprCap({ coarse: true, longSide: 844 })).toBe(1.5);
    expect(libraryDprCap({ coarse: true, longSide: 1366 })).toBe(1.5);
    expect(libraryDprCap({ coarse: true, longSide: 1600 })).toBe(2);
    expect(libraryDprCap({ coarse: true, longSide: 0 })).toBe(2);
  });
});

describe("groundScale", () => {
  it("is 1 at or under the cap", () => {
    expect(groundScale(1, 2)).toBe(1);
    expect(groundScale(1.25, 2)).toBe(1);
    expect(groundScale(0.5, 2)).toBe(1);
  });
  it("brings a dpr 2 screen to 1.25 (scale 1.6)", () => {
    expect(groundScale(2, 2)).toBeCloseTo(2 / GROUND_MAX_DPR);
  });
  it("uses the package's cap when the screen is denser than it", () => {
    expect(groundScale(3, 2)).toBeCloseTo(1.6); // drawn at 2, shown at 1.25
    expect(groundScale(3, 1.5)).toBeCloseTo(1.2); // a phone: drawn at 1.5, shown at 1.25
  });
  it("scales a dpr 1.5 screen by 1.2", () => {
    expect(groundScale(1.5, 2)).toBeCloseTo(1.2);
  });
});
