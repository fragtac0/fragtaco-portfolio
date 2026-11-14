import { describe, expect, it } from "vitest";
import {
  extentRadius,
  fractionDistance,
  frameOf,
  fromFraction,
  insideFrame,
  meanRadius,
  pointInRing,
  toFraction,
  toLonLat,
  toPixel,
  type Frame,
} from "./geo";

// A frame to test the projection on: the summit in the middle, 14 degrees of latitude tall, 8192 pixels across.
const CENTRE = { lon: 226.795, lat: 18.366 };
const SPAN_DEG = 14;
const LON_SCALE = Math.cos((CENTRE.lat * Math.PI) / 180);
const LON_SPAN_DEG = SPAN_DEG / LON_SCALE;
const SIZE = 8192;

const big: Frame = { centre: CENTRE, spanDeg: SPAN_DEG, lonScale: LON_SCALE, size: SIZE };

describe("toPixel and toLonLat (ruling R29)", () => {
  it("puts the centre in the middle of the picture", () => {
    expect(toPixel(CENTRE.lon, CENTRE.lat, big)).toEqual({ x: 4096, y: 4096 });
    expect(toFraction(CENTRE.lon, CENTRE.lat, big)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("follows x = 0.5 + dLon * lonScale / span and y = 0.5 - dLat / span", () => {
    const p = toPixel(CENTRE.lon + 1, CENTRE.lat + 2, big);

    expect(p.x).toBeCloseTo((0.5 + (1 * big.lonScale) / big.spanDeg) * big.size, 9);
    expect(p.y).toBeCloseTo((0.5 - 2 / big.spanDeg) * big.size, 9);
  });

  it("puts north up and east to the right", () => {
    const here = toPixel(CENTRE.lon, CENTRE.lat, big);
    const northEast = toPixel(CENTRE.lon + 0.5, CENTRE.lat + 0.5, big);

    expect(northEast.x).toBeGreaterThan(here.x);
    expect(northEast.y).toBeLessThan(here.y);
  });

  it("puts the frame's corners at the corners of the picture", () => {
    const west = CENTRE.lon - LON_SPAN_DEG / 2;
    const north = CENTRE.lat + SPAN_DEG / 2;

    expect(toPixel(west, north, big).x).toBeCloseTo(0, 6);
    expect(toPixel(west, north, big).y).toBeCloseTo(0, 6);
    expect(toPixel(west + LON_SPAN_DEG, north - SPAN_DEG, big).x).toBeCloseTo(SIZE, 6);
    expect(toPixel(west + LON_SPAN_DEG, north - SPAN_DEG, big).y).toBeCloseTo(SIZE, 6);
  });

  it("is round on the ground: a degree of latitude is as long as lonScale-wide degrees of longitude", () => {
    const dLat = toPixel(CENTRE.lon, CENTRE.lat + 1, big).y - toPixel(CENTRE.lon, CENTRE.lat, big).y;
    const dLon = toPixel(CENTRE.lon + 1 / big.lonScale, CENTRE.lat, big).x - toPixel(CENTRE.lon, CENTRE.lat, big).x;

    expect(Math.abs(dLat)).toBeCloseTo(dLon, 9);
  });

  it("is its own inverse, both ways, anywhere in and around the frame", () => {
    for (const [lon, lat] of [[222, 13], [226.795, 18.366], [231.5, 22.1], [219.4, 25.3], [234.1, 11.5], [200, -5]]) {
      const p = toPixel(lon, lat, big);
      const back = toLonLat(p.x, p.y, big);

      expect(back.lon).toBeCloseTo(lon, 9);
      expect(back.lat).toBeCloseTo(lat, 9);
    }
    for (const [x, y] of [[0, 0], [8192, 8192], [123.4, 7000.9], [4096, 4096]]) {
      const l = toLonLat(x, y, big);
      const back = toPixel(l.lon, l.lat, big);

      expect(back.x).toBeCloseTo(x, 7);
      expect(back.y).toBeCloseTo(y, 7);
    }
  });

  it("has fraction functions that invert each other too", () => {
    const l = fromFraction(0.25, 0.75, big);
    const f = toFraction(l.lon, l.lat, big);

    expect(f.x).toBeCloseTo(0.25, 12);
    expect(f.y).toBeCloseTo(0.75, 12);
  });
});

describe("a frame of fractions", () => {
  const f = frameOf({ lon: 226.795, lat: 18.366 }, 14);

  it("has the big frame's width scale and a size of 1", () => {
    expect(f.lonScale).toBeCloseTo(big.lonScale, 12);
    expect(toPixel(228, 19, f).x).toBeCloseTo(toPixel(228, 19, big).x / big.size, 12);
  });

  it("knows what is inside it", () => {
    expect(insideFrame(226.795, 18.366, f)).toBe(true);
    expect(insideFrame(215.53, 28.14, f)).toBe(false); // Lycus Sulci
    expect(insideFrame(226.795, 25.4, f)).toBe(false); // just north of the top edge
    expect(insideFrame(226.795, 25.3, f)).toBe(true);
  });

  it("measures distance in fractions of the picture, round on the ground", () => {
    expect(fractionDistance({ lon: 226.795, lat: 18.366 }, { lon: 226.795, lat: 25.366 }, f)).toBeCloseTo(0.5, 12);
    expect(fractionDistance({ lon: 226.795, lat: 18.366 }, { lon: 226.795 + 7 / f.lonScale, lat: 18.366 }, f)).toBeCloseTo(0.5, 12);
  });
});

describe("pointInRing", () => {
  const f = frameOf({ lon: 0, lat: 0 }, 10);
  const square = [{ lon: -1, lat: -1 }, { lon: 1, lat: -1 }, { lon: 1, lat: 1 }, { lon: -1, lat: 1 }];
  // an L-shape, to check that a concave ring works
  const ell = [{ lon: 0, lat: 0 }, { lon: 4, lat: 0 }, { lon: 4, lat: 1 }, { lon: 1, lat: 1 }, { lon: 1, lat: 4 }, { lon: 0, lat: 4 }];

  it("tells inside from outside", () => {
    expect(pointInRing({ lon: 0, lat: 0.2 }, square, f)).toBe(true);
    expect(pointInRing({ lon: 2, lat: 0 }, square, f)).toBe(false);
    expect(pointInRing({ lon: 0, lat: 5 }, square, f)).toBe(false);
  });

  it("works for a concave ring and does not need the first point repeated", () => {
    expect(pointInRing({ lon: 3, lat: 0.5 }, ell, f)).toBe(true);
    expect(pointInRing({ lon: 0.5, lat: 3 }, ell, f)).toBe(true);
    expect(pointInRing({ lon: 3, lat: 3 }, ell, f)).toBe(false);
  });
});

describe("meanRadius and extentRadius", () => {
  const f = frameOf({ lon: 100, lat: 0 }, 10);

  it("averages the distance of a ring's points from the centre", () => {
    const ring = [{ lon: 101, lat: 0 }, { lon: 99, lat: 0 }, { lon: 100, lat: 2 }, { lon: 100, lat: -2 }];

    expect(meanRadius(ring, f)).toBeCloseTo(0.15, 12);
    expect(meanRadius([], f)).toBe(0);
  });

  it("takes a feature's radius from its extent, scaling the longitude", () => {
    const g = frameOf({ lon: 226.795, lat: 18.366 }, 14);
    const r = extentRadius({ north: 19, south: 17, east: 228, west: 226 }, g);

    expect(r).toBeCloseTo((1 + 1 * g.lonScale) / 2 / 14, 12);
  });
});
