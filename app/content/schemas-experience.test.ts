import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ManifestSchema, extentRadius, fractionDistance, frameOf, meanRadius, pointInRing } from "../components/experience/geo";
import { CLIFF_SPAN } from "../components/experience/view";
import type { SiteExperience } from "../types";
import { ExperienceSchema } from "./schemas";

const readJson = (...parts: string[]): unknown => JSON.parse(readFileSync(path.join(process.cwd(), ...parts), "utf8"));

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
};

const raw = readJson("content", "site", "experience.json");
const page = ExperienceSchema.parse(raw);
const frame = frameOf(page.frame.centre, page.frame.spanDeg);
const clone = (): SiteExperience => structuredClone(page);

const fails = (data: unknown, message?: string) => {
  const result = ExperienceSchema.safeParse(data);

  expect(result.success).toBe(false);
  if (message !== undefined && !result.success) expect(result.error.issues.map((i) => i.message)).toContain(message);
};

describe("experience.json", () => {
  it("holds the words of spec 9.4", () => {
    expect(page.heading.title).toBe("My experience");
    expect(page.heading.text).toBe(
      "I trained as an engineer in Mumbai, took a part-time editing job in 2021 and never went back. Five years at Bharat in Germany took me from cutting shorts to running content and producing. Since December 2025 I edit full time as a freelancer. Still climbing.",
    );
    expect(page.moments.map((m) => [m.label, m.title, m.line])).toEqual([
      ["2017", "IIT Engineering at VESIT, Mumbai", "Plan A did not happen. Plan B was four years of engineering."],
      ["Feb 2021", "First editing job", "Part-time short form editor at Bharat in Germany, while finishing the degree."],
      ["Jun 2021", "Graduated, went full time", "The degree was done. Editing became the job."],
      ["Jan 2022", "Social media manager", "From cutting the videos to running the channels they went out on."],
      ["Sep 2022", "Started making my own", "YouTube videos and Reels, from the idea to the upload."],
      ["Jan 2023", "Head of Content and Producer", "Responsible for what got made and how."],
      ["Jun 2024", "Interview at the German Embassy", "Interviewed the embassy's spokesperson, at the embassy."],
      ["Dec 2025", "Went freelance", "Left Bharat in Germany to edit full time for myself."],
      ["Now", "Freelance creative editor", "Still climbing."],
    ]);
    expect(page.caption.title).toBe("Olympus Mons, Mars");
    expect(page.caption.line).toBe("The tallest mountain known in the solar system.");
    expect(page.caption.credit).toBe("Image: NASA / JPL-Caltech / USGS / Arizona State University");
  });

  it("strikes through IIT in the first title only", () => {
    expect(page.moments.map((m) => m.struck)).toEqual(["IIT", ...Array<undefined>(8).fill(undefined)]);
  });

  it("has no em or en dash in any string", () => {
    expect(collectStrings(raw).filter((s) => /[\u2013\u2014]/.test(s))).toEqual([]);
  });

  it("uses the same frame as the tiles' manifest", () => {
    const manifest = ManifestSchema.parse(readJson("public", "mars", "manifest.json"));

    expect(page.frame.centre).toEqual(manifest.centre);
    expect(page.frame.spanDeg).toBe(manifest.spanDeg);
  });

  it("has at most 8 places, each inside the frame with a source", () => {
    expect(page.places.length).toBeGreaterThan(0);
    expect(page.places.length).toBeLessThanOrEqual(8);
    for (const place of page.places) expect(place.sources.length).toBeGreaterThan(0);
  });

  it("gives every fact a source", () => {
    for (const fact of page.facts) expect(fact.source).toMatch(/^https:\/\//);
  });

  it("starts outside the cliff, crosses it and stops short of the summit", () => {
    expect(pointInRing(page.route[0], page.cliff.points, frame)).toBe(false);
    expect(page.route.slice(1).some((p) => pointInRing(p, page.cliff.points, frame))).toBe(true);

    const cliff = meanRadius(page.cliff.points, frame);
    const rim = extentRadius(page.rim, frame);
    const last = fractionDistance(page.route[page.route.length - 1], frame.centre, frame);
    const progress = (cliff - last) / (cliff - rim); // 0 at the cliff, 1 at the rim

    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThanOrEqual(0.6);
  });

  it("agrees with the overview's cliff size", () => {
    expect(2 * meanRadius(page.cliff.points, frame)).toBeCloseTo(CLIFF_SPAN, 2);
  });
});

describe("ExperienceSchema", () => {
  it("accepts the file", () => {
    expect(ExperienceSchema.safeParse(raw).success).toBe(true);
  });

  it("needs moments in ascending date order and now only at the end", () => {
    const swapped = clone();
    [swapped.moments[1], swapped.moments[2]] = [swapped.moments[2], swapped.moments[1]];
    fails(swapped, "Moments must be in ascending date order");

    const early = clone();
    early.moments[3].date = "now";
    fails(early, "Only the last moment can be now");
  });

  it("accepts equal dates and real partial dates only", () => {
    const equal = clone();
    equal.moments[2].date = "2021-02";
    expect(ExperienceSchema.safeParse(equal).success).toBe(true);

    const bad = clone();
    bad.moments[1].date = "2021-13";
    fails(bad);
    bad.moments[1].date = "Feb 2021";
    fails(bad);
  });

  it("needs the struck part to be in the title and ids to be unique", () => {
    const struck = clone();
    struck.moments[0].struck = "MIT";
    fails(struck, "The struck part must be in the title");

    const dup = clone();
    dup.moments[1].id = dup.moments[0].id;
    fails(dup, "Ids must be unique within the list");
  });

  it("needs every place inside the frame, with a source, and at most 8", () => {
    const outside = clone();
    outside.places[0].lon = 215.53; // Lycus Sulci's longitude: west of the frame
    outside.places[0].lat = 28.14;
    fails(outside, "A place must be inside the frame");

    const unsourced = clone();
    unsourced.places[0].sources = [];
    fails(unsourced);

    const many = clone();
    many.places = [...many.places, { ...many.places[0], id: "extra" }];
    fails(many);
  });

  it("needs every fact to have a source and the caption's fact to exist", () => {
    const unsourced = clone();
    unsourced.facts[0].source = "";
    fails(unsourced);

    const insecure = clone();
    insecure.facts[0].source = "http://example.com/";
    fails(insecure);

    const missing = clone();
    missing.caption.factId = "no-such-fact";
    fails(missing, "The caption's fact must be one of the facts");
  });

  it("needs a route that starts outside the cliff", () => {
    const inside = clone();
    inside.route[0] = { lon: 226.8, lat: 18.4 };
    fails(inside, "The route must start outside the cliff");
  });

  it("needs a route that crosses the cliff", () => {
    const short = clone();
    short.route = short.route.slice(0, 3);
    fails(short, "The route must cross the cliff");
  });

  it("needs a route that stops short of the summit", () => {
    const far = clone();
    far.route[far.route.length - 1] = { lon: 226.7, lat: 18.3 }; // next to the summit
    fails(far, "The route must stop at 60% of the way from the cliff to the rim at most");
  });

  it("needs a route that stays inside the frame", () => {
    const off = clone();
    off.route[0] = { lon: 200, lat: 5 };
    fails(off, "A route point must be inside the frame");
  });

  it("rejects an em or en dash in any string", () => {
    for (const dash of ["\u2014", "\u2013"]) {
      const dashed = clone();
      dashed.moments[1].line = `First${dash}job`;
      fails(dashed, "No em or en dash");
    }
    const deep = clone();
    deep.places[0].line = "A \u2014 B";
    fails(deep, "No em or en dash");
  });
});
