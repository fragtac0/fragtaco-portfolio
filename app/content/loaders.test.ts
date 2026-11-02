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
