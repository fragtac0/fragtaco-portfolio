import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BooksSectionSchema,
  HomeContentSchema,
  VideosFileSchema,
} from "./schemas";

const readSiteJson = (fileName: string): unknown =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), "content", "site", fileName), "utf8"),
  );

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
};

const validBook = {
  id: "story",
  title: "Story",
  author: "Robert McKee",
  pages: 466,
  isbn: "9780060391683",
  heightIn: 9.5,
  aspect: 0.66,
  spine: "#151312",
  style: "band",
  note: "Placeholder for one or two lines on why this book stays with you.",
};

const validVideo = {
  id: "GrtKxfATyTw",
  title: "t",
  channel: "c",
  channelUrl: "https://www.youtube.com/@c",
  subscribers: "158K",
  thumb: "sd",
};

describe("books.json", () => {
  const books = BooksSectionSchema.parse(readSiteJson("books.json"));

  it("holds 14 books", () => {
    expect(books.items).toHaveLength(14);
  });

  it("has unique ids", () => {
    const ids = books.items.map((book) => book.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("home.json", () => {
  const raw = readSiteJson("home.json");

  it("parses with HomeContentSchema", () => {
    expect(() => HomeContentSchema.parse(raw)).not.toThrow();
  });

  it("carries the new hero roles and four intro paragraphs", () => {
    const home = HomeContentSchema.parse(raw);
    expect(home.hero.roles).toBe("Creative Editor - Side Quests Maxxer");
    expect(home.about.paragraphs).toHaveLength(4);
  });

  it("contains no em dash anywhere", () => {
    expect(collectStrings(raw).filter((s) => s.includes("—"))).toEqual([]);
  });
});

describe("BooksSectionSchema", () => {
  it("accepts a valid book", () => {
    expect(BooksSectionSchema.safeParse({ items: [validBook] }).success).toBe(
      true,
    );
  });

  it("rejects a non-hex spine colour", () => {
    const result = BooksSectionSchema.safeParse({
      items: [{ ...validBook, spine: "red" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an ISBN that is not 13 digits", () => {
    const result = BooksSectionSchema.safeParse({
      items: [{ ...validBook, isbn: "123" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("VideosFileSchema", () => {
  const file = {
    playlistId: "PLV4vaojDpwnw",
    syncedAt: "2026-11-02T00:00:00.000Z",
    items: [validVideo],
  };

  it("accepts a valid videos file", () => {
    expect(VideosFileSchema.safeParse(file).success).toBe(true);
  });

  it("rejects a video id of the wrong length", () => {
    const result = VideosFileSchema.safeParse({
      ...file,
      items: [{ ...validVideo, id: "short" }],
    });
    expect(result.success).toBe(false);
  });
});
