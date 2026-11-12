import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTHOR_HEAVY_BELOW_CSS_PX,
  AUTHOR_MIN_CSS_PX,
  authorLayout,
  coverCrop,
  drawSpine,
  layoutTitle,
  splitLines,
  type Measure,
} from "./spine-draw";
import { EDGE_COLOUR, spineColours, spineStyle, type SpineStyle } from "./spine-styles";

/** Every letter is 0.6 of the font size wide. */
const measure: Measure = (t, s) => [...t].length * 0.6 * s;
const P = { w: 60, length: 420, full: 30, floor: 9 };

describe("splitLines", () => {
  it("splits at the word break that makes the longer line shortest", () => {
    expect(splitLines("The Design of Everyday Things", measure)).toEqual([
      "The Design of",
      "Everyday Things",
    ]);
    expect(splitLines("Grid Systems in Graphic Design", measure)).toEqual([
      "Grid Systems in",
      "Graphic Design",
    ]);
  });
  it("cannot split one word", () => {
    expect(splitLines("Story", measure)).toBeNull();
    expect(splitLines("  Story ", measure)).toBeNull();
  });
});

describe("layoutTitle", () => {
  it("keeps a short title on one line at the full size", () => {
    expect(layoutTitle("Story", measure, P)).toEqual({ lines: ["Story"], size: 30 });
  });

  it("steps a longer title down, but not under 60% of the full size, on one line", () => {
    const r = layoutTitle("Sculpting in Time", measure, P); // 17 letters: 17 x 0.6 x 30 = 306 fits at 30? yes
    expect(r.lines).toHaveLength(1);
    const long = layoutTitle("Understanding Comic", measure, { ...P, length: 260 });
    expect(long.lines).toHaveLength(1);
    expect(long.size).toBeLessThan(30);
    expect(long.size).toBeGreaterThanOrEqual(30 * 0.6 - 1e-6);
    expect(measure(long.lines[0], long.size)).toBeLessThanOrEqual(260);
  });

  it("wraps to two lines before the size falls under 60% of the full size", () => {
    const q = { ...P, length: 250 };
    const r = layoutTitle("The Design of Everyday Things", measure, q);
    expect(r.lines).toHaveLength(2);
    expect(Math.max(...r.lines.map((l) => measure(l, r.size)))).toBeLessThanOrEqual(q.length);
    // two lines stand in the spine's width
    expect(2 * 1.08 * r.size).toBeLessThanOrEqual(P.w * 0.86 + 1e-6);
  });

  it("shrinks a long single word to fit, never below the floor", () => {
    const r = layoutTitle("Pneumonoultramicroscopic", measure, { ...P, length: 200 });
    expect(r.lines).toEqual(["Pneumonoultramicroscopic"]);
    expect(r.size).toBeLessThan(30 * 0.6);
    expect(r.size).toBeGreaterThanOrEqual(P.floor);
    expect(layoutTitle("Pneumonoultramicroscopic", measure, { ...P, length: 20 }).size).toBe(9);
  });

  it("never leaves a real title over its length when it can shrink", () => {
    const books = (
      JSON.parse(
        readFileSync(path.join(process.cwd(), "content", "site", "books.json"), "utf8"),
      ) as { items: { title: string }[] }
    ).items;
    for (const b of books) {
      const r = layoutTitle(b.title.toUpperCase(), measure, P);
      for (const l of r.lines) expect(measure(l, r.size), b.title).toBeLessThanOrEqual(P.length + 1e-6);
    }
  });
});

