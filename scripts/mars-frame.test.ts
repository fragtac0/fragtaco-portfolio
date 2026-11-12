import { describe, expect, it } from "vitest";
import { FRAME, HEIGHTS, SUMMIT, boundsOf, latOf, lonOf, pxPerDeg, tileRange, xOf, yOf } from "./mars-frame.mjs";

describe("the picture frame", () => {
  it("is 40 by 26 degrees at 25 units a degree: 1000 by 650 units", () => {
    expect(FRAME.lonSpan * FRAME.unitsPerDeg).toBe(1000);
    expect(FRAME.latSpan * FRAME.unitsPerDeg).toBe(650);
  });

  it("puts the summit at 500, 325", () => {
    expect(xOf(SUMMIT.lon)).toBeCloseTo(500, 9);
    expect(yOf(SUMMIT.lat)).toBeCloseTo(325, 9);
  });

  it("puts the west edge (206.795 E) at x 0 and the north edge at y 0", () => {
    expect(xOf(206.795)).toBeCloseTo(0, 9);
    expect(yOf(FRAME.north)).toBeCloseTo(0, 9);
    expect(xOf(246.795)).toBeCloseTo(1000, 9);
    expect(yOf(FRAME.north - FRAME.latSpan)).toBeCloseTo(650, 9);
  });

  it("round trips longitude and latitude through map units", () => {
    for (const lon of [206.795, 215.5, 226.795, 240, 246.795]) expect(lonOf(xOf(lon))).toBeCloseTo(lon, 9);
    for (const lat of [5.366, 18.366, 31.366]) expect(latOf(yOf(lat))).toBeCloseTo(lat, 9);
    for (const x of [-300, 0, 500, 1000, 1300]) expect(xOf(lonOf(x))).toBeCloseTo(x, 9);
    for (const y of [-195, 0, 325, 650, 845]) expect(yOf(latOf(y))).toBeCloseTo(y, 9);
  });

  it("gives east longitudes in 0 to 360", () => {
    expect(lonOf(0)).toBeCloseTo(206.795, 9);
    expect(lonOf(-300)).toBeCloseTo(194.795, 9);
    expect(lonOf(-9000)).toBeGreaterThanOrEqual(0);
    expect(lonOf(9000)).toBeLessThan(360);
  });
});

describe("the height frame", () => {
  it("covers 1600 by 1040 units with its corner at -300, -195", () => {
    const b = boundsOf(HEIGHTS);
    expect(b.west).toBeCloseTo(-165.205, 9);
    expect(b.east - b.west).toBeCloseTo(64, 9);
    expect(b.north - b.south).toBeCloseTo(41.6, 9);
    expect((HEIGHTS.west - FRAME.west) * FRAME.unitsPerDeg).toBeCloseTo(-300, 9);
    expect((FRAME.north - HEIGHTS.north) * FRAME.unitsPerDeg).toBeCloseTo(-195, 9);
    expect(HEIGHTS.lonSpan * FRAME.unitsPerDeg).toBe(1600);
    expect(HEIGHTS.latSpan * FRAME.unitsPerDeg).toBeCloseTo(1040, 9);
  });

  it("contains the picture frame with the summit in the middle of both", () => {
    const f = boundsOf(FRAME);
    const h = boundsOf(HEIGHTS);
    expect(h.west).toBeLessThan(f.west);
    expect(h.east).toBeGreaterThan(f.east);
    expect(h.north).toBeGreaterThan(f.north);
    expect(h.south).toBeLessThan(f.south);
    expect((h.west + h.east) / 2).toBeCloseTo(SUMMIT.lon - 360, 9);
    expect((h.north + h.south) / 2).toBeCloseTo(SUMMIT.lat, 9);
  });
});

describe("tile ranges", () => {
  it("level z has 2^(z+1) columns of 256 px over 360 degrees", () => {
    expect(pxPerDeg(6)).toBeCloseTo(32768 / 360, 9);
    expect(pxPerDeg(5)).toBeCloseTo(16384 / 360, 9);
  });

  it("covers the picture frame at level 6 with whole tiles and a crop inside them", () => {
    const r = tileRange(FRAME, 6);
    expect(r.cols[0]).toBe(Math.floor(((FRAME.west + 180) * pxPerDeg(6)) / 256));
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.left).toBeLessThan(256);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeLessThan(256);
    expect(r.left + r.width).toBeLessThanOrEqual((r.cols[1] - r.cols[0] + 1) * 256 + 1e-9);
    expect(r.top + r.height).toBeLessThanOrEqual((r.rows[1] - r.rows[0] + 1) * 256 + 1e-9);
    expect(r.width / r.height).toBeCloseTo(40 / 26, 9);
  });

  it("covers the height frame at level 5", () => {
    const r = tileRange(HEIGHTS, 5);
    expect(r.width / r.height).toBeCloseTo(64 / 41.6, 9);
    expect(r.rows[0]).toBeGreaterThanOrEqual(0);
    expect(r.cols[1]).toBeLessThan(64);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.left).toBeLessThan(256);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.top).toBeLessThan(256);
    expect(r.left + r.width).toBeLessThanOrEqual((r.cols[1] - r.cols[0] + 1) * 256 + 1e-9);
    expect(r.top + r.height).toBeLessThanOrEqual((r.rows[1] - r.rows[0] + 1) * 256 + 1e-9);
  });
});
