import { describe, expect, it } from "vitest";
import type { SiteWork, WorkVideo } from "../../types";
import { coverUrl } from "../../content/work-media";
import { entriesFor } from "./ring-entries";

const video = (id: string): WorkVideo => ({
  id,
  title: id,
  for: "X",
  year: 2026,
  url: "https://example.com",
  source: "other",
});

const WORK: Pick<SiteWork, "stack" | "longForm" | "shortForm"> = {
  stack: [
    { id: "pr", mark: "Pr", label: "Premiere Pro", icon: "/stack/premiere-pro.svg" },
    { id: "xx", mark: "Xx", label: "No icon yet" },
  ],
  longForm: [video("l1"), video("l2")],
  shortForm: [video("s1")],
};

describe("entriesFor", () => {
  it("gives each of the three rings its items in file order, with the right kind", () => {
    const e = entriesFor(WORK);
    expect(e.stack.map((x) => x.kind)).toEqual(["stack", "stack"]);
    expect(e.long.map((x) => x.item.id)).toEqual(["l1", "l2"]);
    expect(e.short.map((x) => x.item.id)).toEqual(["s1"]);
  });

  it("passes a stack item's icon through, or none", () => {
    const [withIcon, without] = entriesFor(WORK).stack;
    expect(withIcon.kind === "stack" && withIcon.item.icon).toBe("/stack/premiere-pro.svg");
    expect(without.kind === "stack" && without.item.icon).toBeUndefined();
  });

  it("marks only short-form videos as tall", () => {
    const e = entriesFor(WORK);
    expect(e.long.every((x) => x.kind === "video" && !x.tall)).toBe(true);
    expect(e.short.every((x) => x.kind === "video" && x.tall)).toBe(true);
  });

  it("gives long form its YouTube picture and short form local art, so no ring needs an image service of its own", () => {
    const work = {
      ...WORK,
      longForm: [{ ...video("l1"), source: "youtube" as const, url: "https://www.youtube.com/watch?v=9hkHhSmcA9s" }],
    };
    const e = entriesFor(work);
    const [long] = e.long;
    const [short] = e.short;
    if (long.kind !== "video" || short.kind !== "video") throw new Error("not videos");
    expect(coverUrl(long.item, long.tall)).toBe("https://i.ytimg.com/vi/9hkHhSmcA9s/hqdefault.jpg");
    expect(coverUrl(short.item, short.tall)).toMatch(/^data:image\/svg\+xml,/);
  });

  it("copes with empty lists", () => {
    const e = entriesFor({ ...WORK, stack: [], longForm: [], shortForm: [] });
    expect(Object.values(e).every((list) => list.length === 0)).toBe(true);
  });
});
