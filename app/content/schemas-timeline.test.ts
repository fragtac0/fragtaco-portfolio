import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TimelineSchema } from "./schemas";

const readSiteJson = (fileName: string): unknown =>
  JSON.parse(readFileSync(path.join(process.cwd(), "content", "site", fileName), "utf8"));

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
};

describe("timeline.json", () => {
  const timeline = TimelineSchema.parse(readSiteJson("timeline.json"));

  it("starts on 2020-12-01 with the six roles in order", () => {
    expect(timeline.start).toBe("2020-12-01");
    expect(timeline.roles.map((r) => r.id)).toEqual(["student", "editor", "social", "creator", "head", "freelance"]);
    expect(timeline.roles[0].from).toBe(timeline.start);
    expect(timeline.marks).toEqual([]);
  });

  it("has no em or en dash in any string", () => {
    const dashes = collectStrings(readSiteJson("timeline.json")).filter((s) => /[–—]/.test(s));

    expect(dashes).toEqual([]);
  });
});

describe("TimelineSchema", () => {
  const roles = [
    { id: "a", label: "A", from: "2020-12-01", color: "#3E8A7C" },
    { id: "b", label: "B", from: "2021-06-01", color: "#D9A441" },
  ];
  const base = { start: "2020-12-01", roles, marks: [] };

  it("accepts a valid file and marks", () => {
    expect(TimelineSchema.safeParse(base).success).toBe(true);
    expect(TimelineSchema.safeParse({ ...base, marks: [{ date: "2024-02-29", label: "Leap day" }] }).success).toBe(true);
  });

  it("rejects a date that is not a real ISO date", () => {
    expect(TimelineSchema.safeParse({ ...base, start: "2020-12-1" }).success).toBe(false);
    expect(
      TimelineSchema.safeParse({ ...base, roles: [roles[0], { ...roles[1], from: "2021-02-30" }] }).success,
    ).toBe(false);
  });

  it("rejects roles that are not strictly ascending", () => {
    expect(TimelineSchema.safeParse({ ...base, roles: [roles[0], roles[0]] }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...base, roles: [roles[1], roles[0]] }).success).toBe(false);
  });

  it("rejects a first role that does not start on the start date", () => {
    expect(TimelineSchema.safeParse({ ...base, start: "2020-11-01" }).success).toBe(false);
  });

  it("rejects no roles, a repeated id and a colour that is not a hex code", () => {
    expect(TimelineSchema.safeParse({ ...base, roles: [] }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...base, roles: [roles[0], { ...roles[1], id: "a" }] }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...base, roles: [{ ...roles[0], color: "red" }] }).success).toBe(false);
  });

  it("rejects a mark with no label, a bad date or a date before the start", () => {
    expect(TimelineSchema.safeParse({ ...base, marks: [{ date: "2024-02-29", label: "" }] }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...base, marks: [{ date: "2024-13-01", label: "x" }] }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...base, marks: [{ date: "2020-11-30", label: "x" }] }).success).toBe(false);
  });
});
