import { describe, expect, it } from "vitest";
import type { SiteBook } from "~/types";
import { bookSize, flatFit, SHELF_GAP } from "./shelf-math";
import { placeholderLayout } from "./shelf-placeholder-layout";

const book = (id: string, pages: number, heightIn: number): SiteBook => ({
  id,
  title: id,
  author: "A",
  pages,
  isbn: "",
  heightIn,
  aspect: 0.66,
  color: "#884422",
  style: "plain",
  note: "",
});
const books = [book("a", 146, 8.5), book("b", 254, 9), book("c", 466, 11), book("d", 220, 8)];
const many = Array.from({ length: 14 }, (_, i) => book(`m${i}`, 150 + i * 30, 8 + (i % 4)));

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

  it("sizes the bars as the 3D row is: thickness and trim height at one scale, the same gaps", () => {
    const stage = { w: 1440, h: 900 };
    const { bars } = placeholderLayout(books, stage)!;
    const sizes = books.map(bookSize);
    const span = sizes.reduce((sum, s) => sum + s.T, 0) + SHELF_GAP * (books.length - 1);
    const { scale } = flatFit({
      vw: stage.w,
      vh: stage.h,
      rowWidth: span,
      tallest: Math.max(...sizes.map((s) => s.H)),
    });
    bars.forEach((b, i) => {
      expect(b.width).toBeCloseTo(sizes[i].T * scale, 8);
      expect(b.height).toBeCloseTo(sizes[i].H * scale, 8);
    });
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].left - (bars[i - 1].left + bars[i - 1].width)).toBeCloseTo(
        SHELF_GAP * scale,
        8,
      );
    }
    expect(bars[2].height).toBeGreaterThan(bars[3].height); // 11 in against 8 in
  });

  it("makes the tallest bar 78% of the height when the row fits, standing on a hairline at 90%", () => {
    const stage = { w: 1440, h: 900 };
    const { bars, floor, line } = placeholderLayout(books, stage)!;
    expect(Math.max(...bars.map((b) => b.height)) / stage.h).toBeCloseTo(0.78, 8);
    expect(floor).toBe(810);
    // one thin line, level with the feet, running the row and a little past each end
    expect(line.top).toBe(floor);
    expect(line.height).toBe(1);
    expect(line.left).toBeLessThan(bars[0].left);
    const last = bars[bars.length - 1];
    expect(line.left + line.width).toBeGreaterThan(last.left + last.width);
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
    const small = placeholderLayout(books, { w: 1400, h: 900 })!;
    const big = placeholderLayout(books, { w: 2800, h: 1800 })!;
    expect(big.floor / small.floor).toBeCloseTo(2, 6);
    expect(big.bars[1].height / small.bars[1].height).toBeCloseTo(2, 6);
    expect(big.line.width / small.line.width).toBeCloseTo(2, 6);
  });

  it("starts at the left end on a narrow stage, like the 3D shelf's first camera", () => {
    const layout = placeholderLayout(many, { w: 390, h: 844 })!;
    const first = layout.bars[0];
    const last = layout.bars[layout.bars.length - 1];
    // the first book is whole, 6% in from the edge
    expect(first.left / 390).toBeCloseTo(0.06, 6);
    expect(last.left + last.width).toBeGreaterThan(390); // the rest runs off the right edge
    expect(layout.line.left).toBeLessThanOrEqual(0 + 1e-9);
  });

  it("keeps the tallest bar at 70% of the height on a narrow stage", () => {
    const layout = placeholderLayout(many, { w: 390, h: 844 })!;
    expect(Math.max(...layout.bars.map((b) => b.height)) / 844).toBeCloseTo(0.7, 8);
  });

  it("stays centred on a stage of 700px or more", () => {
    const layout = placeholderLayout(books, { w: 700, h: 450 })!;
    const first = layout.bars[0];
    const last = layout.bars[layout.bars.length - 1];
    expect((first.left + last.left + last.width) / 2).toBeCloseTo(350, 5);
  });
});
