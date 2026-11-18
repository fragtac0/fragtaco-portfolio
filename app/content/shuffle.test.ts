import { describe, expect, it } from "vitest";
import { shuffled } from "./shuffle";

describe("shuffled", () => {
  const items = Array.from({ length: 109 }, (_, i) => i);

  it("keeps every item exactly once and does not change its input", () => {
    const copy = [...items];
    const out = shuffled(items, 7);

    expect(out).toHaveLength(109);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(copy);
  });

  it("gives the same order for the same seed, every run", () => {
    expect(shuffled(items, 7)).toEqual(shuffled(items, 7));
  });

  it("gives another order for another seed, and moves things", () => {
    expect(shuffled(items, 7)).not.toEqual(shuffled(items, 8));
    expect(shuffled(items, 7)).not.toEqual(items);
  });

  it("handles empty and single lists", () => {
    expect(shuffled([], 1)).toEqual([]);
    expect(shuffled(["a"], 1)).toEqual(["a"]);
  });
});
