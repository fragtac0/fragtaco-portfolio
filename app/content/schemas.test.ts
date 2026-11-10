import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BooksSectionSchema,
  HeroPaintingSchema,
  HeroPaintingsSchema,
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

  it("accepts a null subscriber count and a count like 1.01M", () => {
    const result = VideosFileSchema.safeParse({
      ...file,
      items: [
        { ...validVideo, subscribers: null },
        { ...validVideo, subscribers: "1.01M" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a subscriber count that is not a number", () => {
    const result = VideosFileSchema.safeParse({
      ...file,
      items: [{ ...validVideo, subscribers: "lots" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a video id of the wrong length", () => {
    const result = VideosFileSchema.safeParse({
      ...file,
      items: [{ ...validVideo, id: "short" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("hero-paintings.json", () => {
  const parsed = HeroPaintingsSchema.parse(readSiteJson("hero-paintings.json"));
  const loaded = parsed.items.filter((item) => !item.missing);

  it("holds 22 available paintings", () => {
    expect(loaded).toHaveLength(22);
  });

  it("gives every loaded painting a small blurred placeholder", () => {
    for (const item of loaded) {
      expect(item.blur, item.id).toBeDefined();
      expect(item.blur!.startsWith("data:image/jpeg;base64,"), item.id).toBe(true);
      expect(item.blur!.length, item.id).toBeLessThan(2500);
    }
  });
});

describe("HeroPaintingSchema blur", () => {
  const base = {
    id: "a",
    file: "a.jpg",
    title: "A",
    artist: "B",
    year: 1800,
    focal: "50% 50%",
  };

  it("accepts a small data image", () => {
    expect(() =>
      HeroPaintingSchema.parse({ ...base, blur: "data:image/jpeg;base64,AAAA" }),
    ).not.toThrow();
  });

  it("rejects a blur that is not a data image", () => {
    expect(() =>
      HeroPaintingSchema.parse({ ...base, blur: "https://example.com/a.jpg" }),
    ).toThrow();
  });

  it("rejects a blur of 2,500 characters or more", () => {
    const blur = `data:image/jpeg;base64,${"A".repeat(2500)}`;
    expect(() => HeroPaintingSchema.parse({ ...base, blur })).toThrow();
  });

  it("requires a blur on a painting that is not missing", () => {
    expect(() => HeroPaintingSchema.parse(base)).toThrow();
    expect(() => HeroPaintingSchema.parse({ ...base, missing: true })).not.toThrow();
  });
});
