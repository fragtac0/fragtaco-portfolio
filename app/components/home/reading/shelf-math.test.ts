import { describe, expect, it } from "vitest";
import {
  CAMERA,
  DROP,
  DROP_FALL,
  FOV_DEG,
  FRONT,
  INCH,
  STAG,
  WALLZ,
  bookSize,
  cameraAt,
  clamp,
  dropProgress,
  easeOut,
  fitCamera,
  flick,
  initialCamX,
  introSeconds,
  markerLeft,
  markerShown,
  openPhases,
  panFromDrag,
  spring,
  visibleFraction,
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
    // a wide screen and a long shelf: the width fit would be far back, so the 2.3 cap holds it
    expect(fitCamera({ fovDeg: 26, aspect: 1.6, span: 14 }).dist).toBeCloseTo(dH * 2.3, 10);
  });
  it("never goes closer than the height fit, however wide the screen", () => {
    const dH = 3.05 / 2 / Math.tan(half);
    expect(fitCamera({ fovDeg: 26, aspect: 3, span: 1.6 }).dist).toBeCloseTo(dH, 10);
  });
  it("with a real shelf (span about 2.8) a wide screen sits at the height fit and a phone at 1.3 times it", () => {
    const dH = 3.05 / 2 / Math.tan(half);
    expect(fitCamera({ fovDeg: 26, aspect: 1.6, span: 2.8 }).dist).toBeCloseTo(dH, 10);
    const phone = fitCamera({ fovDeg: 26, aspect: 0.46, span: 2.8 });
    expect(phone.dist).toBeCloseTo(dH * 1.3, 10);
    expect(phone.maxX).toBeGreaterThan(0);
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
    expect(panFromDrag(0, -200, 8.6, 844, 0.82)).toBe(0.82);
    expect(panFromDrag(0, 200, 8.6, 844, 0.82)).toBe(-0.82);
  });
  it("is today's formula inside the range", () => {
    expect(panFromDrag(0, 40, 8.6, 844, 0.82)).toBeCloseTo(-0.367, 3);
    expect(panFromDrag(0.2, -10, 8.6, 844, 0.82)).toBeCloseTo(0.2 + (10 * 8.6 * 0.9) / 844, 10);
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

describe("visibleFraction", () => {
  const span = 2.4;
  it("is 1 when the shelf fits (maxX is 0)", () => {
    const aspect = 1.6;
    const { dist, maxX } = fitCamera({ fovDeg: FOV_DEG, aspect, span });
    expect(maxX).toBe(0);
    expect(visibleFraction(dist, aspect, FOV_DEG, span)).toBe(1);
  });
  it("is the share of the shelf on screen when it is wider than the screen", () => {
    const aspect = 390 / 844;
    const { dist, maxX } = fitCamera({ fovDeg: FOV_DEG, aspect, span });
    expect(maxX).toBeGreaterThan(0);
    const f = visibleFraction(dist, aspect, FOV_DEG, span);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
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
  it("hides in the gap where the shelf can still move but is all on screen", () => {
    // needW <= visible width < needW / 0.9: maxX is above 0 and visibleFraction is 1
    let gap = 0;
    for (let aspect = 0.3; aspect <= 3; aspect += 0.01) {
      const { dist, maxX } = fitCamera({ fovDeg: FOV_DEG, aspect, span: 2.4 });
      const visible = visibleFraction(dist, aspect, FOV_DEG, 2.4);
      if (maxX > 0 && visible >= 0.999) {
        gap++;
        expect(markerShown(maxX, visible)).toBe(false);
      }
    }
    expect(gap).toBeGreaterThan(0);
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
