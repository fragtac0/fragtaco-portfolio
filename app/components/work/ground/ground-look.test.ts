import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GROUND, GROUND_EMBER, GROUND_POOL } from "../../../styles/tokens";
import { emberCssAlphas, emberStops, FALLOFF, GROUND_LOOK, mixHex, needsRedraw, poolStops, reachFactor } from "./ground-look";

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
  it("takes no less than 40 s for a full cycle", () => {
    expect(GROUND_LOOK.drift.seconds).toBeGreaterThanOrEqual(40);
  });
  it("scales the canvas up a little and never down (so no edge is ever uncovered)", () => {
    expect(GROUND_LOOK.drift.scale).toBeGreaterThan(1);
    expect(GROUND_LOOK.drift.scale).toBeLessThanOrEqual(1.1);
  });
  it("breathes about the pool", () => {
    expect(GROUND_LOOK.drift.originX).toBe(GROUND_LOOK.pool.x);
    expect(GROUND_LOOK.drift.originY).toBe(GROUND_LOOK.pool.y);
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

describe("needsRedraw", () => {
  it("keeps the still for a small resize", () => {
    expect(needsRedraw([1440, 900], [1440, 900])).toBe(false);
    expect(needsRedraw([1440, 900], [1500, 940])).toBe(false);
    expect(needsRedraw([390, 844], [390, 760])).toBe(false);
  });
  it("takes a new one when the width or height moves by more than 15%", () => {
    expect(needsRedraw([1440, 900], [1800, 900])).toBe(true);
    expect(needsRedraw([1440, 900], [1440, 700])).toBe(true);
    expect(needsRedraw([390, 844], [844, 390])).toBe(true);
  });
  it("takes one when there was no usable size", () => {
    expect(needsRedraw([0, 0], [1440, 900])).toBe(true);
  });
});

describe("emberCssAlphas", () => {
  const alphas = emberCssAlphas();
  it("runs from full strength at the centre to nothing at the edge", () => {
    expect(alphas[0][1]).toBeCloseTo(1, 5);
    expect(alphas.at(-1)?.[1]).toBeCloseTo(0, 5);
  });
  it("is stronger than the share the shader keeps, because linear light is brighter than sRGB", () => {
    for (let i = 1; i < alphas.length - 1; i++) expect(alphas[i][1]).toBeGreaterThan(FALLOFF[i][1]);
  });
  it("only falls", () => {
    for (let i = 1; i < alphas.length; i++) expect(alphas[i][1]).toBeLessThan(alphas[i - 1][1]);
  });
  it("matches the values written into ground.css", () => {
    const css = readFileSync(new URL("./ground.css", import.meta.url), "utf8");
    const written = [...css.matchAll(/var\(--ground-ember\) ([\d.]+)%, transparent\) (\d+)%/g)].map((m) => [Number(m[2]), Number(m[1])]);
    expect(written.length).toBe(alphas.length);
    written.forEach(([position, percent], i) => {
      expect(position).toBe(alphas[i][0] * 100);
      expect(percent).toBeCloseTo(alphas[i][1] * 100, 0);
    });
  });
});
