import { describe, expect, it } from "vitest";
import {
  DROP,
  DROP_FALL,
  FRONT,
  INCH,
  STAG,
  WALLZ,
  bookSize,
  clamp,
  dropProgress,
  easeOut,
  flick,
  initialCamX,
  introSeconds,
  markerLeft,
  markerShown,
  panFromDrag,
  spring,
  wheelPanPx,
} from "./shelf-math";

describe("constants", () => {
  it("carries the mockup values", () => {
    expect(INCH).toBe(0.17);
    expect(FRONT).toBe(0.55);
    expect(WALLZ).toBeCloseTo(-0.85, 10);
    expect(DROP).toBe(1.5);
    expect(STAG).toBe(0.09);
    expect(DROP_FALL).toBe(0.6);
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

describe("clamp", () => {
  it("limits to 0..1 by default", () => {
    expect(clamp(-0.5)).toBe(0);
    expect(clamp(0.4)).toBe(0.4);
    expect(clamp(7)).toBe(1);
  });
  it("limits to a given range", () => {
    expect(clamp(10, 28, 64)).toBe(28);
    expect(clamp(40, 28, 64)).toBe(40);
    expect(clamp(99, 28, 64)).toBe(64);
    expect(clamp(-3, -2, 2)).toBe(-2);
  });
});

describe("initialCamX", () => {
  it("starts at the left end on a narrow screen so the first book is whole", () => {
    expect(initialCamX(0.8, true)).toBe(-0.8);
  });
  it("is centred otherwise", () => {
    expect(initialCamX(0.8, false)).toBe(0);
    expect(initialCamX(0, true)).toBeCloseTo(0, 10);
  });
});

describe("panFromDrag", () => {
  it("drags the shelf with the pointer and clamps at the ends", () => {
    expect(panFromDrag(0, -200, 400, 0.3)).toBe(0.3);
    expect(panFromDrag(0, 200, 400, 0.3)).toBe(-0.3);
  });
  it("follows the pointer one to one inside the range", () => {
    // 40 px at 400 px per unit is 0.1 units, against the drag
    expect(panFromDrag(0, 40, 400, 0.82)).toBeCloseTo(-0.1, 10);
    expect(panFromDrag(0.2, -10, 400, 0.82)).toBeCloseTo(0.225, 10);
  });
});

describe("flick", () => {
  it("loses about 5 percent of its speed in a 60 fps frame", () => {
    const f = flick(1, 1 / 60);
    expect(f.v).toBeCloseTo(0.951, 3);
    expect(f.dx).toBeCloseTo(f.v / 60, 10);
  });
  it("settles to exactly 0 and stays there", () => {
    let v = 1;
    let travelled = 0;
    for (let i = 0; i < 200; i++) {
      const f = flick(v, 1 / 60);
      v = f.v;
      travelled += f.dx;
    }
    expect(v).toBe(0);
    expect(travelled).toBeGreaterThan(0);
    expect(flick(0, 1 / 60)).toEqual({ dx: 0, v: 0 });
  });
  it("coasts the same way to the left", () => {
    expect(flick(-1, 1 / 60).v).toBeCloseTo(-0.951, 3);
    expect(flick(-0.01, 1 / 60).v).toBe(0);
  });
});

describe("markerLeft", () => {
  it("runs from the left end of the track to the right end", () => {
    expect(markerLeft(-0.8, 0.8, 0.4)).toBe(0);
    expect(markerLeft(0.8, 0.8, 0.4)).toBeCloseTo(0.6, 10);
    expect(markerLeft(0, 0.8, 0.4)).toBeCloseTo(0.3, 10);
  });
  it("is 0 when there is nowhere to go", () => {
    expect(markerLeft(0, 0, 1)).toBe(0);
  });
});

describe("markerShown", () => {
  it("hides when the shelf does not move or the thumb would fill the track", () => {
    expect(markerShown(0, 1)).toBe(false);
    expect(markerShown(0.3, 1)).toBe(false);
    expect(markerShown(0.3, 0.9995)).toBe(false);
  });
  it("shows when there is somewhere to go and the thumb is shorter than the track", () => {
    expect(markerShown(0.3, 0.8)).toBe(true);
  });
});

describe("wheelPanPx", () => {
  it("pans on a mostly horizontal wheel", () => {
    expect(wheelPanPx(30, 4, false)).toBe(30);
    expect(wheelPanPx(-30, 4, false)).toBe(-30);
  });
  it("pans with the vertical delta while shift is held", () => {
    expect(wheelPanPx(0, 40, true)).toBe(40);
  });
  it("leaves a vertical wheel alone", () => {
    expect(wheelPanPx(3, 40, false)).toBeNull();
    expect(wheelPanPx(0, 0, false)).toBeNull();
  });
});
