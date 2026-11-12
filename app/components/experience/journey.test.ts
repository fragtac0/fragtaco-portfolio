import { describe, expect, it } from "vitest";
import { frameOf } from "./geo";
import experience from "../../../content/site/experience.json";
import { buildJourney, chooseSides, dotBox, hits, labelBox, LABEL_SCALE, placementFor, stepMoment, yearOf, type Placement } from "./journey";

const frame = { ...frameOf({ lon: 226.795, lat: 18.366 }, 14), size: 8192 };
const route = [
  { lon: 232.0, lat: 18.2 },
  { lon: 230.0, lat: 18.1 },
  { lon: 228.0, lat: 15.5 },
  { lon: 225.5, lat: 16.1 },
];
const moments = [
  { id: "a", date: "2017", label: "2017" },
  { id: "b", date: "2021-02", label: "Feb 2021" },
  { id: "c", date: "2021-06", label: "Jun 2021" },
  { id: "d", date: "2022-01", label: "Jan 2022" },
  { id: "now", date: "now", label: "Now" },
];

describe("buildJourney", () => {
  const j = buildJourney(route, moments, "2026-11-12", frame);

  it("puts every moment on the line, in order, from the start to the end", () => {
    expect(j.moments).toHaveLength(5);
    expect(j.moments[0].s).toBe(0);
    expect(j.moments[4].s).toBe(1);
    for (let i = 1; i < 5; i++) expect(j.moments[i].s).toBeGreaterThanOrEqual(j.moments[i - 1].s);
    expect(j.moments[4].x).toBeCloseTo(j.end.x, 6);
    expect(j.moments[4].y).toBeCloseTo(j.end.y, 6);
    expect(j.length).toBeGreaterThan(0);
    expect(j.d.startsWith("M")).toBe(true);
  });

  it("gives the year, and the moment's own label for now", () => {
    expect(j.moments.map((m) => m.year)).toEqual(["2017", "2021", "2021", "2022", "Now"]);
    expect(yearOf({ id: "x", date: "2024-06-10", label: "x" })).toBe("2024");
  });

  it("sits no year's pill on another pill or on any dot, at the scale it is fitted for, when the moments are spread along the line", () => {
    const spread = [
      { id: "a", date: "2017", label: "2017" },
      { id: "b", date: "2019-06", label: "Jun 2019" },
      { id: "c", date: "2022-01", label: "Jan 2022" },
      { id: "d", date: "2024-06", label: "Jun 2024" },
      { id: "now", date: "now", label: "Now" },
    ];
    const sj = buildJourney(route, spread, "2026-11-12", frame);
    const boxes = sj.moments.map((m) => labelBox(m, m.placement, m.year, LABEL_SCALE));

    boxes.forEach((a, i) => {
      sj.moments.forEach((m, k) => {
        if (k !== i) expect(hits(a, dotBox(m, LABEL_SCALE)), `pill ${i} on dot ${k}`).toBe(false);
        if (k > i) expect(hits(a, boxes[k]), `pill ${i} on pill ${k}`).toBe(false);
      });
    });
  });
});

describe("chooseSides", () => {
  const years = ["2021", "2021", "2021"];

  it("keeps the preferred side of a moment that has room", () => {
    const far = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 0, y: 2000 }];

    expect(chooseSides(far, ["n", "e", "w"], years)).toEqual(["n", "e", "w"]);
  });

  it("moves a pill off the side where it would sit on another moment's dot", () => {
    // at LABEL_SCALE, 300 px of picture is about 14 screen px: B's dot is where A's pill would go
    const pair = [{ x: 0, y: 0 }, { x: 0, y: -250 }];
    const sides = chooseSides(pair, ["n", "s"], ["2021", "2022"]);

    expect(sides[0]).not.toBe("n");
  });

  it("gives back the preferred sides when no choice clears everything", () => {
    // ten moments on one spot: at most a few pills fit round a dot
    const crowd = Array.from({ length: 10 }, () => ({ x: 100, y: 100 }));
    const preferred: Placement[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw", "n", "s"];

    expect(chooseSides(crowd, preferred, crowd.map(() => "2021"))).toEqual(preferred);
  });
});

describe("placementFor", () => {
  it("uses above and below for a line that runs across, left and right for one that runs up", () => {
    expect(placementFor(0, { x: 5, y: 1 })).toBe("n");
    expect(placementFor(1, { x: -5, y: 1 })).toBe("s");
    expect(placementFor(0, { x: 1, y: 5 })).toBe("e");
    expect(placementFor(1, { x: 1, y: -5 })).toBe("w");
  });
});

describe("stepMoment", () => {
  it("goes to the next and previous moment and stops at the ends", () => {
    expect(stepMoment(null, 1, 9)).toBe(0);
    expect(stepMoment(null, -1, 9)).toBe(8);
    expect(stepMoment(3, 1, 9)).toBe(4);
    expect(stepMoment(3, -1, 9)).toBe(2);
    expect(stepMoment(8, 1, 9)).toBe(8);
    expect(stepMoment(0, -1, 9)).toBe(0);
    expect(stepMoment(null, 1, 0)).toBe(0);
  });
});

describe("the real route's year labels", () => {
  const j = buildJourney(experience.route, experience.moments, "2026-11-12", { ...frameOf(experience.frame.centre, experience.frame.spanDeg), lonScale: 0.9490631544751487, size: 8192 });

  it("sit on no other label and no dot at a phone's overview or a laptop's", () => {
    for (const scale of [LABEL_SCALE, 0.0554, 0.1279]) {
      const boxes = j.moments.map((m) => labelBox(m, m.placement, m.year, scale));

      boxes.forEach((a, i) => {
        j.moments.forEach((m, k) => {
          if (k !== i) expect(hits(a, dotBox(m, scale)), `label ${i} on dot ${k} at ${scale}`).toBe(false);
          if (k > i) expect(hits(a, boxes[k]), `label ${i} on label ${k} at ${scale}`).toBe(false);
        });
      });
    }
  });

  it("has all nine moments and the last at the end of the line", () => {
    expect(j.moments).toHaveLength(9);
    expect(j.moments[8].s).toBe(1);
  });
});
