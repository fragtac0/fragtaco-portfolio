import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CENTRE, LEVELS, LON_SCALE, LON_SPAN_DEG, SIZE, SPAN_DEG, TILE } from "../../../scripts/mars-frame.mjs";
import {
  ManifestSchema,
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
  type Manifest,
} from "./geo";

const manifest: Manifest = ManifestSchema.parse(
  JSON.parse(readFileSync(path.join(process.cwd(), "public", "mars", "manifest.json"), "utf8")),
);

describe("the manifest", () => {
  it("parses and agrees with scripts/mars-frame.mjs", () => {
    expect(manifest.centre).toEqual(CENTRE);
    expect(manifest.spanDeg).toBe(SPAN_DEG);
    expect(manifest.lonScale).toBeCloseTo(LON_SCALE, 12);
    expect(manifest.lonSpanDeg).toBeCloseTo(LON_SPAN_DEG, 12);
    expect(manifest.tile).toBe(TILE);
    expect(manifest.levels).toBe(LEVELS);
    expect(manifest.size).toBe(SIZE);
  });

  it("is refused when a field is missing", () => {
    const { size: _size, ...rest } = manifest;

    expect(ManifestSchema.safeParse(rest).success).toBe(false);
  });
});

describe("toPixel and toLonLat (ruling R29)", () => {
  it("puts the centre in the middle of the picture", () => {
    expect(toPixel(CENTRE.lon, CENTRE.lat, manifest)).toEqual({ x: 4096, y: 4096 });
    expect(toFraction(CENTRE.lon, CENTRE.lat, manifest)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("follows x = 0.5 + dLon * lonScale / span and y = 0.5 - dLat / span", () => {
    const p = toPixel(CENTRE.lon + 1, CENTRE.lat + 2, manifest);

    expect(p.x).toBeCloseTo((0.5 + (1 * manifest.lonScale) / manifest.spanDeg) * manifest.size, 9);
    expect(p.y).toBeCloseTo((0.5 - 2 / manifest.spanDeg) * manifest.size, 9);
  });

  it("puts north up and east to the right", () => {
    const here = toPixel(CENTRE.lon, CENTRE.lat, manifest);
    const northEast = toPixel(CENTRE.lon + 0.5, CENTRE.lat + 0.5, manifest);

    expect(northEast.x).toBeGreaterThan(here.x);
    expect(northEast.y).toBeLessThan(here.y);
  });

  it("puts the frame's corners at the corners of the picture", () => {
    const west = CENTRE.lon - LON_SPAN_DEG / 2;
    const north = CENTRE.lat + SPAN_DEG / 2;

    expect(toPixel(west, north, manifest).x).toBeCloseTo(0, 6);
    expect(toPixel(west, north, manifest).y).toBeCloseTo(0, 6);
    expect(toPixel(west + LON_SPAN_DEG, north - SPAN_DEG, manifest).x).toBeCloseTo(SIZE, 6);
    expect(toPixel(west + LON_SPAN_DEG, north - SPAN_DEG, manifest).y).toBeCloseTo(SIZE, 6);
  });

  it("is round on the ground: a degree of latitude is as long as lonScale-wide degrees of longitude", () => {
    const dLat = toPixel(CENTRE.lon, CENTRE.lat + 1, manifest).y - toPixel(CENTRE.lon, CENTRE.lat, manifest).y;
    const dLon = toPixel(CENTRE.lon + 1 / manifest.lonScale, CENTRE.lat, manifest).x - toPixel(CENTRE.lon, CENTRE.lat, manifest).x;

    expect(Math.abs(dLat)).toBeCloseTo(dLon, 9);
  });

  it("is its own inverse, both ways, anywhere in and around the frame", () => {
    for (const [lon, lat] of [[222, 13], [226.795, 18.366], [231.5, 22.1], [219.4, 25.3], [234.1, 11.5], [200, -5]]) {
      const p = toPixel(lon, lat, manifest);
      const back = toLonLat(p.x, p.y, manifest);

      expect(back.lon).toBeCloseTo(lon, 9);
      expect(back.lat).toBeCloseTo(lat, 9);
    }
    for (const [x, y] of [[0, 0], [8192, 8192], [123.4, 7000.9], [4096, 4096]]) {
      const l = toLonLat(x, y, manifest);
      const back = toPixel(l.lon, l.lat, manifest);

      expect(back.x).toBeCloseTo(x, 7);
      expect(back.y).toBeCloseTo(y, 7);
    }
  });

  it("has fraction functions that invert each other too", () => {
    const l = fromFraction(0.25, 0.75, manifest);
    const f = toFraction(l.lon, l.lat, manifest);

    expect(f.x).toBeCloseTo(0.25, 12);
    expect(f.y).toBeCloseTo(0.75, 12);
  });
});

describe("a frame of fractions", () => {
  const f = frameOf({ lon: 226.795, lat: 18.366 }, 14);

  it("has the manifest's width scale and a size of 1", () => {
    expect(f.lonScale).toBeCloseTo(manifest.lonScale, 12);
    expect(toPixel(228, 19, f).x).toBeCloseTo(toPixel(228, 19, manifest).x / manifest.size, 12);
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
