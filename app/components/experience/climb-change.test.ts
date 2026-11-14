import { describe, expect, it } from "vitest";
import { FADE_MS, IN_MS, OUT_MS, changeAt, kOf, startChange } from "./climb-change";

describe("startChange", () => {
  it("takes 3.6 s going in and 3.2 s coming out from the ends", () => {
    expect(startChange(0, "climb", 100, false)).toEqual({ from: 0, to: 1, t0: 100, ms: IN_MS });
    expect(startChange(1, "overview", 100, false)).toEqual({ from: 1, to: 0, t0: 100, ms: OUT_MS });
    expect([IN_MS, OUT_MS]).toEqual([3600, 3200]);
  });

  it("takes only the share of the time that is left when it turns round part of the way", () => {
    const c = startChange(0.25, "climb", 0, false);

    expect(c?.ms).toBeCloseTo(IN_MS * 0.75, 9);
    expect(startChange(0.25, "overview", 0, false)?.ms).toBeCloseTo(OUT_MS * 0.25, 9);
  });

  it("is nothing when k is already there", () => {
    expect(startChange(1, "climb", 0, false)).toBeNull();
    expect(startChange(0, "overview", 0, false)).toBeNull();
  });

  it("is the short crossfade under reduced motion, either way", () => {
    expect(startChange(0, "climb", 0, true)?.ms).toBe(FADE_MS);
    expect(startChange(1, "overview", 0, true)?.ms).toBe(FADE_MS);
  });

  it("knows each mode's k", () => {
    expect([kOf("overview"), kOf("climb")]).toEqual([0, 1]);
  });
});

describe("changeAt", () => {
  const c = startChange(0, "climb", 1000, false)!;

  it("starts at from, ends at to and is done only then", () => {
    expect(changeAt(c, 1000)).toEqual({ k: 0, done: false });
    expect(changeAt(c, 1000 + IN_MS)).toEqual({ k: 1, done: true });
    expect(changeAt(c, 1000 + 10 * IN_MS)).toEqual({ k: 1, done: true });
    expect(changeAt(c, 0).k).toBe(0);
  });

  it("is half way at half the time and only ever rises on the way in, with no overshoot", () => {
    expect(changeAt(c, 1000 + IN_MS / 2).k).toBeCloseTo(0.5, 12);
    let last = 0;

    for (let t = 0; t <= IN_MS; t += 16) {
      const { k } = changeAt(c, 1000 + t);

      expect(k).toBeGreaterThanOrEqual(last - 1e-12);
      expect(k).toBeLessThanOrEqual(1);
      last = k;
    }
  });

  it("only ever falls on the way out", () => {
    const out = startChange(1, "overview", 0, false)!;
    let last = 1;

    for (let t = 0; t <= OUT_MS; t += 16) {
      const { k } = changeAt(out, t);

      expect(k).toBeLessThanOrEqual(last + 1e-12);
      last = k;
    }
    expect(last).toBe(0);
  });
});
