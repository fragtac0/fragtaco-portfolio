import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMBLEMS } from "./spine-emblems";
import {
  AUTHOR_FONT,
  SERIES,
  designFor,
  familyList,
  hasSeries,
  parseFont,
  plainSeries,
  seriesFaces,
  stretchOf,
  titleText,
  trackOf,
} from "./spine-series";
import { contrast, spineColours } from "./spine-styles";

type Book = { id: string; title: string; author: string; color: string; pages: number; series?: string };
const books = (
  JSON.parse(readFileSync(path.join(process.cwd(), "content", "site", "books.json"), "utf8")) as { items: Book[] }
).items;

describe("the series", () => {
  it("has a design for each of the fourteen books and no other", () => {
    expect(books).toHaveLength(14);
    expect(Object.keys(SERIES).sort()).toEqual(books.map((b) => b.id).sort());
  });

  it("resolves every book in books.json to its own design", () => {
    for (const b of books) {
      const colours = spineColours({ dominant: b.color, secondary: b.color });
      expect(hasSeries(b), b.id).toBe(true);
      expect(designFor(b, colours), b.id).toBe(SERIES[b.series ?? b.id]);
    }
  });

  it("names a design in books.json that exists, for every book that names one", () => {
    for (const b of books) if (b.series) expect(SERIES[b.series], b.id).toBeDefined();
  });

  it("gives every design a readable foil on its cloth, a real emblem and a font that parses", () => {
    for (const [id, d] of Object.entries(SERIES)) {
      expect(contrast(d.foil, d.cloth), id).toBeGreaterThanOrEqual(3); // large display type, as the preview
      if (d.block) expect(contrast(d.block.ink, d.block.fill), id).toBeGreaterThanOrEqual(3);
      expect(d.emblem === "none" || d.emblem in EMBLEMS, id).toBe(true);
      const f = parseFont(d.font);
      expect(f.family, id).not.toBe("");
      expect(f.size, id).toBeGreaterThan(8);
      expect(d.font, id).toMatch(/^(italic )?\d{3} [\d.]+px "[^"]+"$/);
      expect(Number.isFinite(stretchOf(d)) && Number.isFinite(trackOf(d)), id).toBe(true);
    }
  });

  it("is the fourteen designs of the preview: spot checks", () => {
    expect(SERIES.story).toMatchObject({ cloth: "#1e3b2d", foil: "#dcbb78", emblem: "arc", emSize: 30, track: "0.1em" });
    expect(SERIES["sculpting-in-time"]).toMatchObject({ stretch: "62%", rules: true, upper: true });
    expect(SERIES["making-movies"].stretch).toBe("125%");
    expect(SERIES["grid-systems-in-graphic-design"].block).toEqual({ fill: "#d5311b", ink: "#ffffff" });
    expect(SERIES["the-design-of-everyday-things"].lines).toEqual(["The Design of", "Everyday Things"]);
    expect(SERIES["thinking-with-type"].lower).toBe(true);
  });

  it("sets exactly the two long titles on two lines, each line a piece of the title", () => {
    for (const b of books) {
      const d = SERIES[b.id];
      if (d.lines) expect(d.lines.join(" ").toLowerCase(), b.id).toBe(b.title.toLowerCase());
    }
    expect(Object.entries(SERIES).filter(([, d]) => d.lines).map(([id]) => id).sort()).toEqual([
      "grid-systems-in-graphic-design",
      "the-design-of-everyday-things",
    ]);
  });
});

describe("plainSeries and designFor", () => {
  it("makes the plain style from a cover's colours, with ink that reads on it", () => {
    for (const hex of ["#151312", "#ece6d6", "#c21f2b", "#8a6a4a"]) {
      const c = spineColours({ dominant: hex, secondary: hex });
      const d = plainSeries(c);
      expect(d.cloth).toBe(c.ground);
      expect(d.foil).toBe(c.ink);
      expect(contrast(d.foil, d.cloth)).toBeGreaterThanOrEqual(4.5);
      expect(parseFont(d.font).family).toBe("Newsreader");
    }
  });

  it("gives a book with no entry the plain style, and honours a book's own `series` key", () => {
    const c = spineColours({ dominant: "#8a6a4a", secondary: "#8a6a4a" });
    expect(hasSeries({ id: "not-in-the-series" })).toBe(false);
    expect(designFor({ id: "not-in-the-series" }, c)).toEqual(plainSeries(c));
    expect(designFor({ id: "not-in-the-series", series: "story" }, c)).toBe(SERIES.story);
  });
});

describe("type helpers", () => {
  it("parses a series font", () => {
    expect(parseFont('italic 500 19px "Bodoni Moda"')).toEqual({ italic: true, weight: 500, size: 19, family: "Bodoni Moda" });
    expect(parseFont('900 19px "Archivo"')).toEqual({ italic: false, weight: 900, size: 19, family: "Archivo" });
  });

  it("applies the case and the lines of a design to the title", () => {
    expect(titleText({ title: "Story" }, SERIES.story)).toEqual(["STORY"]);
    expect(titleText({ title: "Thinking with Type" }, SERIES["thinking-with-type"])).toEqual(["thinking with type"]);
    expect(titleText({ title: "x" }, SERIES["the-design-of-everyday-things"])).toEqual(["The Design of", "Everyday Things"]);
    expect(titleText({ title: "In the Blink of an Eye" }, SERIES["in-the-blink-of-an-eye"])).toEqual(["In the Blink of an Eye"]);
  });

  it("names a generic fallback for each face", () => {
    expect(familyList("Bodoni Moda")).toBe('"Bodoni Moda", serif');
    expect(familyList("Archivo")).toBe('"Archivo", sans-serif');
    expect(familyList("IBM Plex Mono")).toBe('"IBM Plex Mono", monospace');
  });

  it("lists the faces a design needs: title, author and the emblem's letters", () => {
    expect(seriesFaces(SERIES.story)).toEqual(['800 46px "Bodoni Moda"', `${AUTHOR_FONT.weight} ${AUTHOR_FONT.size}px "IBM Plex Mono"`]);
    expect(seriesFaces(SERIES["thinking-with-type"])).toContain('600 17px "Bodoni Moda"');
    expect(seriesFaces(SERIES["in-the-blink-of-an-eye"])[0]).toBe('italic 500 19px "Bodoni Moda"');
  });

  it("uses only the faces the page loads: the six spine faces and IBM Plex Mono", () => {
    const families = new Set(Object.values(SERIES).map((d) => parseFont(d.font).family));
    for (const f of families) {
      expect(["Archivo", "Bodoni Moda", "Newsreader", "Space Grotesk", "Unbounded", "Young Serif", "IBM Plex Mono"]).toContain(f);
    }
  });
});