describe("authorLayout", () => {
  const A = { length: 100, full: 14, floor: 10 };

  it("uses the whole name at the full size when it fits", () => {
    expect(authorLayout("Don Norman", measure, { ...A, length: 200 })).toEqual({ text: "Don Norman", size: 14 });
  });

  it("steps the whole name down, but only to 72% of full and never under the floor", () => {
    const r = authorLayout("Don Norman", measure, { ...A, length: 70 }); // 10 letters at 0.6 em: size 11.67 or less
    expect(r.text).toBe("Don Norman");
    expect(r.size).toBeGreaterThanOrEqual(10);
    expect(measure(r.text, r.size)).toBeLessThanOrEqual(70);
  });

  it("falls back to the surname before going under the floor", () => {
    const r = authorLayout("Josef Muller-Brockmann", measure, A);
    expect(r.text).toBe("Muller-Brockmann");
    expect(r.size).toBeGreaterThanOrEqual(A.floor);
  });

  it("never goes under the floor, even for a surname that cannot fit", () => {
    const r = authorLayout("Aaa Pneumonoultramicroscopic", measure, { ...A, length: 30 });
    expect(r.text).toBe("Pneumonoultramicroscopic");
    expect(r.size).toBe(10);
  });

  it("raises a full size that is under the floor to the floor", () => {
    expect(authorLayout("Ab", measure, { length: 100, full: 6, floor: 10 })).toEqual({ text: "Ab", size: 10 });
  });

  it("a single name is only ever the whole name", () => {
    expect(authorLayout("Plato", measure, { ...A, length: 20 })).toEqual({ text: "Plato", size: 10 });
  });
});

describe("coverCrop", () => {
  it("crops the overflow evenly and covers the canvas", () => {
    expect(coverCrop(200, 100, 50, 100)).toEqual({ sx: 75, sy: 0, cw: 50, ch: 100 });
    expect(coverCrop(100, 400, 50, 100)).toEqual({ sx: 0, sy: 100, cw: 100, ch: 200 });
    expect(coverCrop(50, 100, 50, 100)).toEqual({ sx: 0, sy: 0, cw: 50, ch: 100 });
  });
});

