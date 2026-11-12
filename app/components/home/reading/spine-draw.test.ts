import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverCrop, drawSpine, layoutTitle, splitLines, type Measure } from "./spine-draw";
import { spineColours, spineStyle, type SpineStyle } from "./spine-styles";

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
