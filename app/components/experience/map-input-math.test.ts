import { describe, expect, it } from "vitest";
import {
  arrowStep, enterAt, isArrow, isDoubleTap, keyAction, modeOf, panView, pinchEnd, pinchView, stepAction, wheelAction,
  wheelFactor, DOUBLE_TAP_MS, PAN_SPEED, ZOOM_STEP,
} from "./map-input-math";
import { EXPLORE_MIN, fitScale, fitView, MAX_SCALE, type View } from "./view";

const M = { size: 8192 };
const VW = 1440;
const VH = 900;
const fit = fitView(VW, VH, M);
const explore: View = { ...fit, scale: fit.scale * EXPLORE_MIN };
const deep: View = { cx: 3000, cy: 3000, scale: 0.6 };

describe("modeOf", () => {
  it("is the overview at the fit scale and explore above it", () => {
    expect(modeOf(fit, VW, VH, M)).toBe("overview");
    expect(modeOf(explore, VW, VH, M)).toBe("explore");
    expect(modeOf({ ...fit, scale: fit.scale * 1.01 }, VW, VH, M)).toBe("overview");
  });
});

describe("wheelFactor", () => {
  it("zooms in for a negative delta and out for a positive one, by the same amount each way", () => {
    expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0, false)).toBeLessThan(1);
    expect(wheelFactor(-100, 0, false) * wheelFactor(100, 0, false)).toBeCloseTo(1, 9);
  });

  it("counts a line wheel and a pinch for more, and caps a huge delta", () => {
    expect(wheelFactor(-3, 1, false)).toBeGreaterThan(wheelFactor(-3, 0, false));
    expect(wheelFactor(-5, 0, true)).toBeGreaterThan(wheelFactor(-5, 0, false));
    expect(wheelFactor(-100000, 0, false)).toBeCloseTo(wheelFactor(-240, 0, false), 9);
  });
});

describe("wheelAction", () => {
  it("from the overview, a wheel in enters explore about the pointer and a wheel out does nothing", () => {
    const a = wheelAction(fit, 1.2, 100, -50, VW, VH, M);

    expect(a.kind).toBe("enter");
    if (a.kind === "enter") {
      expect(a.view.scale).toBeCloseTo(fit.scale * EXPLORE_MIN, 9);
      // the picture point under the pointer did not move on screen
      const before = fit.cx + 100 / fit.scale;
      const after = a.view.cx + 100 / a.view.scale;

      expect(after).toBeCloseTo(before, 6);
    }
    expect(wheelAction(fit, 0.8, 0, 0, VW, VH, M).kind).toBe("none");
  });

  it("in explore, zooms about the pointer and keeps the screen inside the picture", () => {
    const a = wheelAction(deep, 1.1, 200, 100, VW, VH, M);

    expect(a.kind).toBe("view");
    if (a.kind === "view") {
      expect(a.view.scale).toBeCloseTo(0.66, 9);
      expect(a.view.cx + 200 / a.view.scale).toBeCloseTo(deep.cx + 200 / deep.scale, 6);
    }
  });

  it("stops at the native scale", () => {
    const top: View = { cx: 4000, cy: 4000, scale: MAX_SCALE };

    expect(wheelAction(top, 1.3, 0, 0, VW, VH, M).kind).toBe("none");
    const near = wheelAction({ ...top, scale: 0.95 }, 1.3, 0, 0, VW, VH, M);

    expect(near.kind === "view" && near.view.scale).toBe(MAX_SCALE);
  });

  it("zooming out past the start of explore goes back to the overview, and just above it does not", () => {
    expect(wheelAction(explore, 0.9, 0, 0, VW, VH, M).kind).toBe("fit");
    expect(wheelAction({ ...explore, scale: explore.scale * 1.2 }, 0.9, 0, 0, VW, VH, M).kind).toBe("view");
    expect(wheelAction({ ...explore, scale: explore.scale * 1.2 }, 0.8, 0, 0, VW, VH, M).kind).toBe("fit");
  });
});

describe("stepAction", () => {
  it("+ from the overview enters explore at the centre, - from explore at the start goes back, - from deeper steps out", () => {
    const a = stepAction(fit, ZOOM_STEP, 0, 0, VW, VH, M);

    expect(a.kind).toBe("enter");
    expect(stepAction(explore, 1 / ZOOM_STEP, 0, 0, VW, VH, M).kind).toBe("fit");
    const b = stepAction(deep, 1 / ZOOM_STEP, 0, 0, VW, VH, M);

    expect(b.kind === "view" && b.view.scale).toBeCloseTo(0.6 / ZOOM_STEP, 9);
  });
});

