import { describe, expect, it } from "vitest";
import { FRAME as SCRIPT_FRAME, HEIGHTS as SCRIPT_HEIGHTS, SUMMIT as SCRIPT_SUMMIT } from "../../../scripts/mars-frame.mjs";
import { FRAME, HEIGHTS, HEIGHT_FRAME, KM_PER_UNIT, PICTURE, SUMMIT, SUMMIT_XY, UNITS_PER_DEG, latOf, lonOf, xOf, yOf } from "./frame";

describe("the frames", () => {
  it("are the numbers that cut the pictures (scripts/mars-frame.mjs)", () => {
    expect(FRAME).toEqual(SCRIPT_FRAME);
    expect(HEIGHTS).toEqual(SCRIPT_HEIGHTS);
    expect(SUMMIT).toEqual(SCRIPT_SUMMIT);
  });

  it("make the picture 1000 by 650 units with the summit at 500, 325", () => {
    expect(FRAME.lonSpan * UNITS_PER_DEG).toBe(PICTURE.w);
    expect(FRAME.latSpan * UNITS_PER_DEG).toBe(PICTURE.h);
    expect(xOf(SUMMIT.lon)).toBeCloseTo(SUMMIT_XY[0], 9);
    expect(yOf(SUMMIT.lat)).toBeCloseTo(SUMMIT_XY[1], 9);
  });

  it("make the heights 1600 by 1040 units with their corner at -300, -195", () => {
    expect(HEIGHTS.lonSpan * UNITS_PER_DEG).toBe(HEIGHT_FRAME.w);
    expect(HEIGHTS.latSpan * UNITS_PER_DEG).toBeCloseTo(HEIGHT_FRAME.h, 9);
    expect((HEIGHTS.west - FRAME.west) * UNITS_PER_DEG).toBeCloseTo(HEIGHT_FRAME.x0, 9);
    expect((FRAME.north - HEIGHTS.north) * UNITS_PER_DEG).toBeCloseTo(HEIGHT_FRAME.y0, 9);
  });

  it("have 2.372 km to a map unit", () => {
    expect(KM_PER_UNIT).toBe(2.372);
  });
});

describe("longitude and latitude in map units", () => {
  it("put the west edge (206.795 E) at x 0 and the north edge at y 0", () => {
    expect(xOf(206.795)).toBeCloseTo(0, 9);
    expect(yOf(FRAME.north)).toBeCloseTo(0, 9);
    expect(xOf(246.795)).toBeCloseTo(1000, 9);
    expect(yOf(FRAME.north - FRAME.latSpan)).toBeCloseTo(650, 9);
  });

  it("round trip", () => {
    for (const lon of [206.795, 215.5, 226.795, 240, 246.795]) expect(lonOf(xOf(lon))).toBeCloseTo(lon, 9);
    for (const lat of [5.366, 18.366, 31.366]) expect(latOf(yOf(lat))).toBeCloseTo(lat, 9);
    for (const x of [-300, 0, 500, 1000, 1300]) expect(xOf(lonOf(x))).toBeCloseTo(x, 9);
    for (const y of [-195, 0, 325, 650, 845]) expect(yOf(latOf(y))).toBeCloseTo(y, 9);
  });

  it("give east longitudes in 0 to 360", () => {
    expect(lonOf(0)).toBeCloseTo(206.795, 9);
    expect(lonOf(-300)).toBeCloseTo(194.795, 9);
    expect(lonOf(-9000)).toBeGreaterThanOrEqual(0);
    expect(lonOf(9000)).toBeLessThan(360);
  });
});
