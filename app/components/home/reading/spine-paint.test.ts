import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteBook } from "~/types";
import { GRAIN_TILE, grainAlphas } from "./spine-cloth";
import { EMBLEMS, drawEmblem } from "./spine-emblems";
import {
  AUTHOR_MIN_CSS_PX,
  drawingWidth,
  faceOf,
  measurer,
  paintSpine,
  planSpine,
  type SpinePlan,
} from "./spine-paint";
import { SERIES, designFor, plainSeries, type SeriesDesign } from "./spine-series";
import { bookSize } from "./shelf-math";
import { FakePath2D, recordingCtx } from "./spine-test-ctx";
import { spineColours } from "./spine-styles";

const books = (
  JSON.parse(readFileSync(path.join(process.cwd(), "content", "site", "books.json"), "utf8")) as { items: SiteBook[] }
).items;

beforeEach(() => vi.stubGlobal("Path2D", FakePath2D));
afterEach(() => vi.unstubAllGlobals());

const design = (b: SiteBook) => designFor(b, spineColours({ dominant: b.color, secondary: b.color }));
const spineSize = (b: SiteBook, scale: number, dpr: number) => {
  const { T, H } = bookSize(b);
  return { w: Math.round(T * scale * dpr), h: Math.round(H * scale * dpr) };
};
/** A letter is 0.6 of the font size, as in the recording context. */
const measure = (t: string, s: number) => [...t].length * 0.6 * s;
const plan = (b: SiteBook, w: number, h: number, d: SeriesDesign = design(b), o = {}) =>
  planSpine(b, d, w, h, { title: measure, author: measure }, o);

// the shelf's sizes: a desktop screen (331 px a world unit), a phone at dpr 2, a small phone
const SIZES: [string, number, number][] = [
  ["desktop", 331, 1],
  ["phone", 124, 2],
  ["small phone", 90, 1],
];

describe("drawingWidth", () => {
  it("is the series' width for a book from its pages, 32 to 72", () => {
    expect(drawingWidth(146)).toBe(35);
    expect(drawingWidth(466)).toBe(69);
    expect(drawingWidth(10)).toBe(32);
    expect(drawingWidth(2000)).toBe(72);
  });
});

describe("paintSpine draws inside its box", () => {
  for (const [name, scale, dpr] of SIZES) {
    it(`for each of the fourteen books at ${name} (${scale} px a unit, dpr ${dpr})`, () => {
      for (const b of books) {
        const { w, h } = spineSize(b, scale, dpr);
        const { ctx, marks } = recordingCtx();
        const out = paintSpine(ctx, w, h, b, design(b), { dpr });
        expect(marks.length, b.id).toBeGreaterThan(8);
        for (const m of marks) {
          const where = `${b.id} ${name} ${m.kind} ${m.text ?? ""}`;
          expect(m.l, where).toBeGreaterThanOrEqual(-0.5);
          expect(m.t, where).toBeGreaterThanOrEqual(-0.5);
          expect(m.r, where).toBeLessThanOrEqual(w + 0.5);
          expect(m.b, where).toBeLessThanOrEqual(h + 0.5);
        }
        expect(out.titleSize, b.id).toBeGreaterThan(0);
      }
    });
  }

  it("keeps the title clear of the author and of the emblem, in order down the spine", () => {
    for (const [, scale, dpr] of SIZES) {
      for (const b of books) {
        const { w, h } = spineSize(b, scale, dpr);
        const p = plan(b, w, h, design(b), { dpr });
        const half = p.title.length / 2;
        const from = p.title.centre - half;
        const to = p.title.centre + half;
        if (p.emblem) expect(from, b.id).toBeGreaterThanOrEqual(p.emblem.y + p.emblem.size - 1e-6);
        expect(to, b.id).toBeLessThanOrEqual(p.author.top + 1e-6);
        expect(p.author.top, b.id).toBeLessThanOrEqual(p.mark.cy);
      }
    }
  });

  it("covers the whole canvas with the cloth first", () => {
    const b = books[0];
    const { w, h } = spineSize(b, 331, 1);
    const { ctx, marks } = recordingCtx();
    paintSpine(ctx, w, h, b, design(b));
    expect(marks[0]).toMatchObject({ kind: "rect", l: 0, t: 0, r: w, b: h });
  });

  it("is the same for the same inputs", () => {
    const run = () => {
      const { ctx, marks } = recordingCtx();
      paintSpine(ctx, 36, 420, books[0], design(books[0]));
      return JSON.stringify(marks);
    };
    expect(run()).toBe(run());
  });
});

