import { describe, expect, it } from "vitest";
import { arrival, arrivalOf, echoSet } from "./wall-math";

describe("echoSet", () => {
  const videos = [
    { channel: "a" },
    { channel: "b" },
    { channel: "c" },
    { channel: "d" },
    { channel: "a" },
    { channel: "e" },
    { channel: "f" },
    { channel: "a" },
    { channel: "g" },
    { channel: "h" },
  ];

  it("holds the other videos from the focused video's channel", () => {
    expect([...echoSet(videos, 0)].sort()).toEqual([4, 7]);
    expect([...echoSet(videos, 4)].sort()).toEqual([0, 7]);
  });

  it("is empty for a channel with a single video", () => {
    expect(echoSet(videos, 1).size).toBe(0);
  });

  it("is empty when nothing is focused or the index is out of range", () => {
    expect(echoSet(videos, null).size).toBe(0);
    expect(echoSet(videos, -1).size).toBe(0);
    expect(echoSet(videos, 10).size).toBe(0);
  });
});

describe("arrival", () => {
  it("starts invisible and a little small", () => {
    expect(arrival(0, 0, 300)).toEqual({ alpha: 0, scale: 0.96 });
  });

  it("settles in 300 ms at the centre", () => {
    expect(arrival(300, 0, 300)).toEqual({ alpha: 1, scale: 1 });
    expect(arrival(5000, 0, 300)).toEqual({ alpha: 1, scale: 1 });
  });

  it("eases in between", () => {
    const a = arrival(150, 0, 300);
    expect(a.alpha).toBeGreaterThan(0);
    expect(a.alpha).toBeLessThan(1);
    expect(a.scale).toBeGreaterThan(0.96);
    expect(a.scale).toBeLessThan(1);
    expect(arrival(200, 0, 300).alpha).toBeGreaterThan(a.alpha);
  });

  it("waits 40 ms per pitch from the centre before starting", () => {
    expect(arrival(100, 900, 300)).toEqual({ alpha: 0, scale: 0.96 });
    expect(arrival(120, 900, 300)).toEqual({ alpha: 0, scale: 0.96 });
    expect(arrival(121, 900, 300).alpha).toBeGreaterThan(0);
    expect(arrival(420, 900, 300)).toEqual({ alpha: 1, scale: 1 });
  });

  it("caps the wait at 600 ms", () => {
    expect(arrival(600, 300 * 1000, 300)).toEqual({ alpha: 0, scale: 0.96 });
    expect(arrival(900, 300 * 1000, 300)).toEqual({ alpha: 1, scale: 1 });
  });

  it("treats a non-finite time as zero and a negative distance as the centre", () => {
    expect(arrival(NaN, 0, 300)).toEqual({ alpha: 0, scale: 0.96 });
    expect(arrival(300, -900, 300)).toEqual({ alpha: 1, scale: 1 });
    expect(arrival(0, -900, 300)).toEqual({ alpha: 0, scale: 0.96 });
    expect(arrival(300, NaN, 300)).toEqual({ alpha: 1, scale: 1 });
    expect(arrival(Infinity, 0, 300)).toEqual({ alpha: 1, scale: 1 });
  });

  it("never divides by a zero pitch", () => {
    expect(arrival(300, 500, 0)).toEqual({ alpha: 1, scale: 1 });
  });
});

describe("arrivalOf", () => {
  const base = { now: 1000, distanceFromCentre: 0, pitch: 300, reduced: false };

  it("has no arrival for a thumbnail that is not up (the placeholder shows)", () => {
    expect(arrivalOf({ ...base, loadedAt: 0 }).loaded).toBe(false);
    expect(arrivalOf({ ...base, loadedAt: Number.NaN }).loaded).toBe(false);
    expect(arrivalOf({ ...base, loadedAt: undefined as unknown as number }).loaded).toBe(false);
  });

  it("starts invisible and small, and ends opaque and full size", () => {
    const start = arrivalOf({ ...base, loadedAt: 1000 });
    expect(start).toEqual({ loaded: true, alpha: 0, scale: 0.96 });
    const end = arrivalOf({ ...base, loadedAt: 600 });
    expect(end).toEqual({ loaded: true, alpha: 1, scale: 1 });
  });

  it("waits longer the further the tile is from the centre", () => {
    const mid = { ...base, loadedAt: 900 };
    const centre = arrivalOf({ ...mid, distanceFromCentre: 0 });
    const out = arrivalOf({ ...mid, distanceFromCentre: 900 });
    expect(centre.alpha).toBeGreaterThan(out.alpha);
    expect(out.alpha).toBe(0);
  });

  it("just appears with reduced motion", () => {
    expect(arrivalOf({ ...base, loadedAt: 1000, reduced: true })).toEqual({
      loaded: true,
      alpha: 1,
      scale: 1,
    });
  });
});
