import { describe, expect, it } from "vitest";
import { HEIGHT, blur3, liftOf, makeField, sampleHeight, setHeights, type HeightField } from "./heights";

/** A cone of grey, 255 at its peak, falling to 0 at `radius` cells, on a w by h grid (peak in the middle cell). */
function cone(w: number, h: number, radius: number): Uint8Array {
  const grey = new Uint8Array(w * h);
  const [cx, cy] = [(w - 1) / 2, (h - 1) / 2];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) grey[y * w + x] = Math.round(255 * Math.max(0, 1 - Math.hypot(x - cx, y - cy) / radius));
  }

  return grey;
}

describe("blur3", () => {
  it("leaves a flat field flat", () => {
    const f = new Float32Array(20 * 10).fill(7);

    blur3(f, 20, 10, 2);
    f.forEach((v) => expect(v).toBeCloseTo(7, 5));
  });

  it("spreads a point evenly and keeps the total (away from the edges)", () => {
    const [w, h] = [41, 41];
    const f = new Float32Array(w * h);

    f[20 * w + 20] = 1000;
    blur3(f, w, h, 2);
    expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 2);
    expect(f[20 * w + 20]).toBeLessThan(1000 / 20);
    expect(f[20 * w + 18]).toBeCloseTo(f[20 * w + 22], 5);
    expect(f[18 * w + 20]).toBeCloseTo(f[22 * w + 20], 5);
    expect(f[20 * w + 20 + 7]).toBeCloseTo(0, 6); // three boxes of radius 2 reach 6 cells
    expect(f[20 * w + 20 + 6]).toBeGreaterThan(0);
  });

  it("blurs a step into a ramp that rises through the middle of the step", () => {
    const [w, h] = [30, 3];
    const f = new Float32Array(w * h);

    for (let y = 0; y < h; y++) for (let x = 15; x < w; x++) f[y * w + x] = 100;
    blur3(f, w, h, 2);
    expect(f[1 * w + 14]).toBeGreaterThan(f[1 * w + 10]);
    expect(f[1 * w + 14] + f[1 * w + 15]).toBeCloseTo(100, 4);
    expect(f[1 * w + 2]).toBeCloseTo(0, 5);
    expect(f[1 * w + 27]).toBeCloseTo(100, 5);
  });

  it("does nothing at radius 0", () => {
    const f = Float32Array.from([1, 2, 3, 4, 5, 6]);

    blur3(f, 3, 2, 0);
    expect([...f]).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("makeField", () => {
  it("takes the plain as the grey at the 30th percentile, the summit as the highest and the floor as the lowest", () => {
    const grey = Array.from({ length: 100 }, (_, i) => i * 2);
    const f = makeField(grey, 10, 10, 0);

    expect(f.base).toBe(60);
    expect(f.hi).toBe(198);
    expect(f.lo).toBe(0);
    expect(f.w).toBe(10);
    expect(f.h).toBe(10);
  });

  it("blurs what it is given and does not change it", () => {
    const grey = new Uint8Array(15 * 15);

    grey[7 * 15 + 7] = 255;
    const f = makeField(grey, 15, 15);

    expect(grey[7 * 15 + 7]).toBe(255);
    expect(f.data[7 * 15 + 7]).toBeLessThan(255 / 10);
    expect(f.hi).toBeLessThan(255 / 10);
  });
});

describe("sampleHeight", () => {
  const field: HeightField = makeField(cone(41, 31, 12), 41, 31, 0);

  it("is 1 at the summit (the middle of the height frame is the summit, 500, 325)", () => {
    expect(sampleHeight(field, 500, 325)).toBeCloseTo(1, 9);
  });

  it("is 0 or below at the plain and at the frame's corners", () => {
    expect(field.base).toBe(0);
    expect(sampleHeight(field, -300, -195)).toBeCloseTo(0, 9);
    expect(sampleHeight(field, 1300, 845)).toBeCloseTo(0, 9);
  });

  it("falls from the summit", () => {
    const at = [0, 20, 40, 80, 160].map((d) => sampleHeight(field, 500 + d, 325));

    for (let i = 1; i < at.length; i++) expect(at[i]).toBeLessThan(at[i - 1]);
  });

  it("is smooth between cells (bilinear)", () => {
    // Cells are 1600/40 = 40 units apart in x.
    const [a, b] = [sampleHeight(field, 500, 325), sampleHeight(field, 540, 325)];

    expect(sampleHeight(field, 520, 325)).toBeCloseTo((a + b) / 2, 9);
  });

  it("holds the edge value outside the frame", () => {
    expect(sampleHeight(field, -5000, -5000)).toBe(sampleHeight(field, -300, -195));
    expect(sampleHeight(field, 9000, 325)).toBeCloseTo(sampleHeight(field, 1300, 325), 3);
  });

  it("is below 0 under the plain when the plain is above the lowest ground", () => {
    const f = makeField([0, 0, 0, 50, 50, 50, 50, 50, 50, 100], 5, 2, 0);

    expect(f.base).toBe(50);
    expect(sampleHeight(f, -300, -195)).toBeCloseTo(-1, 9);
  });
});

describe("setHeights", () => {
  it("sets n on each point", () => {
    const field = makeField(cone(41, 31, 12), 41, 31, 0);
    const pts = [{ x: 500, y: 325, n: 0 }, { x: -300, y: -195, n: 1 }];

    setHeights(pts, field);
    expect(pts[0].n).toBeCloseTo(1, 9);
    expect(pts[1].n).toBeCloseTo(0, 9);
  });
});

describe("liftOf", () => {
  it("is nothing on the plain or while flat, and the summit's 84 units when fully risen", () => {
    expect(liftOf(0, 1)).toBe(0);
    expect(liftOf(1, 0)).toBe(0);
    expect(liftOf(1, 1)).toBeCloseTo(HEIGHT, 9);
    expect(liftOf(0.5, 1)).toBeCloseTo(0.5 * HEIGHT, 9);
  });

  it("raises the low lines first and the summit last", () => {
    const share = (n: number, rise: number) => liftOf(n, rise) / (n * HEIGHT);

    expect(share(0.2, 0.4)).toBeGreaterThan(share(1, 0.4));
    expect(share(1, 0.55)).toBe(0); // the summit has not started: smooth(0.55, 1, 0.55)
    expect(share(0.2, 0.55)).toBeGreaterThan(0.5);
  });

  it("rises with the rise", () => {
    let last = -1;

    for (let r = 0; r <= 1.0001; r += 0.1) {
      const v = liftOf(0.7, Math.min(r, 1));

      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});
