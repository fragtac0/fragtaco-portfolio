import { describe, expect, it } from "vitest";
import type { SiteWork, WorkVideo } from "../../types";
import { entriesFor } from "./ring-entries";

const video = (id: string): WorkVideo => ({
  id,
  title: id,
  for: "X",
  year: 2026,
  url: "https://example.com",
  source: "other",
});

const WORK: SiteWork = {
  intro: { title: "Work", text: "Text" },
  stack: [{ id: "pr", mark: "Pr", label: "Premiere Pro" }],
  longForm: [video("l1"), video("l2")],
  shortForm: [video("s1")],
  clients: [{ id: "c1", name: "C", handle: "@c", avatar: "https://example.com/a.jpg", url: "https://example.com", socials: [] }],
};

describe("entriesFor", () => {
  it("gives each ring its items in file order, with the right kind", () => {
    const e = entriesFor(WORK);
    expect(e.stack.map((x) => x.kind)).toEqual(["stack"]);
    expect(e.long.map((x) => x.item.id)).toEqual(["l1", "l2"]);
    expect(e.short.map((x) => x.item.id)).toEqual(["s1"]);
    expect(e.clients.map((x) => x.kind)).toEqual(["client"]);
  });

  it("marks only short-form videos as tall", () => {
    const e = entriesFor(WORK);
    expect(e.long.every((x) => x.kind === "video" && !x.tall)).toBe(true);
    expect(e.short.every((x) => x.kind === "video" && x.tall)).toBe(true);
  });

  it("copes with empty lists", () => {
    const e = entriesFor({ ...WORK, stack: [], longForm: [], shortForm: [], clients: [] });
    expect(Object.values(e).every((list) => list.length === 0)).toBe(true);
  });
});
