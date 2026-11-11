import { describe, expect, it } from "vitest";
import type { SiteBook } from "../../../types";
import { fitMiniShelf, miniShelfScale, inkOn, miniSpine, miniThumbUrl, miniWallColumns } from "./mini-previews";

const book = (over: Partial<SiteBook>): SiteBook => ({
  id: "b",
  title: "T",
  author: "A",
  pages: 300,
  isbn: "0",
  heightIn: 9,
  aspect: 0.65,
  spine: "#7a2b1e",
  style: "plain",
  note: "",
  ...over,
});

describe("inkOn", () => {
  it("picks dark ink on a light spine and light ink on a dark one", () => {
    expect(inkOn("#f0e6d0")).toBe("#17120d");
    expect(inkOn("#1b1b1b")).toBe("#f6f0e2");
  });
  it("switches at luminance 0.56", () => {
    // 0.299 r + 0.587 g + 0.114 b over 255: mid grey (#8f8f8f = 143) is 0.561
    expect(inkOn("#8f8f8f")).toBe("#17120d");
    expect(inkOn("#8e8e8e")).toBe("#f6f0e2");
  });
});

describe("miniSpine", () => {
  it("sizes the spine from pages and height", () => {
    const s = miniSpine(book({ pages: 400, heightIn: 9 }));
    expect(s.width).toBe(Math.round(14 + 400 * 0.055));
    expect(s.width).toBe(36);
    expect(s.height).toBe(189);
  });
  it("carries the spine colour, its ink and the band flag", () => {
    const s = miniSpine(book({ spine: "#101010", style: "band" }));
    expect(s.background).toBe("#101010");
    expect(s.ink).toBe("#f6f0e2");
    expect(s.band).toBe(true);
    expect(miniSpine(book({ style: "block" })).band).toBe(false);
  });
});

describe("miniWallColumns", () => {
  const videos = Array.from({ length: 51 }, (_, i) => ({ id: "v" + i }));
  it("makes 7 columns of 5, picking (c * 5 + r * 3) mod length", () => {
    const cols = miniWallColumns(videos);
    expect(cols).toHaveLength(7);
    for (const c of cols) expect(c).toHaveLength(5);
    expect(cols[0]).toEqual(["v0", "v3", "v6", "v9", "v12"]);
    expect(cols[1]).toEqual(["v5", "v8", "v11", "v14", "v17"]);
  });
  it("wraps round a short list", () => {
    const cols = miniWallColumns([{ id: "a" }, { id: "b" }], 2, 3);
    expect(cols).toEqual([
      ["a", "b", "a"],
      ["b", "a", "b"],
    ]);
  });
  it("returns nothing for no videos", () => {
    expect(miniWallColumns([])).toEqual([]);
  });
});

describe("miniThumbUrl", () => {
  it("uses the small thumbnail", () => {
    expect(miniThumbUrl("abc")).toBe("https://i.ytimg.com/vi/abc/mqdefault.jpg");
  });
});

describe("fitMiniShelf", () => {
  const spines = [{ w: 20 }, { w: 30 }];
  it("caps the scale at 1.6", () => {
    expect(fitMiniShelf(spines, 200, 3)).toBe(1.6);
  });
  it("scales the row (spines plus gaps) to the inner width", () => {
    expect(fitMiniShelf(spines, 60, 3)).toBeCloseTo(60 / 53, 10);
  });
  it("shrinks a row that is wider than the space", () => {
    expect(fitMiniShelf(spines, 26.5, 3)).toBeCloseTo(0.5, 10);
  });
  it("is 1 with no spines or no room measured yet", () => {
    expect(fitMiniShelf([], 200, 3)).toBe(1);
    expect(fitMiniShelf(spines, 0, 3)).toBe(1);
  });
});

describe("miniShelfScale", () => {
  const spines = [
    { w: 20, h: 100 },
    { w: 30, h: 200 },
  ];
  it("is the width fit when the tallest spine has room", () => {
    expect(miniShelfScale(spines, 60, 1000, 3)).toBeCloseTo(60 / 53, 10);
  });
  it("is held back so the tallest spine fits the available height", () => {
    expect(miniShelfScale(spines, 200, 250, 3)).toBeCloseTo(1.25, 10);
  });
  it("never goes below 0.5 for a tiny height, and is 1 for no spines or no height yet", () => {
    expect(miniShelfScale(spines, 200, 20, 3)).toBe(0.5);
    expect(miniShelfScale([], 200, 250, 3)).toBe(1);
    expect(miniShelfScale(spines, 200, 0, 3)).toBe(1);
  });
});
