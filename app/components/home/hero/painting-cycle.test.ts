import { describe, expect, it } from "vitest";
import {
  RECENT_KEY,
  RECENT_LIMIT,
  makeOrder,
  nextDelayMs,
  paintingSrc,
  parseFocal,
  pickFirst,
} from "./painting-cycle";

describe("parseFocal", () => {
  it("reads percentages as fractions", () => {
    expect(parseFocal("50% 30%")).toEqual([0.5, 0.3]);
  });
  it("falls back to the centre", () => {
    expect(parseFocal("bogus")).toEqual([0.5, 0.5]);
  });
});

describe("pickFirst", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("avoids recent ids", () => {
    for (const r of [0, 0.3, 0.5, 0.99]) {
      expect(pickFirst(items, ["a", "c"], () => r).id).toBe("b");
    }
  });
  it("picks from all when everything is recent", () => {
    expect(pickFirst(items, ["a", "b", "c"], () => 0).id).toBe("a");
    expect(pickFirst(items, ["a", "b", "c"], () => 0.99).id).toBe("c");
  });
});

describe("makeOrder", () => {
  it("is a permutation starting with first", () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const o = makeOrder(5, 3, r);
    expect(o[0]).toBe(3);
    expect([...o].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it("handles a single item", () => {
    expect(makeOrder(1, 0, () => 0.5)).toEqual([0]);
  });
});

describe("nextDelayMs", () => {
  it("spans 15 to 20 seconds", () => {
    expect(nextDelayMs(() => 0)).toBe(15000);
    expect(nextDelayMs(() => 0.999)).toBeLessThan(20000);
  });
});

describe("paintingSrc", () => {
  it("uses 1600 on small effective widths", () => {
    expect(paintingSrc("a.jpg", 375, 3)).toBe("/paintings/1600/a.jpg");
  });
  it("uses 2560 on large ones", () => {
    expect(paintingSrc("a.jpg", 1440, 2)).toBe("/paintings/2560/a.jpg");
  });
});

describe("constants", () => {
  it("matches the existing recent rule", () => {
    expect(RECENT_KEY).toBe("heroRecentPaintings");
    expect(RECENT_LIMIT).toBe(3);
  });
});
