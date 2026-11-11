import { describe, expect, it } from "vitest";
import type { SiteBook } from "~/types";
import { miniSpine } from "../blocks/mini-previews";
import { placeholderLayout } from "./shelf-placeholder-layout";

const book = (id: string, pages: number, heightIn: number): SiteBook => ({
  id,
  title: id,
  author: "A",
  pages,
  isbn: "",
  heightIn,
  aspect: 0.66,
  spine: "#884422",
  style: "plain",
  note: "",
});
const books = [book("a", 146, 8.5), book("b", 254, 9), book("c", 466, 11), book("d", 220, 8)];

describe("placeholderLayout", () => {
  it("is null until the stage has a size or there are no books", () => {
    expect(placeholderLayout(books, { w: 0, h: 800 })).toBeNull();
    expect(placeholderLayout(books, { w: 1200, h: 0 })).toBeNull();
    expect(placeholderLayout([], { w: 1200, h: 800 })).toBeNull();
  });

  it("gives one bar per book, in order, left to right, centred on the stage", () => {
    const stage = { w: 1440, h: 900 };
    const layout = placeholderLayout(books, stage)!;
    expect(layout.bars).toHaveLength(books.length);
    for (let i = 1; i < layout.bars.length; i++) {
      const prev = layout.bars[i - 1];
      expect(layout.bars[i].left).toBeGreaterThan(prev.left + prev.width);
    }
    const first = layout.bars[0];
    const last = layout.bars[layout.bars.length - 1];
    expect(first.left + (last.left + last.width - first.left) / 2).toBeCloseTo(stage.w / 2, 5);
  });

  it("takes widths from the preview (page count) and heights from the trim height", () => {
    const { bars } = placeholderLayout(books, { w: 1440, h: 900 })!;
    const spines = books.map(miniSpine);
    // one scale for every width, one for every height
    const k = bars[0].width / spines[0].width;
    const h = bars[0].height / books[0].heightIn;
    bars.forEach((b, i) => {
      expect(b.width / spines[i].width).toBeCloseTo(k, 8);
      expect(b.height / books[i].heightIn).toBeCloseTo(h, 8);
    });
    expect(bars[2].height).toBeGreaterThan(bars[3].height); // 11 in against 8 in
  });

  it("stands the bars on a plank that spans the row and sits below the floor line", () => {
    const { bars, floor, plank } = placeholderLayout(books, { w: 1440, h: 900 })!;
    const last = bars[bars.length - 1];
    expect(plank.left).toBeLessThan(bars[0].left);
    expect(plank.left + plank.width).toBeGreaterThan(last.left + last.width);
    expect(plank.top).toBeLessThan(floor);
    expect(plank.top + plank.height).toBeGreaterThan(floor);
    expect(floor).toBeGreaterThan(900 / 2); // the shelf stands in the lower half
    expect(floor).toBeLessThan(900);
  });

  it("keeps the tallest bar inside the stage on a wide, a square and a phone-shaped stage", () => {
    for (const stage of [
      { w: 1920, h: 1080 },
      { w: 900, h: 900 },
      { w: 390, h: 800 },
    ]) {
      const layout = placeholderLayout(books, stage)!;
      const tallest = Math.max(...layout.bars.map((b) => b.height));
      expect(layout.floor - tallest).toBeGreaterThan(0);
      expect(layout.floor).toBeLessThan(stage.h);
    }
  });

  it("scales with the stage: doubling it doubles every length", () => {
    const small = placeholderLayout(books, { w: 700, h: 450 })!;
    const big = placeholderLayout(books, { w: 1400, h: 900 })!;
    expect(big.floor / small.floor).toBeCloseTo(2, 6);
    expect(big.bars[1].height / small.bars[1].height).toBeCloseTo(2, 6);
    expect(big.plank.width / small.plank.width).toBeCloseTo(2, 6);
  });

  it("starts at the left end on a narrow stage, like the 3D shelf's first camera", () => {
    const many = Array.from({ length: 14 }, (_, i) => book(`m${i}`, 150 + i * 30, 8 + (i % 4)));
    const layout = placeholderLayout(many, { w: 390, h: 844 })!;
    const first = layout.bars[0];
    const last = layout.bars[layout.bars.length - 1];
    expect(first.left).toBeGreaterThan(0); // the first book is whole
    expect(first.left).toBeLessThan(390 / 2);
    expect(last.left + last.width).toBeGreaterThan(390); // the rest runs off the right edge
    expect(layout.plank.left).toBeLessThan(first.left);
  });

  it("stays centred on a stage of 700px or more", () => {
    const layout = placeholderLayout(books, { w: 700, h: 450 })!;
    const first = layout.bars[0];
    const last = layout.bars[layout.bars.length - 1];
    expect((first.left + last.left + last.width) / 2).toBeCloseTo(350, 5);
  });
});
