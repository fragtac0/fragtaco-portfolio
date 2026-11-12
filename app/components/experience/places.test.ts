import { describe, expect, it } from "vitest";
import { frameOf, toLonLat } from "./geo";
import experience from "../../../content/site/experience.json";
import { bearingOf, cliffPointAt, leaderOf, placePoint } from "./places";

const frame = { ...frameOf({ lon: 226.795, lat: 18.366 }, 14), size: 8192 };
const at = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;

  return toLonLat(4096 + r * Math.cos(a), 4096 + r * Math.sin(a), frame);
};

describe("bearingOf", () => {
  it("is clockwise from east on screen", () => {
    expect(bearingOf(at(1000, 0), frame)).toBeCloseTo(0, 3);
    expect(bearingOf(at(1000, 90), frame)).toBeCloseTo(90, 3); // south
    expect(bearingOf(at(1000, 180), frame)).toBeCloseTo(180, 3);
    expect(bearingOf(at(1000, 270), frame)).toBeCloseTo(270, 3); // north
  });
});

describe("cliffPointAt", () => {
  const ring = [0, 40, 100, 160, 220, 280, 330].map((d) => at(2500 + d, d));

  it("returns a point of the ring, the one nearest the bearing", () => {
    expect(cliffPointAt(95, ring, frame)).toBe(ring[2]);
    expect(cliffPointAt(320, ring, frame)).toBe(ring[6]);
    expect(cliffPointAt(2, ring, frame)).toBe(ring[0]); // wraps round 360
  });
});

describe("placePoint", () => {
  const ring = [at(2400, 120), at(2400, 200)];

  it("is the place itself, or on the trace for a line feature", () => {
    const p = placePoint({ lon: 226.8, lat: 18.4 }, ring, frame);

    expect(p.x).toBeGreaterThan(4000);
    const q = placePoint({ lon: 226.44, lat: 18.4, cliffBearing: 125 }, ring, frame);

    expect(Math.hypot(q.x - 4096, q.y - 4096)).toBeCloseTo(2400, 0);
  });
});

describe("leaderOf", () => {
  it("gives length and angle", () => {
    expect(leaderOf(30, 40).length).toBeCloseTo(50);
    expect(leaderOf(10, 0).angle).toBe(0);
    expect(leaderOf(0, 10).angle).toBeCloseTo(90);
  });
});

describe("the content's places", () => {
  const f = { ...frameOf(experience.frame.centre, experience.frame.spanDeg), lonScale: 0.9490631544751487, size: 8192 };

  it("puts Olympus Rupes' label on the cliff trace, not at its Gazetteer centre", () => {
    const rupes = experience.places.find((p) => p.id === "olympus-rupes")!;
    const q = placePoint(rupes, experience.cliff.points, f);
    const onTrace = experience.cliff.points.some((c) => {
      const t = placePoint({ lon: c.lon, lat: c.lat }, [], f);

      return Math.hypot(t.x - q.x, t.y - q.y) < 0.5;
    });
    const centre = placePoint({ lon: rupes.lon, lat: rupes.lat }, [], f);

    expect(onTrace).toBe(true);
    expect(Math.hypot(centre.x - q.x, centre.y - q.y)).toBeGreaterThan(1500); // the centre is on the mountain
  });

  it("gives every place a label offset", () => {
    for (const p of experience.places) expect(p.label, p.id).toBeDefined();
  });
});
