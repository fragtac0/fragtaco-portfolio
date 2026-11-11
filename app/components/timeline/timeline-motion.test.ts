import { describe, expect, it } from "vitest";
import { clampView, zoomAt } from "./timeline-math";
import {
  easeOutCubic,
  fitInsets,
  fitWithInsets,
  isTypingTarget,
  lerpView,
  MAX_SCALE,
  moveFocus,
  pulseAlpha,
  PULSE_MS,
  revealCell,
  sameView,
  wheelIntent,
  wheelZoomFactor,
} from "./timeline-motion";

describe("easeOutCubic", () => {
  it("runs from 0 to 1, fast at first, and stays inside 0 to 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeOutCubic(9)).toBe(1);
  });
});

describe("lerpView", () => {
  it("moves scale and position together", () => {
    const a = { scale: 10, x: 0, y: 100 };
    const b = { scale: 30, x: 200, y: 0 };
    expect(lerpView(a, b, 0)).toEqual(a);
    expect(lerpView(a, b, 1)).toEqual(b);
    expect(lerpView(a, b, 0.5)).toEqual({ scale: 20, x: 100, y: 50 });
  });

  it("keeps the point under the pointer still all the way through a zoom", () => {
    const from = { scale: 12, x: 100, y: 60 };
    const to = zoomAt(from, 3, 640, 360, 4, 72);
    const cellAtPointer = (v: typeof from) => (640 - v.x) / v.scale;
    for (const t of [0, 0.25, 0.5, 0.9, 1]) {
      expect(cellAtPointer(lerpView(from, to, t))).toBeCloseTo(cellAtPointer(from), 6);
    }
  });
});

describe("pulseAlpha", () => {
  it("breathes between 70% and 100% over 2.4 s", () => {
    expect(pulseAlpha(0)).toBeCloseTo(1, 6);
    expect(pulseAlpha(PULSE_MS / 2)).toBeCloseTo(0.7, 6);
    expect(pulseAlpha(PULSE_MS)).toBeCloseTo(1, 6);
    for (let t = 0; t < 5000; t += 37) {
      expect(pulseAlpha(t)).toBeGreaterThanOrEqual(0.7 - 1e-9);
      expect(pulseAlpha(t)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});

describe("fitInsets and fitWithInsets", () => {
  it("keeps the label block clear on wide screens and the label row clear on phones", () => {
    expect(fitInsets(1440).left).toBeGreaterThan(300);
    expect(fitInsets(390)).toEqual({ top: 100, right: 12, bottom: 100, left: 12 });
    expect(fitInsets(699).left).toBe(12);
    expect(fitInsets(700).left).toBe(360);
  });

  it("fits every row and column of the grid inside the insets, centred in what is left", () => {
    const insets = fitInsets(1440);
    const view = fitWithInsets(56, 39, 1440, 900, insets);
    expect(view.x).toBeGreaterThanOrEqual(insets.left - 0.001);
    expect(view.y).toBeGreaterThanOrEqual(insets.top - 0.001);
    expect(view.x + 56 * view.scale).toBeLessThanOrEqual(1440 - insets.right + 0.001);
    expect(view.y + 39 * view.scale).toBeLessThanOrEqual(900 - insets.bottom + 0.001);
    expect(view.scale).toBeGreaterThan(16);
  });

  it("fits the phone grid (28 columns, 78 rows) under the label row and above the dock", () => {
    const insets = fitInsets(390);
    const view = fitWithInsets(28, 78, 390, 844, insets);
    expect(view.y).toBeGreaterThanOrEqual(insets.top - 0.001);
    expect(view.y + 78 * view.scale).toBeLessThanOrEqual(844 - insets.bottom + 0.001);
    expect(view.x + 28 * view.scale).toBeLessThanOrEqual(390 - insets.right + 0.001);
  });

  it("does not break when the screen is smaller than the insets or there are no rows", () => {
    const view = fitWithInsets(56, 0, 300, 100, fitInsets(1440));
    expect(Number.isFinite(view.scale)).toBe(true);
    expect(view.scale).toBeGreaterThan(0);
  });
});

describe("wheelIntent", () => {
  const wheel = (deltaY: number, extra: Partial<{ deltaX: number; deltaMode: number; ctrlKey: boolean }> = {}) => ({
    deltaX: 0,
    deltaY,
    deltaMode: 0,
    ctrlKey: false,
    ...extra,
  });

  it("zooms for a pinch (ctrl held) and for a wheel counting in lines", () => {
    expect(wheelIntent(wheel(3.5, { ctrlKey: true }), 9999)).toBe("zoom");
    expect(wheelIntent(wheel(3, { deltaMode: 1 }), 9999)).toBe("zoom");
  });

  it("zooms for one big whole step of a mouse wheel", () => {
    expect(wheelIntent(wheel(-100), 9999)).toBe("zoom");
    expect(wheelIntent(wheel(120), 9999)).toBe("zoom");
  });

  it("pans for two fingers on a trackpad: small, fractional or sideways steps", () => {
    expect(wheelIntent(wheel(4), 9999)).toBe("pan");
    expect(wheelIntent(wheel(-37.5), 9999)).toBe("pan");
    expect(wheelIntent(wheel(-120, { deltaX: 3 }), 9999)).toBe("pan");
  });

  it("keeps panning through the big tail of a flick that began as a pan", () => {
    expect(wheelIntent(wheel(-100), 120)).toBe("pan");
    expect(wheelIntent(wheel(-100), 400)).toBe("zoom");
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in for a negative step and out for a positive one, by the same ratio", () => {
    const inF = wheelZoomFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false });
    const outF = wheelZoomFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false });
    expect(inF).toBeGreaterThan(1.1);
    expect(inF).toBeLessThan(1.25);
    expect(inF * outF).toBeCloseTo(1, 9);
  });

  it("is 1 for no movement, counts a line as 40 px and a pinch for more per pixel", () => {
    expect(wheelZoomFactor({ deltaY: 0, deltaMode: 0, ctrlKey: false })).toBe(1);
    expect(wheelZoomFactor({ deltaY: -2, deltaMode: 1, ctrlKey: false })).toBeCloseTo(wheelZoomFactor({ deltaY: -80, deltaMode: 0, ctrlKey: false }), 9);
    expect(wheelZoomFactor({ deltaY: -5, deltaMode: 0, ctrlKey: true })).toBeGreaterThan(wheelZoomFactor({ deltaY: -5, deltaMode: 0, ctrlKey: false }));
  });

  it("limits one event so a huge delta cannot jump the zoom", () => {
    expect(wheelZoomFactor({ deltaY: -100000, deltaMode: 0, ctrlKey: false })).toBeCloseTo(Math.exp(240 * 0.0015), 9);
    expect(wheelZoomFactor({ deltaY: -100000, deltaMode: 0, ctrlKey: true })).toBeCloseTo(Math.exp(240 * 0.01), 9);
  });
});