describe("enterAt", () => {
  it("at the overview's own centre leaves the picture centred", () => {
    const v = enterAt(VW, VH, M, 0, 0);

    expect(v.cx).toBeCloseTo(4096, 6);
    expect(v.cy).toBeCloseTo(4096, 6);
  });

  it("never shows outside the picture, even for a pointer at a corner", () => {
    const v = enterAt(VW, VH, M, 700, 440);
    const halfW = VW / (2 * v.scale);
    const halfH = VH / (2 * v.scale);

    expect(v.cx + halfW).toBeLessThanOrEqual(8192 + 1e-6);
    expect(v.cy + halfH).toBeLessThanOrEqual(8192 + 1e-6);
    expect(v.cx - halfW).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe("panView", () => {
  it("moves the picture with the pointer: dragging right shows what is to the left", () => {
    const v = panView(deep, 50, -20, VW, VH, M);

    expect(v.cx).toBeCloseTo(deep.cx - 50 / deep.scale, 9);
    expect(v.cy).toBeCloseTo(deep.cy + 20 / deep.scale, 9);
  });

  it("stops at the frame on every side", () => {
    const halfW = VW / (2 * deep.scale);
    const halfH = VH / (2 * deep.scale);
    const left = panView(deep, 1e7, 0, VW, VH, M);
    const right = panView(deep, -1e7, 0, VW, VH, M);
    const top = panView(deep, 0, 1e7, VW, VH, M);
    const bottom = panView(deep, 0, -1e7, VW, VH, M);

    expect(left.cx).toBeCloseTo(halfW, 6);
    expect(right.cx).toBeCloseTo(8192 - halfW, 6);
    expect(top.cy).toBeCloseTo(halfH, 6);
    expect(bottom.cy).toBeCloseTo(8192 - halfH, 6);
  });
});

describe("pinchView", () => {
  const mid = { x: 40, y: -30 };

  it("with the fingers where they were, is the start view", () => {
    const v = pinchView(deep, 200, mid, 200, mid, VW, VH, M);

    expect(v.cx).toBeCloseTo(deep.cx, 6);
    expect(v.cy).toBeCloseTo(deep.cy, 6);
    expect(v.scale).toBeCloseTo(deep.scale, 9);
  });

  it("spreading the fingers zooms in about their midpoint, keeping the picture point under it", () => {
    const v = pinchView(deep, 200, mid, 260, mid, VW, VH, M);

    expect(v.scale).toBeCloseTo(0.78, 9);
    expect(v.cx + mid.x / v.scale).toBeCloseTo(deep.cx + mid.x / deep.scale, 6);
    expect(v.cy + mid.y / v.scale).toBeCloseTo(deep.cy + mid.y / deep.scale, 6);
  });

  it("moving both fingers pans", () => {
    const v = pinchView(deep, 200, mid, 200, { x: mid.x + 60, y: mid.y }, VW, VH, M);

    expect(v.cx).toBeCloseTo(deep.cx - 60 / deep.scale, 6);
  });

  it("stays between the fit scale and the native scale", () => {
    expect(pinchView(deep, 200, mid, 1, mid, VW, VH, M).scale).toBeCloseTo(fitScale(VW, VH, M), 9);
    expect(pinchView(deep, 200, mid, 1e6, mid, VW, VH, M).scale).toBe(MAX_SCALE);
  });
});

describe("pinchEnd", () => {
  it("a pinch that began in the overview goes on into explore when it got far enough, and back when it did not", () => {
    expect(pinchEnd("overview", { ...fit, scale: fit.scale * 1.1 }, VW, VH, M).kind).toBe("fit");
    const a = pinchEnd("overview", { ...fit, scale: fit.scale * 1.5 }, VW, VH, M);

    expect(a.kind).toBe("enter");
    if (a.kind === "enter") expect(a.view.scale).toBeCloseTo(fit.scale * EXPLORE_MIN, 9);
    expect(pinchEnd("overview", deep, VW, VH, M).kind).toBe("none");
  });

  it("a pinch that began in explore goes back to the overview only when it ended below the start of explore", () => {
    expect(pinchEnd("explore", { ...explore, scale: explore.scale * 0.9 }, VW, VH, M).kind).toBe("fit");
    expect(pinchEnd("explore", explore, VW, VH, M).kind).toBe("none");
    expect(pinchEnd("explore", deep, VW, VH, M).kind).toBe("none");
  });
});

describe("isDoubleTap", () => {
  const a = { t: 1000, x: 100, y: 100 };

  it("is two taps close in time and place", () => {
    expect(isDoubleTap(a, { t: 1000 + DOUBLE_TAP_MS, x: 110, y: 105 })).toBe(true);
    expect(isDoubleTap(a, { t: 1000 + DOUBLE_TAP_MS + 1, x: 100, y: 100 })).toBe(false);
    expect(isDoubleTap(a, { t: 1100, x: 200, y: 100 })).toBe(false);
    expect(isDoubleTap(null, a)).toBe(false);
  });
});

describe("keyAction", () => {
  it("names the map's keys", () => {
    expect(["+", "=", "-", "_", "0", "Escape", "[", "]", "a", "Enter", "ArrowUp"].map(keyAction)).toEqual([
      "in", "in", "out", "out", "fit", "fit", "prev", "next", null, null, null,
    ]);
  });
});

describe("arrowStep", () => {
  it("moves at the pan speed, in the arrow's direction", () => {
    expect(isArrow("ArrowLeft")).toBe(true);
    expect(isArrow("a")).toBe(false);
    const s = arrowStep(new Set(["ArrowRight"]), 16);

    expect(s.dx).toBeCloseTo((PAN_SPEED * 16) / 1000, 9);
    expect(s.dy).toBe(0);
  });

  it("is no faster along a diagonal, cancels opposite keys, and caps a long frame", () => {
    const d = arrowStep(new Set(["ArrowRight", "ArrowDown"]), 16);

    expect(Math.hypot(d.dx, d.dy)).toBeCloseTo((PAN_SPEED * 16) / 1000, 9);
    expect(arrowStep(new Set(["ArrowRight", "ArrowLeft"]), 16)).toEqual({ dx: 0, dy: 0 });
    expect(arrowStep(new Set(["ArrowDown"]), 5000).dy).toBeCloseTo((PAN_SPEED * 50) / 1000, 9);
    expect(arrowStep(new Set(), 16)).toEqual({ dx: 0, dy: 0 });
  });
});