describe("type scales with the spine's width", () => {
  it("doubles every size when the spine is twice as wide and as tall", () => {
    for (const b of books) {
      const a = plan(b, 70, 800);
      const c = plan(b, 140, 1600);
      expect(c.title.size / a.title.size, b.id).toBeCloseTo(1, 6); // in drawing units the same
      expect((c.title.size * c.u) / (a.title.size * a.u), b.id).toBeCloseTo(2, 6);
      expect(c.u / a.u, b.id).toBeCloseTo(2, 6);
    }
  });

  it("keeps the same drawing at any size: the plan in drawing units does not change with the canvas", () => {
    const b = books[4];
    const a = plan(b, 69, 700);
    const c = plan(b, 276, 2800);
    expect(c.vw).toBe(a.vw);
    expect(c.title.lines).toEqual(a.title.lines);
    expect(c.title.size).toBeCloseTo(a.title.size, 6);
  });

  it("never sets an author under 10 CSS pixels, at dpr 1 and 2, on any book at any size", () => {
    for (const dpr of [1, 2]) {
      for (const scale of [60, 90, 124, 200, 331, 500]) {
        for (const b of books) {
          const { w, h } = spineSize(b, scale, dpr);
          const p = plan(b, w, h, design(b), { dpr });
          expect(p.author.size * p.u, `${b.id} ${scale}@${dpr}`).toBeGreaterThanOrEqual(AUTHOR_MIN_CSS_PX * dpr - 1e-6);
        }
      }
    }
  });

  it("lets the small shelf ask for a lower floor", () => {
    const b = books[0];
    const a = plan(b, 18, 220);
    const c = plan(b, 18, 220, design(b), { authorMinCss: 5 });
    expect(c.author.size * c.u).toBeLessThan(a.author.size * a.u);
    expect(c.author.size * c.u).toBeGreaterThanOrEqual(5 - 1e-6);
  });

  it("leaves the author out when it would be set under the hide size (the small shelf, R91), and keeps it above", () => {
    const b = books[0];
    const w = Math.round(drawingWidth(b.pages) * 0.42);
    const small = plan(b, w, 220, design(b), { authorMinCss: 0, authorHideUnderCss: 7 });
    expect(small.author.text).toBe("");
    expect(small.author.size).toBe(0);
    const { ctx, marks } = recordingCtx();
    const out = paintSpine(ctx, w, 220, b, design(b), { authorMinCss: 0, authorHideUnderCss: 7 });
    expect(out.authorText).toBe("");
    expect(marks.some((m) => m.text === b.author.toLocaleUpperCase())).toBe(false);
    // twice the size: the author is 8.4 CSS px, kept
    const big = plan(b, w * 2, 440, design(b), { authorMinCss: 0, authorHideUnderCss: 7 });
    expect(big.author.text).not.toBe("");
    expect(big.author.size * big.u).toBeGreaterThanOrEqual(7 - 1e-6);
    // the room it left goes to the title
    expect(small.title.size).toBeGreaterThanOrEqual(plan(b, w, 220, design(b), { authorMinCss: 0 }).title.size);
  });

  it("keeps the title and its lines inside the spine's width across", () => {
    for (const [, scale, dpr] of SIZES) {
      for (const b of books) {
        const { w, h } = spineSize(b, scale, dpr);
        const p = plan(b, w, h, design(b), { dpr });
        const across = p.title.lines.length * p.title.lineHeight * p.title.size;
        expect(across, b.id).toBeLessThanOrEqual(0.92 * p.vw + 1e-6);
      }
    }
  });
});

describe("the two long titles keep their two lines", () => {
  it("at every size, and no other title is split", () => {
    for (const [, scale, dpr] of SIZES) {
      for (const b of books) {
        const { w, h } = spineSize(b, scale, dpr);
        const lines = plan(b, w, h, design(b), { dpr }).title.lines;
        const long = b.id === "grid-systems-in-graphic-design" || b.id === "the-design-of-everyday-things";
        expect(lines.length, b.id).toBe(long ? 2 : 1);
      }
    }
  });
});

describe("a book with no design", () => {
  it("is painted in the plain style from its colours, inside its box", () => {
    const b = { ...books[2], id: "no-design-for-this-one", title: "A Book Nobody Drew a Spine For", author: "Someone Unknown" };
    for (const [, scale, dpr] of SIZES) {
      const { w, h } = spineSize(b, scale, dpr);
      const d = plainSeries(spineColours({ dominant: "#8a6a4a", secondary: "#8a6a4a" }));
      const { ctx, marks } = recordingCtx();
      paintSpine(ctx, w, h, b, d, { dpr });
      expect(marks.length).toBeGreaterThan(5);
      for (const m of marks) {
        expect(m.l).toBeGreaterThanOrEqual(-0.5);
        expect(m.r).toBeLessThanOrEqual(w + 0.5);
        expect(m.b).toBeLessThanOrEqual(h + 0.5);
      }
    }
  });
});

