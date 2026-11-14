import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BooksSectionSchema,
  HeroPaintingSchema,
  HeroPaintingsSchema,
  HomeContentSchema,
  VideosFileSchema,
  WorkClientSchema,
  WorkSchema,
  WorkStackItemSchema,
  WorkVideoSchema,
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
  color: "#151312",
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

  it("rejects a non-hex book colour", () => {
    const result = BooksSectionSchema.safeParse({
      items: [{ ...validBook, color: "red" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a book with or without a spine design and rejects an empty name", () => {
    expect("series" in validBook).toBe(false);
    expect(BooksSectionSchema.safeParse({ items: [{ ...validBook, series: "story" }] }).success).toBe(true);
    expect(BooksSectionSchema.safeParse({ items: [{ ...validBook, series: "" }] }).success).toBe(false);
  });

  it("accepts a book without a spine picture and one with a path under public/", () => {
    expect("spine" in validBook).toBe(false);
    for (const spine of ["/books/story-spine.webp", "/books/a_b-1/c.JPG"]) {
      const result = BooksSectionSchema.safeParse({ items: [{ ...validBook, spine }] });
      expect(result.success, spine).toBe(true);
    }
  });

  it("rejects a spine that is not an image path under public/", () => {
    for (const spine of [
      "#151312",
      "books/story.webp",
      "/books/../secret.png",
      "https://example.com/a.png",
      "/books/story.svg",
      "/books/story",
      "",
    ]) {
      const result = BooksSectionSchema.safeParse({ items: [{ ...validBook, spine }] });
      expect(result.success, spine).toBe(false);
    }
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

const validWorkVideo = {
  id: "ft-long-01",
  title: "Placeholder long 01",
  for: "Placeholder",
  year: 2026,
  url: "https://www.youtube.com/@fragtaco",
  // Not a real file: the schema only checks the shape of the path.
  cover: "/work/not-a-real-cover.jpg",
  source: "other",
};

const validWorkClient = {
  id: "ft-client-01",
  name: "Placeholder client 01",
  handle: "@placeholder",
  avatar: "/work/placeholder-avatar.svg",
  url: "https://www.youtube.com/@fragtaco",
  socials: [{ type: "youtube", url: "https://www.youtube.com/@fragtaco" }],
};

describe("WorkStackItemSchema", () => {
  it("accepts a mark of 1 to 3 characters", () => {
    expect(WorkStackItemSchema.safeParse({ id: "a", mark: "Pr", label: "Premiere Pro" }).success).toBe(true);
    expect(WorkStackItemSchema.safeParse({ id: "a", mark: "P", label: "x" }).success).toBe(true);
    expect(WorkStackItemSchema.safeParse({ id: "a", mark: "Pre", label: "x" }).success).toBe(true);
  });

  it("accepts an icon under /stack/ and no icon at all", () => {
    const base = { id: "a", mark: "Pr", label: "Premiere Pro" };

    expect(WorkStackItemSchema.safeParse({ ...base, icon: "/stack/premiere-pro.svg" }).success).toBe(true);
    expect(WorkStackItemSchema.safeParse({ ...base, icon: "/stack/final-cut-pro.png" }).success).toBe(true);
    expect(WorkStackItemSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an icon that is not a file under /stack/", () => {
    const base = { id: "a", mark: "Pr", label: "Premiere Pro" };

    expect(WorkStackItemSchema.safeParse({ ...base, icon: "/other/pr.svg" }).success).toBe(false);
    expect(WorkStackItemSchema.safeParse({ ...base, icon: "stack/pr.svg" }).success).toBe(false);
    expect(WorkStackItemSchema.safeParse({ ...base, icon: "https://example.com/stack/pr.svg" }).success).toBe(false);
    expect(WorkStackItemSchema.safeParse({ ...base, icon: "/stack/../secret.svg" }).success).toBe(false);
    expect(WorkStackItemSchema.safeParse({ ...base, icon: "/stack/pr.exe" }).success).toBe(false);
    expect(WorkStackItemSchema.safeParse({ ...base, icon: "" }).success).toBe(false);
  });

  it("rejects an empty mark and one of 4 characters", () => {
    expect(WorkStackItemSchema.safeParse({ id: "a", mark: "", label: "x" }).success).toBe(false);
    expect(WorkStackItemSchema.safeParse({ id: "a", mark: "Prem", label: "x" }).success).toBe(false);
  });
});

describe("WorkSchema", () => {
  const stack = [{ id: "a", mark: "Pr", label: "Premiere Pro" }];
  const intro = { title: "Work", text: "Short intro." };
  const videos = (kind: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...validWorkVideo, id: `${kind}-${i + 1}` }));

  it("parses 35 long form and 35 short form entries", () => {
    const parsed = WorkSchema.safeParse({ intro, stack, longForm: videos("long", 35), shortForm: videos("short", 35), clients: [] });

    expect(parsed.success).toBe(true);
  });

  it("takes clients as empty or present", () => {
    const base = { intro, stack, longForm: videos("long", 1), shortForm: videos("short", 1) };

    expect(WorkSchema.safeParse({ ...base, clients: [] }).success).toBe(true);
    expect(WorkSchema.safeParse({ ...base, clients: [validWorkClient] }).success).toBe(true);
  });
});

describe("WorkVideoSchema", () => {
  it("accepts a valid video", () => {
    expect(WorkVideoSchema.safeParse(validWorkVideo).success).toBe(true);
  });

  it("requires an https url", () => {
    expect(WorkVideoSchema.safeParse({ ...validWorkVideo, url: "http://example.com/a" }).success).toBe(false);
  });

  it("accepts a root-relative cover and rejects a protocol-relative or http one", () => {
    expect(WorkVideoSchema.safeParse({ ...validWorkVideo, cover: "/work/a.jpg" }).success).toBe(true);
    expect(WorkVideoSchema.safeParse({ ...validWorkVideo, cover: "//cdn.example.com/a.jpg" }).success).toBe(false);
    expect(WorkVideoSchema.safeParse({ ...validWorkVideo, cover: "http://example.com/a.jpg" }).success).toBe(false);
  });

  it("lets a YouTube item omit its cover only when its url holds a video id", () => {
    const { cover: _cover, ...noCover } = validWorkVideo;
    void _cover;

    expect(
      WorkVideoSchema.safeParse({ ...noCover, source: "youtube", url: "https://youtu.be/GrtKxfATyTw" }).success,
    ).toBe(true);
    expect(
      WorkVideoSchema.safeParse({ ...noCover, source: "youtube", url: "https://www.youtube.com/@fragtaco" }).success,
    ).toBe(false);
    expect(
      WorkVideoSchema.safeParse({ ...noCover, source: "instagram", url: "https://www.instagram.com/reel/abc/" }).success,
    ).toBe(true);
  });

  it("rejects an unknown source", () => {
    expect(WorkVideoSchema.safeParse({ ...validWorkVideo, source: "tiktok" }).success).toBe(false);
  });
});

describe("WorkClientSchema", () => {
  it("accepts a valid client and rejects an avatar that is neither a path nor https", () => {
    expect(WorkClientSchema.safeParse(validWorkClient).success).toBe(true);
    expect(WorkClientSchema.safeParse({ ...validWorkClient, avatar: "avatar.png" }).success).toBe(false);
  });

  it("rejects an unknown social type", () => {
    expect(
      WorkClientSchema.safeParse({ ...validWorkClient, socials: [{ type: "tiktok", url: "https://x.com/a" }] }).success,
    ).toBe(false);
  });
});

describe("WorkSchema", () => {
  const base = {
    intro: { title: "Work", text: "Short text." },
    stack: [{ id: "a", mark: "Pr", label: "Premiere Pro" }],
    longForm: [validWorkVideo],
    shortForm: [],
    clients: [validWorkClient],
  };

  it("accepts a minimal valid file", () => {
    expect(WorkSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an intro of 21 words", () => {
    const text = Array.from({ length: 21 }, (_, i) => `w${i}`).join(" ");

    expect(WorkSchema.safeParse({ ...base, intro: { title: "Work", text } }).success).toBe(false);
  });

  it("rejects a repeated id within one list", () => {
    expect(WorkSchema.safeParse({ ...base, longForm: [validWorkVideo, validWorkVideo] }).success).toBe(false);
    expect(WorkSchema.safeParse({ ...base, clients: [validWorkClient, validWorkClient] }).success).toBe(false);
    expect(
      WorkSchema.safeParse({ ...base, stack: [base.stack[0], base.stack[0]] }).success,
    ).toBe(false);
  });
});