/** A recording stand-in for a 2D context: text width 0.6 em a letter, every call logged. */
function fakeCtx() {
  const log: { fn: string; args: unknown[]; font: string; fill: string }[] = [];
  const state = { font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, lineJoin: "", textAlign: "", textBaseline: "" };
  const ctx = new Proxy(state, {
    get(t, k: string) {
      if (k in t) return (t as Record<string, unknown>)[k];
      if (k === "measureText") {
        return (s: string) => ({ width: [...s].length * 0.6 * parseFloat(/([\d.]+)px/.exec(t.font)?.[1] ?? "10") });
      }
      return (...args: unknown[]) => log.push({ fn: k, args, font: t.font, fill: String(t.fillStyle) });
    },
    set(t, k: string, v) {
      (t as Record<string, unknown>)[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

describe("drawSpine", () => {
  const colours = spineColours({ dominant: "#2c3b43", secondary: "#c79a2a" });
  const book = { title: "The Design of Everyday Things", author: "Don Norman" };

  it("covers the whole canvas first, in the ground colour", () => {
    for (const style of [0, 1, 2, 3, 4] as SpineStyle[]) {
      const { ctx, log } = fakeCtx();
      drawSpine(ctx, { w: 90, h: 600 }, book, style, colours);
      expect(log[0]).toMatchObject({ fn: "save" });
      expect(log[1]).toMatchObject({ fn: "fillRect", args: [0, 0, 90, 600], fill: colours.ground });
      expect(log.at(-1)?.fn).toBe("restore");
    }
  });

  it("writes the title and the author in the ink, with system font stacks only", () => {
    for (const style of [0, 1, 2, 3, 4] as SpineStyle[]) {
      const { ctx, log } = fakeCtx();
      drawSpine(ctx, { w: 90, h: 600 }, book, style, colours);
      const text = log.filter((l) => l.fn === "fillText");
      expect(text.length).toBeGreaterThan(2);
      for (const t of text) {
        expect(t.fill).toBe(colours.ink);
        expect(t.font).toMatch(/(serif|sans-serif|monospace)$/);
        expect(t.font).not.toMatch(/Lora|Tektur|Plex|@font-face/i);
      }
      const letters = text.map((t) => t.args[0]).join("");
      // the author's letters are all there (capitals in the capital styles)
      expect(letters.toLowerCase().replace(/ /g, "")).toContain("donnorman");
    }
  });

  it("never sets an author under 10 CSS pixels, at dpr 1 and 2, for any real book, size or style", () => {
    const books = (
      JSON.parse(
        readFileSync(path.join(process.cwd(), "content", "site", "books.json"), "utf8"),
      ) as { items: { id: string; title: string; author: string; color: string }[] }
    ).items;
    for (const dpr of [1, 2]) {
      for (const [w, h] of [[34, 330], [45, 702], [60, 520], [98, 800], [140, 1100]]) {
        for (const b of books) {
          for (const style of [0, 1, 2, 3, 4] as SpineStyle[]) {
            const { ctx } = fakeCtx();
            const c = spineColours({ dominant: b.color, secondary: b.color });
            const r = drawSpine(ctx, { w: w * dpr, h: h * dpr }, b, style, c, dpr);
            expect(r.authorSize, `${b.id} s${style} ${w}x${h}@${dpr}`).toBeGreaterThanOrEqual(AUTHOR_MIN_CSS_PX * dpr - 1e-6);
          }
        }
      }
    }
  });

  it("sets the author in a heavier weight under 11 CSS pixels", () => {
    // a tight length: the author lands on the 10 px floor
    const { ctx, log } = fakeCtx();
    const r = drawSpine(ctx, { w: 40, h: 300 }, { title: "Story", author: "Josef Muller-Brockmann" }, 4, colours, 1);
    expect(r.authorSize).toBeLessThan(AUTHOR_HEAVY_BELOW_CSS_PX);
    expect(r.authorWeight).toBeGreaterThanOrEqual(600);
    const authorText = log.filter((l) => l.fn === "fillText").at(-1);
    expect(authorText?.font).toMatch(/^600 |^700 |^800 |^900 /);
    // large enough: the style's own light weight
    const big = fakeCtx();
    const r2 = drawSpine(big.ctx, { w: 120, h: 900 }, { title: "Story", author: "Don Norman" }, 4, colours, 1);
    expect(r2.authorSize).toBeGreaterThanOrEqual(AUTHOR_HEAVY_BELOW_CSS_PX);
    expect(r2.authorWeight).toBe(300);
  });

  it("draws a 1 CSS pixel light edge down both sides of a near black spine and none on a lighter one", () => {
    const dark = fakeCtx();
    drawSpine(dark.ctx, { w: 90, h: 600 }, book, 1, spineColours({ dominant: "#151312", secondary: "#151312" }), 2);
    const edges = dark.log.filter((l) => l.fn === "fillRect" && l.fill === EDGE_COLOUR);
    expect(edges.map((e) => e.args)).toEqual([[0, 0, 2, 600], [88, 0, 2, 600]]);
    const light = fakeCtx();
    drawSpine(light.ctx, { w: 90, h: 600 }, book, 1, spineColours({ dominant: "#a8352a", secondary: "#a8352a" }), 2);
    expect(light.log.some((l) => l.fill === EDGE_COLOUR)).toBe(false);
  });

  it("is the same for the same inputs", () => {
    const run = (style: SpineStyle) => {
      const { ctx, log } = fakeCtx();
      drawSpine(ctx, { w: 70, h: 500 }, { title: "Story", author: "Robert McKee" }, style, colours);
      return JSON.stringify(log);
    };
    for (const s of [0, 1, 2, 3, 4] as SpineStyle[]) expect(run(s)).toBe(run(s));
    expect(run(0)).not.toBe(run(3));
  });

  it("runs for every real book in its own style", () => {
    const books = (
      JSON.parse(
        readFileSync(path.join(process.cwd(), "content", "site", "books.json"), "utf8"),
      ) as { items: { id: string; title: string; author: string; color: string }[] }
    ).items;
    for (const b of books) {
      const { ctx, log } = fakeCtx();
      drawSpine(ctx, { w: 60, h: 700 }, b, spineStyle(b.id), spineColours({ dominant: b.color, secondary: b.color }));
      expect(log.some((l) => l.fn === "fillText"), b.id).toBe(true);
    }
  });
});
