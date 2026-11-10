import { describe, expect, it } from "vitest";
import { getHomePageContent } from "./loaders.server";
import { getBooks, getVideos } from "./site-content.server";

describe("getHomePageContent", () => {
  it("returns the books, videos and paintings the home page needs", async () => {
    const content = await getHomePageContent();

    expect(content.books).toHaveLength(14);
    expect(content.videos.length).toBeGreaterThanOrEqual(40);
    expect(content.heroPaintings.length).toBeGreaterThanOrEqual(20);
  });

  it("picks the first painting on the server, from the paintings that are available", async () => {
    const content = await getHomePageContent();
    const ids = content.heroPaintings.map((p) => p.id);

    expect(ids).toContain(content.firstPaintingId);
  });

  it("uses the random number it is given for that pick", async () => {
    const first = await getHomePageContent(() => 0);
    const last = await getHomePageContent(() => 0.999999);

    expect(first.firstPaintingId).toBe(first.heroPaintings[0].id);
    expect(last.firstPaintingId).toBe(last.heroPaintings[last.heroPaintings.length - 1].id);
  });

  it("sends the blurred placeholder for the first painting only", async () => {
    const content = await getHomePageContent(() => 0.5);
    const withBlur = content.heroPaintings.filter((p) => p.blur !== "");

    expect(withBlur.map((p) => p.id)).toEqual([content.firstPaintingId]);
    expect(withBlur[0].blur.startsWith("data:image/")).toBe(true);
  });

  it("does not return the facts section", async () => {
    const content = await getHomePageContent();

    expect(content).not.toHaveProperty("facts");
  });
});

describe("site content loaders", () => {
  it("getBooks returns unique books", async () => {
    const books = await getBooks();

    expect(books).toHaveLength(14);
    expect(new Set(books.map((book) => book.id)).size).toBe(books.length);
  });

  it("getVideos returns the whole videos file", async () => {
    const file = await getVideos();

    expect(file.playlistId).toBeTruthy();
    expect(file.items.length).toBeGreaterThanOrEqual(40);
  });
});
