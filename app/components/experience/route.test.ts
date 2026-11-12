import { describe, expect, it } from "vitest";
import { frameOf, toPixel, type LonLat } from "./geo";
import { ROUTE_STOP_SHARE, SAME_DATE_GAP, momentPositions, routeCurve, routeStopRadius } from "./route";

const m = { ...frameOf({ lon: 226.795, lat: 18.366 }, 14), size: 8192 };
const points: LonLat[] = [
  { lon: 222, lat: 15 },
  { lon: 224, lat: 15.5 },
  { lon: 225.5, lat: 16.5 },
  { lon: 226, lat: 17.4 },
];
const px = points.map((p) => toPixel(p.lon, p.lat, m));
const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 5);
  expect(a.y).toBeCloseTo(b.y, 5);
};

describe("routeCurve", () => {
  const curve = routeCurve(points, m);

  it("starts and ends on the first and last points and passes through the others", () => {
    near(curve.at(0), px[0]);
    near(curve.at(1), px[px.length - 1]);

    // every point in between is within a pixel of the curve
    let nearest = 0;
    for (const p of px.slice(1, -1)) {
      let best = Infinity;
      for (let s = 0; s <= 1; s += 0.0005) best = Math.min(best, Math.hypot(curve.at(s).x - p.x, curve.at(s).y - p.y));
      nearest = Math.max(nearest, best);
    }
    expect(nearest).toBeLessThan(1);
  });

  it("writes an SVG path of one move and one cubic per piece, in picture pixels", () => {
    expect(curve.d).toMatch(/^M[\d.]+ [\d.]+( C[\d. -]+){3}$/);
    expect(curve.d.match(/C/g)).toHaveLength(points.length - 1);
    expect(curve.d.startsWith(`M${Math.round(px[0].x * 100) / 100} ${Math.round(px[0].y * 100) / 100}`)).toBe(true);
  });

  it("is longer than the chord and close to the length of the lines between the points", () => {
    const chord = Math.hypot(px[3].x - px[0].x, px[3].y - px[0].y);
    const polyline = px.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - px[i].x, p.y - px[i].y), 0);

    expect(curve.length).toBeGreaterThan(chord);
    expect(curve.length).toBeGreaterThanOrEqual(polyline * 0.99);
    expect(curve.length).toBeLessThan(polyline * 1.2);
  });

  it("moves along by length: equal steps in s are equal distances", () => {
    const step = (a: number, b: number) => Math.hypot(curve.at(b).x - curve.at(a).x, curve.at(b).y - curve.at(a).y);

    expect(step(0.2, 0.3)).toBeCloseTo(step(0.6, 0.7), -1);
    expect(step(0, 0.5) + step(0.5, 1)).toBeLessThanOrEqual(curve.length + 1);
  });

  it("clamps s to 0 to 1", () => {
    near(curve.at(-3), curve.at(0));
    near(curve.at(7), curve.at(1));
  });

  it("is a straight line for two points", () => {
    const line = routeCurve(points.slice(0, 2), m);
    const mid = line.at(0.5);

    near(mid, { x: (px[0].x + px[1].x) / 2, y: (px[0].y + px[1].y) / 2 });
    expect(line.length).toBeCloseTo(Math.hypot(px[1].x - px[0].x, px[1].y - px[0].y), 3);
  });

  it("copes with no points and one point", () => {
    expect(routeCurve([], m)).toMatchObject({ d: "", length: 0 });
    const one = routeCurve([points[0]], m);

    expect(one.length).toBe(0);
    near(one.at(0.5), px[0]);
  });
});

describe("routeStopRadius", () => {
  it("is 60% of the way from the cliff to the rim", () => {
    expect(ROUTE_STOP_SHARE).toBe(0.6);
    expect(routeStopRadius(0.34, 0.04)).toBeCloseTo(0.04 + 0.4 * 0.3, 12);
    expect(routeStopRadius(0.34, 0.04)).toBeGreaterThan(0.04);
    expect(routeStopRadius(0.34, 0.04)).toBeLessThan(0.34);
  });
});

describe("momentPositions", () => {
  const moments = ["2017", "2021-02", "2021-06", "2022-01", "2022-09", "2023-01", "2024-06", "2025-12", "now"].map((date) => ({ date }));
  const today = "2026-11-12";
  const pos = momentPositions(moments, today);

  it("puts 2017 at 0, February 2021 at the end of the approach and now at 1", () => {
    expect(pos[0]).toBe(0);
    expect(pos[1]).toBeCloseTo(0.14, 12);
    expect(pos[pos.length - 1]).toBeCloseTo(1, 12);
  });

  it("follows time from February 2021 to today", () => {
    const day = (d: string) => Date.parse(d) / 86_400_000;
    const span = day(today) - day("2021-02-01");

    // Jun 2021
    expect(pos[2]).toBeCloseTo(0.14 + 0.86 * ((day("2021-06-01") - day("2021-02-01")) / span), 9);
    // Dec 2025
    expect(pos[7]).toBeCloseTo(0.14 + 0.86 * ((day("2025-12-01") - day("2021-02-01")) / span), 9);
  });

  it("never decreases and stays within 0 to 1", () => {
    for (let i = 1; i < pos.length; i++) expect(pos[i]).toBeGreaterThanOrEqual(pos[i - 1]);
    for (const p of pos) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("takes the approach end as an argument", () => {
    const p = momentPositions(moments, today, 0.3);

    expect(p[1]).toBeCloseTo(0.3, 12);
    expect(p[8]).toBeCloseTo(1, 12);
  });

  it("puts equal dates 0.012 apart", () => {
    const p = momentPositions([{ date: "2017" }, { date: "2021-02" }, { date: "2021-02" }, { date: "2021-02" }, { date: "2023-01" }], today);

    expect(SAME_DATE_GAP).toBe(0.012);
    expect(p[2] - p[1]).toBeCloseTo(0.012, 12);
    expect(p[3] - p[2]).toBeCloseTo(0.012, 12);
    expect(p[4]).toBeGreaterThan(p[3]);
  });

  it("does not use the clock: the same input gives the same answer, and today moves now", () => {
    expect(momentPositions(moments, today)).toEqual(pos);
    // the same moments with a later today squeeze the earlier ones towards the start
    expect(momentPositions(moments, "2030-01-01")[7]).toBeLessThan(pos[7]);
  });

  it("copes with no moments, one moment, a moment dated today and a stray earlier date", () => {
    expect(momentPositions([], today)).toEqual([]);
    expect(momentPositions([{ date: "2017" }], today)).toEqual([0]);

    const same = momentPositions([{ date: "2017" }, { date: "2021-02" }, { date: today }], today);
    expect(same[2]).toBeCloseTo(1, 12);

    const stray = momentPositions([{ date: "2017" }, { date: "2022-01" }, { date: "2021-06" }], today);
    expect(stray[2]).toBeGreaterThanOrEqual(stray[1]);
  });

  it("accepts a full ISO day", () => {
    const p = momentPositions([{ date: "2017" }, { date: "2021-02-15" }, { date: "now" }], "2026-02-15");

    expect(p[1]).toBeCloseTo(0.14, 12);
    expect(p[2]).toBeCloseTo(1, 12);
  });
});
