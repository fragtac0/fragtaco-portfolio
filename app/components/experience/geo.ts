// The Mars map's projection (spec 9.1, ruling R29). Pure maths, no DOM, safe on the server.
//
// The picture is a square on the ground: 14 degrees of latitude tall, and wider in longitude by
// 1 / cos(latitude of the centre) so the mountain is round. With the centre of the frame at
// (c.lon, c.lat), a point (lon, lat) sits at, in fractions of the picture from its top left corner,
//
//   x = 0.5 + (lon - c.lon) * lonScale / spanDeg
//   y = 0.5 - (lat - c.lat) / spanDeg
//
// and in picture pixels at the top level of the tile pyramid that is the fraction times `size`.
// scripts/mars-frame.mjs holds the same constants for the script that made the tiles; the tests
// compare the two.
import { z } from "zod";

/** `public/mars/manifest.json`, written by `scripts/make-mars.mjs`. */
export const ManifestSchema = z.object({
  centre: z.object({ lon: z.number(), lat: z.number() }),
  spanDeg: z.number().positive(),
  lonScale: z.number().positive(),
  lonSpanDeg: z.number().positive(),
  tile: z.number().int().positive(),
  levels: z.number().int().min(1),
  size: z.number().int().positive(),
  credit: z.string().min(1),
  sources: z.array(z.string().min(1)),
  grade: z.object({ black: z.number(), white: z.number(), gamma: z.number() }),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/** What the projection needs from the manifest (so the content schema can use it with `size` 1). */
export type Frame = Pick<Manifest, "centre" | "spanDeg" | "lonScale" | "size">;

export type LonLat = { lon: number; lat: number };
export type Point = { x: number; y: number };

/** A frame of fractions (`size` 1) centred on (lon, lat), with the width scaled by the latitude's cosine. */
export function frameOf(centre: LonLat, spanDeg: number): Frame {
  return { centre, spanDeg, lonScale: Math.cos((centre.lat * Math.PI) / 180), size: 1 };
}

/** Longitude and latitude to a fraction of the picture (0 to 1 across, from the top left). */
export function toFraction(lon: number, lat: number, m: Frame): Point {
  return {
    x: 0.5 + ((lon - m.centre.lon) * m.lonScale) / m.spanDeg,
    y: 0.5 - (lat - m.centre.lat) / m.spanDeg,
  };
}

/** The inverse of `toFraction`. */
export function fromFraction(x: number, y: number, m: Frame): LonLat {
  return {
    lon: m.centre.lon + ((x - 0.5) * m.spanDeg) / m.lonScale,
    lat: m.centre.lat - (y - 0.5) * m.spanDeg,
  };
}

/** Longitude and latitude to picture pixels at the top level (0 to `size`, from the top left). */
export function toPixel(lon: number, lat: number, m: Frame): Point {
  const f = toFraction(lon, lat, m);

  return { x: f.x * m.size, y: f.y * m.size };
}

/** The inverse of `toPixel`. */
export function toLonLat(x: number, y: number, m: Frame): LonLat {
  return fromFraction(x / m.size, y / m.size, m);
}

/** Is the point inside the picture? */
export function insideFrame(lon: number, lat: number, m: Frame): boolean {
  const { x, y } = toFraction(lon, lat, m);

  return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

/** Distance between two points in fractions of the picture (the picture is square on the ground, so this is true distance). */
export function fractionDistance(a: LonLat, b: LonLat, m: Frame): number {
  const pa = toFraction(a.lon, a.lat, m);
  const pb = toFraction(b.lon, b.lat, m);

  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

/** Even-odd test: is the point inside a ring of longitude and latitude pairs? (Planar in the picture's own plane.) */
export function pointInRing(p: LonLat, ring: readonly LonLat[], m: Frame): boolean {
  const q = toFraction(p.lon, p.lat, m);
  const pts = ring.map((r) => toFraction(r.lon, r.lat, m));
  let inside = false;

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];

    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }

  return inside;
}

/** The mean distance from the frame's centre (the summit) to the points of a ring, in fractions of the picture. */
export function meanRadius(ring: readonly LonLat[], m: Frame): number {
  if (ring.length === 0) return 0;

  return ring.reduce((sum, p) => sum + fractionDistance(p, m.centre, m), 0) / ring.length;
}

/** A feature's outer extent in degrees, as the Gazetteer gives it. */
export type Extent = { north: number; south: number; east: number; west: number };

/** The radius of a roughly round feature from its extent, in fractions of the picture (longitude is scaled by `lonScale`). */
export function extentRadius(e: Extent, m: Frame): number {
  const halfLat = (e.north - e.south) / 2;
  const halfLon = ((e.east - e.west) / 2) * m.lonScale;

  return (halfLat + halfLon) / 2 / m.spanDeg;
}