describe("the layout", () => {
  it("stands the block design's emblem on its block and the others' under the head", () => {
    const g = plan(books.find((b) => b.id === "grid-systems-in-graphic-design")!, 38, 550);
    expect(g.block).toEqual({ h: g.vw + 14 });
    expect(g.emblem!.y + g.emblem!.size / 2).toBeCloseTo(g.block!.h / 2, 6);
    const s = plan(books.find((b) => b.id === "story")!, 69, 475);
    expect(s.block).toBeNull();
    expect(s.emblem).toEqual({ x: (69 - 30) / 2, y: 16, size: 30 });
  });

  it("draws a pair of rules at each end of the designs that have them, and none otherwise", () => {
    const withRules = (p: SpinePlan) => p.rules.length;
    expect(withRules(plan(books.find((b) => b.id === "sculpting-in-time")!, 47, 450))).toBe(4);
    expect(withRules(plan(books.find((b) => b.id === "story")!, 69, 475))).toBe(0);
  });

  it("puts the ring mark at the foot, centred", () => {
    const p = plan(books[0], 35, 425);
    expect(p.mark.cx).toBe(p.vw / 2);
    expect(p.vh - p.mark.cy).toBeCloseTo(14 + 6.5, 6);
  });

  it("falls back to the surname when the whole name would take too much of a short spine", () => {
    const b = books.find((x) => x.id === "grid-systems-in-graphic-design")!;
    const p = plan(b, 12, 120); // a very small spine
    expect(p.author.text).toBe("MÜLLER-BROCKMANN");
  });
});

describe("emblems", () => {
  it("has a drawing for every emblem the series names", () => {
    for (const d of Object.values(SERIES)) expect(d.emblem === "none" || d.emblem in EMBLEMS).toBe(true);
    expect(Object.keys(EMBLEMS)).toHaveLength(14);
  });

  it("is drawn inside the box asked for", () => {
    for (const id of Object.keys(EMBLEMS) as (keyof typeof EMBLEMS)[]) {
      const { ctx, marks } = recordingCtx();
      drawEmblem(ctx, id, 10, 20, 24, "#fff");
      expect(marks.length, id).toBeGreaterThan(0);
      for (const m of marks) {
        expect(m.l, id).toBeGreaterThanOrEqual(10 - 1e-6);
        expect(m.t, id).toBeGreaterThanOrEqual(20 - 1e-6);
        expect(m.r, id).toBeLessThanOrEqual(34 + 1e-6);
        expect(m.b, id).toBeLessThanOrEqual(44 + 1e-6);
      }
    }
    const { ctx, marks } = recordingCtx();
    drawEmblem(ctx, "none", 0, 0, 24, "#fff");
    expect(marks).toHaveLength(0);
  });
});

describe("the cloth grain", () => {
  it("is the same tile every time and a gentle one", () => {
    const a = grainAlphas();
    expect(a).toHaveLength(GRAIN_TILE * GRAIN_TILE);
    expect([...grainAlphas()]).toEqual([...a]);
    const mean = a.reduce((n, v) => n + v, 0) / a.length / 255;
    expect(mean).toBeGreaterThan(0.03);
    expect(mean).toBeLessThan(0.2);
    expect(Math.max(...a) / 255).toBeLessThan(0.4);
  });
});

describe("type measured as it is drawn", () => {
  /** A context whose whole-string measure includes a kerning pull (half a pixel a pair). */
  function kerned() {
    const { ctx } = recordingCtx();
    const base = ctx.measureText.bind(ctx);
    return new Proxy(ctx, {
      get(t, k: string) {
        if (k === "measureText") return (text: string) => ({ width: base(text).width - Math.max(0, [...text].length - 1) * 0.5 });
        return (t as unknown as Record<string, unknown>)[k];
      },
    });
  }

  it("measures tracked lettering as the sum of its letters' advances, as it is drawn (no kerning)", () => {
    const d = SERIES["sculpting-in-time"]; // tracked 0.2em
    const ctx = kerned();
    const size = 16;
    const text = "SCULPTING IN TIME";
    const n = [...text].length;
    const letters = n * 0.6 * size;
    const whole = ctx.measureText(text).width;
    expect(whole).toBeLessThan(letters); // the whole string is shorter by its kerning
    expect(measurer(ctx, faceOf(ctx, d))(text, size)).toBeCloseTo(letters + 0.2 * size * (n - 1), 6);
  });

  it("measures an untracked line whole, with its kerning", () => {
    const d = SERIES["on-film-editing"];
    const ctx = kerned();
    const text = "On Film Editing";
    expect(measurer(ctx, faceOf(ctx, d))(text, 19)).toBeCloseTo(ctx.measureText(text).width, 6);
  });

  it("sets the font width back to normal for the author after a condensed or expanded title", () => {
    const widths: string[] = [];
    const { ctx } = recordingCtx();
    const spy = new Proxy(ctx, {
      set(t, k: string, v) {
        if (k === "fontStretch") widths.push(String(v));
        (t as unknown as Record<string, unknown>)[k] = v;
        return true;
      },
    });
    const b = books.find((k) => k.id === "sculpting-in-time")!; // extra-condensed
    paintSpine(spy, 62, 700, b, design(b));
    expect(widths).toContain("extra-condensed");
    expect(widths[widths.length - 1]).toBe("normal"); // the author's face was set last
  });
});
