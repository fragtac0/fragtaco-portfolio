import { describe, expect, it } from "vitest";
import { frameOf, toLonLat } from "./geo";
import experience from "../../../content/site/experience.json";
import { hits } from "./journey";
import { bearingOf, cliffPointAt, leaderOf, placeDotBox, placeLabelBox, placePoint } from "./places";

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

  // the overview's scale (screen px per picture px) for a screen: 0.78 of the smaller side over the cliff ring's 0.67 of 8192 px
  const fit = (w: number, h: number) => (0.78 * Math.min(w, h)) / (0.67 * 8192);
  const screens = [
    { name: "1440 x 900", scale: fit(1440, 900), phone: false },
    { name: "1920 x 1080", scale: fit(1920, 1080), phone: false },
    { name: "1024 x 768", scale: fit(1024, 768), phone: false },
    { name: "390 x 844", scale: fit(390, 844), phone: true },
    { name: "360 x 740", scale: fit(360, 740), phone: true },
  ];

  it("keeps every label off every dot (its own and the others') and off every other label, on each screen", () => {
    const spots = experience.places.map((p) => placePoint(p, experience.cliff.points, f));

    for (const { name, scale, phone } of screens) {
      const dots = spots.map((p) => ({ x: p.x * scale, y: p.y * scale }));
      const boxes = experience.places.map((p, i) => placeLabelBox(dots[i], p, phone));

      boxes.forEach((box, i) => {
        dots.forEach((dot, k) => {
          expect(hits(box, placeDotBox(dot)), `${experience.places[i].name}'s label on ${experience.places[k].name}'s dot at ${name}`).toBe(false);
        });
        for (let k = i + 1; k < boxes.length; k++) {
          expect(hits(box, boxes[k]), `${experience.places[i].name}'s label on ${experience.places[k].name}'s at ${name}`).toBe(false);
        }
      });
    }
  });
});

describe("placeLabelBox", () => {
  const place = { name: "Name", line: "x".repeat(60), label: { dx: 40, dy: -20 } };

  it("puts a side label's near edge on the offset, centred up or down; a phone's offset is 0.6 of that", () => {
    const side = placeLabelBox({ x: 100, y: 100 }, place, false);

    expect(side.x0).toBe(140);
    expect((side.y0 + side.y1) / 2).toBe(80);
    const left = placeLabelBox({ x: 100, y: 100 }, { ...place, label: { dx: -40, dy: 0 } }, false);

    expect(left.x1).toBe(60);
    const above = placeLabelBox({ x: 100, y: 100 }, { ...place, label: { dx: 5, dy: -50 } }, false);

    expect(above.y1).toBe(50);
    expect((above.x0 + above.x1) / 2).toBe(105);
    const below = placeLabelBox({ x: 100, y: 100 }, { ...place, label: { dx: 0, dy: 50 } }, false);

    expect(below.y0).toBe(150);
    expect(placeLabelBox({ x: 100, y: 100 }, place, true).x0).toBeCloseTo(124);
  });
});
