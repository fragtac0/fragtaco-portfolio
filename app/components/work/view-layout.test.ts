import { describe, expect, it } from "vitest";
import {
  brickLayout,
  contentHeight,
  fitItemWidth,
  pickedLayout,
  stackRow,
  viewColumns,
  viewCount,
  viewFromSearch,
  viewTitle,
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
    // a lone item on the second row sits in the middle of the width (it used to sit 1.5 pitches left of it)
    expect(over[4].x + base.itemW / 2).toBeCloseTo(base.width / 2);
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

describe("brickLayout centring of short rows", () => {
  const centre = (q: { x: number }) => q.x + base.itemW / 2;

  it("centres a partly filled even row", () => {
    // 4 across, 9 items: rows of 4, 3 and a last row of 2
    const p = brickLayout({ ...base, count: 9, cols: 4 });
    const last = p.slice(7);
    expect(last).toHaveLength(2);
    expect((centre(last[0]) + centre(last[1])) / 2).toBeCloseTo(base.width / 2);
    expect(last[1].x - last[0].x).toBeCloseTo(pitch);
  });

  it("centres a partly filled odd row", () => {
    // 4 across, 6 items: rows of 4 and 2 (the odd row has room for 3)
    const p = brickLayout({ ...base, count: 6, cols: 4 });
    expect((centre(p[4]) + centre(p[5])) / 2).toBeCloseTo(base.width / 2);
  });

  it("centres a single item", () => {
    const p = brickLayout({ ...base, count: 1, cols: 4 });
    expect(centre(p[0])).toBeCloseTo(base.width / 2);
  });

  it("centres every row of every count, full or short", () => {
    for (const cols of [2, 3, 4, 7]) {
      for (let count = 1; count <= 30; count++) {
        const p = brickLayout({ ...base, count, cols });
        const rows = new Map<number, number[]>();
        for (const q of p) rows.set(q.y, [...(rows.get(q.y) ?? []), q.x]);
        for (const xs of rows.values()) {
          const mid = (Math.min(...xs) + Math.max(...xs) + base.itemW) / 2;
          expect(mid).toBeCloseTo(base.width / 2);
        }
      }
    }
  });

  it("keeps full odd rows half a pitch in from the even rows", () => {
    const p = brickLayout({ ...base, count: 8, cols: 4 });
    expect(p[4].x - p[0].x).toBeCloseTo(pitch / 2);
  });
});

describe("fitItemWidth", () => {
  it("is the widest item that lets the row fit", () => {
    expect(fitItemWidth({ cols: 4, gapX: 24, avail: 1344, maxW: 1000 })).toBe(318);
    expect(fitItemWidth({ cols: 2, gapX: 12, avail: 358, maxW: 1000 })).toBe(173);
  });

  it("is capped at the maximum", () => {
    expect(fitItemWidth({ cols: 4, gapX: 24, avail: 4000, maxW: 360 })).toBe(360);
  });

  it("never goes below 1 and tolerates bad input", () => {
    expect(fitItemWidth({ cols: 4, gapX: 24, avail: 10, maxW: 360 })).toBe(1);
    expect(fitItemWidth({ cols: 0, gapX: 24, avail: 100, maxW: 360 })).toBe(100);
  });
});

describe("pickedLayout", () => {
  const sizes: [number, number][] = [[1440, 900], [1920, 1080], [1024, 768], [700, 800], [390, 844], [320, 568]];

  it("fits every row inside the width, with no overlaps, at every size and count", () => {
    for (const view of ["long", "short", "clients"] as const) {
      for (const [vw] of sizes) {
        for (const count of [1, 3, 10, 16, 24]) {
          const { boxes } = pickedLayout(view, count, vw);
          expect(boxes).toHaveLength(count);
          for (const b of boxes) {
            expect(b.x).toBeGreaterThanOrEqual(0);
            expect(b.x + b.w).toBeLessThanOrEqual(vw);
          }
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i];
              const c = boxes[j];
              const apart = a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y;
              expect(apart).toBe(true);
            }
        }
      }
    }
  });

  it("uses the spec's columns: 4 / 7 / 6 across on a desktop, 2 / 3 / 3 on a phone", () => {
    const across = (view: "long" | "short" | "clients", vw: number) => {
      const { boxes } = pickedLayout(view, 40, vw);
      return boxes.filter((b) => b.y === boxes[0].y).length;
    };
    expect(across("long", 1440)).toBe(4);
    expect(across("short", 1440)).toBe(7);
    expect(across("clients", 1440)).toBe(6);
    expect(across("long", 390)).toBe(2);
    expect(across("short", 390)).toBe(3);
    expect(across("clients", 390)).toBe(3);
  });

  it("draws covers at the right shape and avatars at 72", () => {
    const wide = pickedLayout("long", 4, 1440).boxes[0];
    expect(wide.w / wide.h).toBeCloseTo(16 / 9, 1);
    const tall = pickedLayout("short", 4, 1440).boxes[0];
    expect(tall.h / tall.w).toBeCloseTo(16 / 9, 1);
    const avatar = pickedLayout("clients", 4, 1440).boxes[0];
    expect([avatar.w, avatar.h]).toEqual([72, 72]);
  });

  it("starts below the title and ends below the last caption", () => {
    const { boxes, height, capW } = pickedLayout("long", 16, 1440);
    expect(boxes[0].y).toBeGreaterThan(100);
    const last = boxes[boxes.length - 1];
    expect(height).toBeGreaterThan(last.y + last.h);
    expect(capW).toBe(boxes[0].w);
  });

  it("gives clients a caption as wide as their pitch", () => {
    const { boxes, capW } = pickedLayout("clients", 10, 1440);
    expect(capW).toBeGreaterThan(boxes[0].w);
    expect(capW).toBeLessThanOrEqual(180);
  });

  it("handles no items", () => {
    const empty = pickedLayout("long", 0, 1440);
    expect(empty.boxes).toEqual([]);
    expect(empty.height).toBe(0);
  });
});

describe("stackRow", () => {
  it("is one row at 70% size against the right edge on a desktop", () => {
    const row = stackRow(8, 56, 1440);
    expect(row).toHaveLength(8);
    expect(row[0].w).toBe(39);
    expect(new Set(row.map((b) => b.y)).size).toBe(1);
    expect(row[7].x + row[7].w).toBe(1440 - 24);
    for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThan(row[i - 1].x + row[i - 1].w - 1);
  });

  it("is two rows of four on a phone, each against the right edge", () => {
    const row = stackRow(8, 44, 390);
    expect(new Set(row.map((b) => b.y)).size).toBe(2);
    expect(row[3].x + row[3].w).toBe(390 - 16);
    expect(row[7].x + row[7].w).toBe(390 - 16);
    for (const b of row) expect(b.x).toBeGreaterThan(390 / 2);
  });

  it("handles no items and one", () => {
    expect(stackRow(0, 56, 1440)).toEqual([]);
    expect(stackRow(1, 56, 390)).toHaveLength(1);
  });
});

describe("viewTitle and viewCount", () => {
  it("names the views", () => {
    expect(viewTitle("long")).toBe("Long form");
    expect(viewTitle("short")).toBe("Short form");
    expect(viewTitle("clients")).toBe("Clients");
  });

  it("counts videos and clients, singular and plural", () => {
    expect(viewCount("long", 16)).toBe("16 videos");
    expect(viewCount("short", 1)).toBe("1 video");
    expect(viewCount("clients", 10)).toBe("10 clients");
    expect(viewCount("clients", 1)).toBe("1 client");
  });
});
