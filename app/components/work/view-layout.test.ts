import { describe, expect, it } from "vitest";
import {
  brickLayout,
  contentHeight,
  viewColumns,
  viewFromSearch,
} from "./view-layout";

const base = { itemW: 100, itemH: 60, gapX: 10, gapY: 20, width: 1000, top: 50 };
const pitch = base.itemW + base.gapX;

const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x < b.x + base.itemW &&
  b.x < a.x + base.itemW &&
  a.y < b.y + base.itemH &&
  b.y < a.y + base.itemH;

describe("viewFromSearch", () => {
  it("reads the three views", () => {
    expect(viewFromSearch("?view=long")).toBe("long");
    expect(viewFromSearch("?view=short")).toBe("short");
    expect(viewFromSearch("?view=clients")).toBe("clients");
  });

  it("falls back to all", () => {
    expect(viewFromSearch("")).toBe("all");
    expect(viewFromSearch("?view=nope")).toBe("all");
    expect(viewFromSearch("?view=all")).toBe("all");
    expect(viewFromSearch("?view=")).toBe("all");
    expect(viewFromSearch("?other=long")).toBe("all");
    expect(viewFromSearch("?view=LONG")).toBe("all");
  });

  it("works without the leading question mark and among other params", () => {
    expect(viewFromSearch("view=short")).toBe("short");
    expect(viewFromSearch("?a=1&view=clients&b=2")).toBe("clients");
  });
});

describe("viewColumns", () => {
  it("is 4, 7 and 6 across on desktop", () => {
    expect(viewColumns("long", 1440)).toBe(4);
    expect(viewColumns("short", 1440)).toBe(7);
    expect(viewColumns("clients", 1440)).toBe(6);
  });

  it("is 2, 3 and 3 across under 700px", () => {
    expect(viewColumns("long", 390)).toBe(2);
    expect(viewColumns("short", 390)).toBe(3);
    expect(viewColumns("clients", 699)).toBe(3);
  });

  it("switches at 700", () => {
    expect(viewColumns("long", 700)).toBe(4);
  });
});

describe("brickLayout", () => {
  it("lays 7 items in rows of 4 and 3, the second shifted half a pitch", () => {
    const p = brickLayout({ ...base, count: 7, cols: 4 });
    expect(p).toHaveLength(7);
    const row0 = p.slice(0, 4);
    const row1 = p.slice(4);
    expect(new Set(row0.map((q) => q.y)).size).toBe(1);
    expect(new Set(row1.map((q) => q.y)).size).toBe(1);
    expect(row1[0].y).toBe(row0[0].y + base.itemH + base.gapY);
    expect(row0[0].y).toBe(base.top);
    expect(row1[0].x - row0[0].x).toBeCloseTo(pitch / 2);
    expect(row0[1].x - row0[0].x).toBeCloseTo(pitch);
    expect(row1[1].x - row1[0].x).toBeCloseTo(pitch);
  });

  it("centres the block in the width", () => {
    const p = brickLayout({ ...base, count: 4, cols: 4 });
    const blockW = 4 * base.itemW + 3 * base.gapX;
    expect(p[0].x).toBeCloseTo((base.width - blockW) / 2);
    expect(p[3].x + base.itemW).toBeCloseTo((base.width + blockW) / 2);
  });

  it("keeps every item inside the width and none over another", () => {
    const p = brickLayout({ ...base, count: 30, cols: 4 });
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(0);
      expect(q.x + base.itemW).toBeLessThanOrEqual(base.width);
    }
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) expect(overlap(p[i], p[j])).toBe(false);
  });

  it("returns nothing for no items", () => {
    expect(brickLayout({ ...base, count: 0, cols: 4 })).toEqual([]);
    expect(brickLayout({ ...base, count: -2, cols: 4 })).toEqual([]);
  });

  it("handles one item", () => {
    const p = brickLayout({ ...base, count: 1, cols: 4 });
    expect(p).toHaveLength(1);
    expect(p[0].y).toBe(base.top);
  });

  it("handles cols - 1, cols and cols + 1 items", () => {
    expect(brickLayout({ ...base, count: 3, cols: 4 })).toHaveLength(3);
    const exact = brickLayout({ ...base, count: 4, cols: 4 });
    expect(new Set(exact.map((q) => q.y)).size).toBe(1);
    const over = brickLayout({ ...base, count: 5, cols: 4 });
    expect(over[4].y).toBeGreaterThan(over[0].y);
    expect(over[4].x).toBeCloseTo(over[0].x + pitch / 2);
  });

  it("returns one position per item at any count", () => {
    for (const cols of [1, 2, 3, 4, 7]) {
      for (const count of [0, 1, cols - 1, cols, cols + 1, 40, 120]) {
        if (count < 0) continue;
        const p = brickLayout({ ...base, count, cols });
        expect(p).toHaveLength(count);
        for (const q of p) {
          expect(Number.isFinite(q.x)).toBe(true);
          expect(Number.isFinite(q.y)).toBe(true);
        }
      }
    }
  });

  it("stacks a single column without a shift and without hanging", () => {
    const p = brickLayout({ ...base, count: 3, cols: 1 });
    expect(p).toHaveLength(3);
    expect(new Set(p.map((q) => q.x)).size).toBe(1);
    expect(p[1].y).toBe(base.top + base.itemH + base.gapY);
  });

  it("treats a bad column count as one", () => {
    expect(brickLayout({ ...base, count: 3, cols: 0 })).toHaveLength(3);
    expect(brickLayout({ ...base, count: 3, cols: Number.NaN })).toHaveLength(3);
  });

  it("works with two columns, whose odd rows hold one item", () => {
    const p = brickLayout({ ...base, count: 5, cols: 2 });
    expect(p).toHaveLength(5);
    expect(p[3].y).toBe(base.top + 2 * (base.itemH + base.gapY));
    expect(p[3].x).toBeCloseTo(p[0].x);
    expect(p[2].x).toBeCloseTo(p[0].x + pitch / 2);
  });

  it("does not place items at a negative x when the width is too small", () => {
    const p = brickLayout({ ...base, count: 8, cols: 4, width: 200 });
    for (const q of p) expect(q.x).toBeGreaterThanOrEqual(0);
  });
});

describe("contentHeight", () => {
  it("is the bottom of the lowest item", () => {
    const p = brickLayout({ ...base, count: 7, cols: 4 });
    expect(contentHeight(p, base.itemH)).toBe(base.top + base.itemH + base.gapY + base.itemH);
  });

  it("is zero for no items", () => {
    expect(contentHeight([], 60)).toBe(0);
  });

  it("handles one item", () => {
    expect(contentHeight([{ y: 10 }], 60)).toBe(70);
  });
});
