import { describe, expect, it } from "vitest";
import {
  CAMERA,
  DROP,
  FRONT,
  INCH,
  STAG,
  WALLZ,
  bookSize,
  cameraAt,
  dropProgress,
  easeOut,
  fitCamera,
  introSeconds,
  openPhases,
  spring,
} from "./shelf-math";

describe("constants", () => {
  it("carries the mockup values", () => {
    expect(INCH).toBe(0.17);
    expect(FRONT).toBe(0.55);
    expect(WALLZ).toBeCloseTo(-0.85, 10);
    expect(DROP).toBe(1.5);
    expect(STAG).toBe(0.09);
    expect(CAMERA).toEqual({
      lookY: 0.88,
      lift: 0.1,
      tilt: 0.09,
      dollyFrom: 1.12,
      dollyS: 2.6,
    });
  });
});

describe("introSeconds", () => {
  it("is the last book's start plus the drop", () => {
    expect(introSeconds(14)).toBeCloseTo(2.92, 10);
    expect(introSeconds(1)).toBeCloseTo(1.75, 10);
  });
});

describe("bookSize", () => {
  it("sizes an 11 in, 0.73 aspect, 176 page book", () => {
    const { H, W, T } = bookSize({ heightIn: 11, aspect: 0.73, pages: 176 });
    expect(H).toBeCloseTo(1.87, 10);
    expect(W).toBeCloseTo(1.3651, 10);
    expect(T).toBeCloseTo(0.11948, 10);
  });
});

describe("dropProgress", () => {
  it("is clamped to 0..1", () => {
    expect(dropProgress(0, 0)).toBe(0);
    expect(dropProgress(10, 13)).toBe(1);
    expect(dropProgress(-5, 0)).toBe(0);
  });
  it("waits for the stagger and runs over DROP seconds", () => {
    expect(dropProgress(0.25 + 3 * STAG, 3)).toBe(0);
    expect(dropProgress(0.25 + 3 * STAG + DROP / 2, 3)).toBeCloseTo(0.5, 10);
    expect(dropProgress(0.25 + 3 * STAG + DROP, 3)).toBe(1);
  });
});

describe("easeOut", () => {
  it("is a cubic ease-out", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.875, 10);
  });
});

describe("spring", () => {
  const run = (to: number, w: number, seconds: number) => {
    const o: Record<string, number> = { x: 0 };
    const dt = 1 / 60;
    let peak = 0;
    let settledAt = -1;
    let moving = true;
    for (let i = 1; i <= Math.round(seconds * 60); i++) {
      moving = spring(o, "x", to, w, dt);
      peak = Math.max(peak, o.x);
      if (!moving && settledAt < 0) settledAt = i * dt;
    }
    return { o, peak, settledAt, moving };
  };

  it("never overshoots and settles at the target", () => {
    const { o, peak, settledAt } = run(1, 9, 3);
    expect(peak).toBeLessThanOrEqual(1);
    expect(o.x).toBe(1);
    expect(o.xV).toBe(0);
    expect(settledAt).toBeGreaterThan(0);
  });

  it("reaches the target within the settle bound, then returns false", () => {
    const { settledAt } = run(1, 9, 3);
    expect(settledAt).toBeLessThanOrEqual(1.2);
    const o: Record<string, number> = { x: 1, xV: 0 };
    expect(spring(o, "x", 1, 9, 1 / 60)).toBe(false);
  });

  it("starts from rest and reports movement", () => {
    const o: Record<string, number> = { x: 0 };
    expect(spring(o, "x", 1, 9, 1 / 60)).toBe(true);
    expect(o.x).toBeGreaterThan(0);
    expect(o.xV).toBeGreaterThan(0);
  });
});

describe("fitCamera", () => {
  const half = (26 / 2) * (Math.PI / 180);
  it("is at least the distance that fits the needed height", () => {
    const { dist } = fitCamera({ fovDeg: 26, aspect: 1.6, span: 1.6 });
    expect(dist).toBeGreaterThanOrEqual(3.05 / 2 / Math.tan(half));
  });
  it("has no pan range when the shelf fits", () => {
    expect(fitCamera({ fovDeg: 26, aspect: 1.6, span: 1.6 }).maxX).toBe(0);
  });
  it("has a pan range on a narrow viewport", () => {
    expect(fitCamera({ fovDeg: 26, aspect: 0.46, span: 14 }).maxX).toBeGreaterThan(0);
  });
  it("keeps the height fit as a floor and caps the pull-back", () => {
    const dH = 3.05 / 2 / Math.tan(half);
    expect(fitCamera({ fovDeg: 26, aspect: 0.46, span: 14 }).dist).toBeCloseTo(dH * 1.3, 10);
    expect(fitCamera({ fovDeg: 26, aspect: 1.6, span: 14 }).dist).toBeLessThanOrEqual(dH * 2.3 + 1e-9);
  });
});

describe("cameraAt", () => {
  it("starts pulled back and settles at the fitted distance", () => {
    const start = cameraAt(0, 10);
    expect(start.distance).toBeCloseTo(11.2, 10);
    expect(start.lookY).toBe(0.88);
    expect(start.y).toBeCloseTo(0.98 + 11.2 * 0.09, 10);
    const end = cameraAt(5, 10);
    expect(end.distance).toBeCloseTo(10, 10);
    expect(end.y).toBeCloseTo(0.98 + 10 * 0.09, 10);
  });
  it("eases through the dolly", () => {
    expect(cameraAt(1.3, 10).distance).toBeCloseTo(10 * (1.12 - 0.12 * 0.875), 10);
  });
});

describe("openPhases", () => {
  it("is closed at 0, pulled out at the split, fully open at 1", () => {
    expect(openPhases(0)).toEqual({ pull: 0, present: 0 });
    expect(openPhases(0.38)).toEqual({ pull: 1, present: 0 });
    expect(openPhases(1)).toEqual({ pull: 1, present: 1 });
  });
  it("never turns while it is still sliding out", () => {
    for (let o = 0; o <= 0.38; o += 0.01) expect(openPhases(o).present).toBe(0);
  });
  it("is fully pulled out before it starts to turn", () => {
    for (let o = 0.38; o <= 1; o += 0.01) expect(openPhases(o).pull).toBe(1);
  });
  it("only ever moves forward as o rises", () => {
    let last = openPhases(0);
    for (let i = 1; i <= 200; i++) {
      const cur = openPhases(i / 200);
      expect(cur.pull).toBeGreaterThanOrEqual(last.pull);
      expect(cur.present).toBeGreaterThanOrEqual(last.present);
      last = cur;
    }
  });
  it("clamps o outside 0..1", () => {
    expect(openPhases(-0.5)).toEqual({ pull: 0, present: 0 });
    expect(openPhases(1.5)).toEqual({ pull: 1, present: 1 });
  });
});