describe("moveFocus", () => {
  it("moves a day sideways and a row up or down", () => {
    expect(moveFocus(100, "ArrowRight", 56, 2172)).toBe(101);
    expect(moveFocus(100, "ArrowLeft", 56, 2172)).toBe(99);
    expect(moveFocus(100, "ArrowDown", 56, 2172)).toBe(156);
    expect(moveFocus(100, "ArrowUp", 28, 2172)).toBe(72);
  });

  it("stops at the first day and at today", () => {
    expect(moveFocus(0, "ArrowLeft", 56, 2172)).toBe(0);
    expect(moveFocus(10, "ArrowUp", 56, 2172)).toBe(0);
    expect(moveFocus(2171, "ArrowRight", 56, 2172)).toBe(2171);
    expect(moveFocus(2150, "ArrowDown", 56, 2172)).toBe(2171);
  });

  it("ignores other keys and an empty timeline", () => {
    expect(moveFocus(7, "a", 56, 2172)).toBe(7);
    expect(moveFocus(7, "ArrowRight", 56, 0)).toBe(0);
  });
});

describe("revealCell", () => {
  const view = { scale: 40, x: 100, y: 100 };

  it("leaves the view alone when the cell is already inside", () => {
    expect(revealCell(view, 5, 56, 1440, 900, 24)).toBe(view);
  });

  it("moves the view the least that brings a cell on from the right and from below", () => {
    // column 40 sits at x 1700 to 1740 on a 1440 screen: 324 too far right, so the view moves 324 left
    const right = revealCell(view, 40, 56, 1440, 900, 24);
    expect(right).toEqual({ scale: 40, x: -224, y: 100 });
    // row 30 sits at y 1300 to 1340 on a 900 screen
    const below = revealCell(view, 30 * 56, 56, 1440, 900, 24);
    expect(below).toEqual({ scale: 40, x: 100, y: -364 });
  });

  it("brings a cell on from the left and from above", () => {
    const moved = revealCell({ scale: 40, x: -500, y: -300 }, 0, 56, 1440, 900, 24);
    expect(moved).toEqual({ scale: 40, x: 24, y: 24 });
  });
});

describe("sameView", () => {
  it("treats sub-pixel differences as the same view", () => {
    expect(sameView({ scale: 20, x: 10, y: 10 }, { scale: 20.004, x: 10.3, y: 9.8 })).toBe(true);
    expect(sameView({ scale: 20, x: 10, y: 10 }, { scale: 20.5, x: 10, y: 10 })).toBe(false);
    expect(sameView({ scale: 20, x: 10, y: 10 }, { scale: 20, x: 11, y: 10 })).toBe(false);
  });
});

describe("limits used with the zoom", () => {
  it("stops zooming in at the maximum scale and keeps the grid in reach", () => {
    const fit = { scale: 19, x: 360, y: 80 };
    const big = zoomAt(fit, 100, 700, 400, fit.scale, MAX_SCALE);
    expect(big.scale).toBe(MAX_SCALE);
    expect(clampView(big, 56, 39, 1440, 900).scale).toBe(MAX_SCALE);
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields, selects and editable content, whatever the tag's case", () => {
    expect(isTypingTarget("INPUT", false)).toBe(true);
    expect(isTypingTarget("textarea", false)).toBe(true);
    expect(isTypingTarget("Select", false)).toBe(true);
    expect(isTypingTarget("DIV", true)).toBe(true);
  });

  it("is false for the canvas, the body, links and buttons", () => {
    expect(isTypingTarget("CANVAS", false)).toBe(false);
    expect(isTypingTarget("BODY", false)).toBe(false);
    expect(isTypingTarget("A", false)).toBe(false);
    expect(isTypingTarget("BUTTON", false)).toBe(false);
  });
});
