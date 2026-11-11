import { describe, expect, it } from "vitest";
import {
  PLANE,
  SPEED,
  arrival,
  columnOffset,
  echoSet,
  parallaxShift,
  planeOf,
} from "./wall-math";

describe("far plane speed", () => {
  const rate = (cx: number) => columnOffset(20, cx) - columnOffset(10, cx);

  it("advances a far column at 0.6 times the pre-plane rate", () => {
    // before the planes an odd column ran at -0.72 times an even one
    const before = rate(0) * -0.72;
    expect(rate(1) / before).toBeCloseTo(0.6, 10);
    expect(rate(-3) / before).toBeCloseTo(0.6, 10);
  });

  it("leaves near columns at full speed", () => {
    expect(rate(0)).toBeCloseTo(10 * SPEED);
    expect(rate(2)).toBeCloseTo(rate(0));
  });
});

describe("planeOf", () => {
  it("puts odd columns on the far plane, negative ones included", () => {
    expect(planeOf(0)).toBe("near");
    expect(planeOf(1)).toBe("far");
    expect(planeOf(2)).toBe("near");
    expect(planeOf(-1)).toBe("far");
    expect(planeOf(-2)).toBe("near");
    expect(planeOf(-7)).toBe("far");
  });

  it("holds the plane values the design calls for", () => {
    expect(PLANE.far).toEqual({
      scale: 0.86,
      dim: 0.82,
      speed: 0.6,
      bias: 0.6,
      parallax: 0.5,
    });
    expect(PLANE.near).toEqual({
      scale: 1,
      dim: 1,
      speed: 1,
      bias: 0,
      parallax: 1,
    });
  });
});

describe("parallaxShift", () => {
  it("is zero with no pointer", () => {
    expect(parallaxShift(null, 1440, 900, PLANE.near)).toEqual({ x: 0, y: 0 });
    expect(parallaxShift(null, 1440, 900, PLANE.far)).toEqual({ x: 0, y: 0 });
  });

  it("is zero with the pointer at the centre", () => {
    const s = parallaxShift({ x: 720, y: 450 }, 1440, 900, PLANE.near);
    expect(s.x).toBeCloseTo(0, 10);
    expect(s.y).toBeCloseTo(0, 10);
  });

  it("leans 14 by 10 px against the pointer on the near plane", () => {
    expect(parallaxShift({ x: 0, y: 0 }, 1440, 900, PLANE.near)).toEqual({
      x: 14,
      y: 10,
    });
    expect(parallaxShift({ x: 1440, y: 900 }, 1440, 900, PLANE.near)).toEqual({
      x: -14,
      y: -10,
    });
  });

  it("never leans past the edge for a pointer outside the window", () => {
    expect(parallaxShift({ x: -500, y: -500 }, 1440, 900, PLANE.near)).toEqual(
      { x: 14, y: 10 },
    );
    expect(
      parallaxShift({ x: 9000, y: 9000 }, 1440, 900, PLANE.near),
    ).toEqual({ x: -14, y: -10 });
  });

  it("is zero for a zero-sized or non-finite viewport or pointer", () => {
    expect(parallaxShift({ x: 5, y: 5 }, 0, 900, PLANE.near)).toEqual({
      x: 0,
      y: 0,
    });
    expect(parallaxShift({ x: 5, y: 5 }, 1440, 0, PLANE.near)).toEqual({
      x: 0,
      y: 0,
    });
    expect(parallaxShift({ x: NaN, y: 5 }, 1440, 900, PLANE.near)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("leans the far plane half as much", () => {
    expect(parallaxShift({ x: 0, y: 0 }, 1440, 900, PLANE.far)).toEqual({
      x: 7,
      y: 5,
    });
  });
});

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
