import { describe, expect, it } from "vitest";
import { GROUND, GROUND_EMBER, GROUND_POOL } from "../../../styles/tokens";
import { breathRange, breathSeconds, emberStops, FALLOFF, GROUND_LOOK, mixHex, poolStops, reachFactor } from "./ground-look";

describe("mixHex", () => {
  it("returns the ends at 0 and 1 and the middle in between", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#fefefe", 0.5)).toBe("#7f7f7f");
  });
  it("ignores an alpha pair on the end of its input", () => {
    expect(mixHex("#10101080", "#20202000", 0.5)).toBe("#181818");
  });
});

describe("the pool and the ember", () => {
  it("run from the colour at the centre to the ground at the edge", () => {
    const pool = poolStops();
    expect(pool[0]).toEqual({ position: 0, color: GROUND_POOL });
    expect(pool.at(-1)).toEqual({ position: 1, color: GROUND });
  });
  it("fade the ember to nothing at the edge", () => {
    const ember = emberStops();
    expect(ember[0].color).toBe(`${GROUND_EMBER}ff`);
    expect(ember.at(-1)?.color).toBe(`${GROUND_EMBER}00`);
  });
  it("fall off smoothly: positions rise and the share kept only falls", () => {
    for (let i = 1; i < FALLOFF.length; i++) {
      expect(FALLOFF[i][0]).toBeGreaterThan(FALLOFF[i - 1][0]);
      expect(FALLOFF[i][1]).toBeLessThan(FALLOFF[i - 1][1]);
    }
  });
  it("keeps the pool no brighter than the 85% rule allows at its peak, and the ember short of the accent", () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(GROUND_POOL.slice(i, i + 2), 16));
    expect(Math.max(r, g, b)).toBeLessThanOrEqual(0x2a);
    expect(GROUND_EMBER).not.toBe("#fc4c00");
    expect(parseInt(GROUND_EMBER.slice(1, 3), 16)).toBeLessThan(0xfc * 0.5);
  });
});

describe("the drift", () => {
  it("takes no less than 40 s for a full breath", () => {
    expect(breathSeconds(GROUND_LOOK.poolSpeed)).toBeGreaterThanOrEqual(40);
    expect(breathSeconds(GROUND_LOOK.emberSpeed)).toBeGreaterThanOrEqual(40);
  });
  it("moves the radius a little each way", () => {
    const { min, max } = breathRange(1);
    expect(min).toBeLessThan(1);
    expect(max).toBeGreaterThan(1);
    expect(max - min).toBeLessThan(0.3);
  });
});

describe("reachFactor", () => {
  it("is 1 on a landscape or squarish screen", () => {
    expect(reachFactor(1440, 900)).toBe(1);
    expect(reachFactor(1920, 1080)).toBe(1);
    expect(reachFactor(1000, 1000)).toBe(1);
    expect(reachFactor(800, 1000)).toBe(1);
  });
  it("shrinks with the width on a tall narrow screen", () => {
    expect(reachFactor(390, 844)).toBeCloseTo((1.25 * 390) / 844);
    expect(reachFactor(320, 568)).toBeCloseTo(0.704, 3);
  });
  it("is 1 for a size it cannot use", () => {
    expect(reachFactor(0, 800)).toBe(1);
    expect(reachFactor(800, 0)).toBe(1);
  });
});
