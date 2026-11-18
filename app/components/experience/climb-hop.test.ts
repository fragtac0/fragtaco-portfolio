import { describe, expect, it } from "vitest";
import { HOP_MS, dipAt, hopStart, jumpNow } from "./climb-hop";

describe("the dip of a reduced-motion step", () => {
  it("shows the whole map with no dip, falls to nothing at the middle and is whole again at the end", () => {
    expect(dipAt(null, 500)).toEqual({ shown: 1, done: true });
    expect(dipAt(100, 100).shown).toBe(1);
    expect(dipAt(100, 100 + HOP_MS / 2).shown).toBe(0);
    expect(dipAt(100, 100 + HOP_MS / 4).shown).toBeCloseTo(0.5, 10);
    expect(dipAt(100, 100 + HOP_MS * 0.75).shown).toBeCloseTo(0.5, 10);
    expect(dipAt(100, 100 + HOP_MS)).toEqual({ shown: 1, done: true });
    expect(dipAt(100, 100 + HOP_MS / 2).done).toBe(false);
  });

  it("lets the camera jump only at the middle of a dip, and at once when there is none", () => {
    expect(jumpNow(null, 0)).toBe(true);
    expect(jumpNow(1000, 1000 + HOP_MS / 2 - 1)).toBe(false);
    expect(jumpNow(1000, 1000 + HOP_MS / 2)).toBe(true);
  });

  it("starts a new dip now, and carries a dip under way on from where its strength is", () => {
    expect(hopStart(null, 700)).toBe(700);

    for (const at of [20, 100, 149, 150, 200, 280]) {
      const was = dipAt(1000, 1000 + at).shown;
      const carried = dipAt(hopStart(1000, 1000 + at), 1000 + at).shown;

      expect(carried).toBeCloseTo(was, 10);
    }
    // from the second half it goes down again, so the next jump waits for its middle
    expect(jumpNow(hopStart(1000, 1000 + 250), 1000 + 250)).toBe(false);
  });
});
