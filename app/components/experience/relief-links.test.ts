// The map's pictures as the page asks for them (Ruling R105): the route preloads the picture for the screen only (a phone's smaller one by the
// same media query as the picture's own <source>, the large one on the other side of it), and never the heights, which are read at idle.
import { describe, expect, it } from "vitest";
import { links } from "../../routes/experience";
import { HEIGHTS_IDLE_MS, HEIGHTS_SRC, PHONE_MEDIA, RELIEF_PHONE_SRC, RELIEF_SRC, ROOMY_MEDIA } from "./experience-map";

type Link = { rel: string; href: string; media?: string };
const preloads = (links as unknown as () => Link[])();

/** The two media queries as the page writes them (a comma list of `and` lists of `max-`/`min-` conditions and `width > N` comparisons), read at a screen size. */
function matches(query: string, w: number, h: number): boolean {
  return query.split(",").some((part) =>
    [...part.matchAll(/\(([^)]+)\)/g)].every(([, c]) => {
      const m = /^(max|min)-(width|height):\s*([\d.]+)px$/.exec(c) ?? /^(width|height)\s*(>|<=)\s*([\d.]+)px$/.exec(c);

      if (!m) throw new Error(`unread condition ${c}`);

      const [, a, b, n] = m;
      const v = (b === "width" || a === "width") ? w : h;
      const limit = Number(n);

      if (a === "max") return v <= limit;
      if (a === "min") return v >= limit;

      return b === ">" ? v > limit : v <= limit;
    }),
  );
}

describe("the two media queries", () => {
  it("are complements: every screen size, a fractional width or height too, is on exactly one side", () => {
    const widths = [...Array.from({ length: 80 }, (_, i) => 280 + i * 11), 700, 700.2, 700.5, 700.99, 701, 960, 960.5, 961];
    const heights = [300, 520, 520.4, 520.5, 521, 640, 900];

    for (const w of widths) for (const h of heights) expect(matches(PHONE_MEDIA, w, h) !== matches(ROOMY_MEDIA, w, h), `${w} x ${h}`).toBe(true);
  });

  it("send a phone, a phone held sideways and a narrow tablet to the small picture, a desktop window and a short one to the large", () => {
    expect(matches(PHONE_MEDIA, 390, 844)).toBe(true);
    expect(matches(PHONE_MEDIA, 844, 390)).toBe(true);
    expect(matches(ROOMY_MEDIA, 820, 1180)).toBe(true);
    expect(matches(ROOMY_MEDIA, 1440, 900)).toBe(true);
    expect(matches(ROOMY_MEDIA, 1280, 500)).toBe(true);
    expect(matches(ROOMY_MEDIA, 700.5, 800)).toBe(true);
  });
});

describe("the route's preloads", () => {
  it("are the picture for a phone (under its media query) and the large one (under the other side of it), and nothing else", () => {
    expect(preloads).toHaveLength(2);
    expect(preloads.find((l) => l.href === RELIEF_PHONE_SRC)?.media).toBe(PHONE_MEDIA);
    expect(preloads.find((l) => l.href === RELIEF_SRC)?.media).toBe(ROOMY_MEDIA);
    expect(preloads.every((l) => l.rel === "preload")).toBe(true);
  });

  it("do not preload the heights (they are fetched at idle once the engine is up, within a second at most)", () => {
    expect(preloads.some((l) => l.href === HEIGHTS_SRC)).toBe(false);
    expect(HEIGHTS_IDLE_MS).toBeLessThanOrEqual(1000);
  });
});
