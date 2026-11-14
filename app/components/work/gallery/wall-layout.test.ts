import { describe, expect, it } from "vitest";
import { fitGrid, tileRect } from "./gallery-math";
import { WALL_GAP_PX, arrowTarget, fallbackBox, wallSafe } from "./wall-layout";

const SIZES: Array<[number, number]> = [
  [320, 568], [390, 844], [820, 1180], [1024, 768], [1440, 900], [2560, 1440],
];

describe("wallSafe", () => {
  it("clears the heading and the dock by the gap and keeps the 4% margin", () => {
    const s = wallSafe(1440, 900, 93, 150);
    expect(s.top).toBe(93 + WALL_GAP_PX);
    expect(s.bottom).toBe(150 + WALL_GAP_PX);
    expect(s.side).toBeCloseTo(57.6, 6);
  });

  it("never goes under the 4% margin when the bands are small", () => {
    const s = wallSafe(1000, 1000, 0, 0);
    expect(s).toEqual({ top: 40, bottom: 40, side: 40 });
  });
});

describe("fallbackBox", () => {
  it("is the tile's own rectangle, so the links sit exactly where the engine draws the pictures", () => {
    for (const [vw, vh] of SIZES) {
      for (const [count, aspect] of [[21, 16 / 9], [35, 9 / 16]] as const) {
        const g = fitGrid(count, vw, vh, aspect, wallSafe(vw, vh, 80, 130));
        for (let i = 0; i < count; i++) {
          expect(fallbackBox(g, i)).toEqual(tileRect(g, i));
        }
      }
    }
  });

  it("keeps every box on screen at every size", () => {
    for (const [vw, vh] of SIZES) {
      for (const [count, aspect] of [[21, 16 / 9], [35, 9 / 16]] as const) {
        const g = fitGrid(count, vw, vh, aspect, wallSafe(vw, vh, 80, 130));
        for (let i = 0; i < count; i++) {
          const b = fallbackBox(g, i);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(vw);
          expect(b.y + b.h).toBeLessThanOrEqual(vh);
        }
      }
    }
  });

  it("follows the drift", () => {
    const g = fitGrid(8, 1440, 900, 16 / 9, wallSafe(1440, 900, 93, 150));
    const a = fallbackBox(g, 3);
    const b = fallbackBox(g, 3, { x: 5, y: -4 });
    expect(b.x - a.x).toBeCloseTo(5, 9);
    expect(b.y - a.y).toBeCloseTo(-4, 9);
  });
});

describe("arrowTarget", () => {
  // 7 columns, 34 tiles: a last row of 6
  const t = (key: string, i: number) => arrowTarget(key, i, 7, 34);
  it("moves left and right by one and stops at the ends", () => {
    expect(t("ArrowRight", 5)).toBe(6);
    expect(t("ArrowLeft", 5)).toBe(4);
    expect(t("ArrowLeft", 0)).toBe(0);
    expect(t("ArrowRight", 33)).toBe(33);
  });
  it("moves up and down by a row and stops at the first and last rows", () => {
    expect(t("ArrowDown", 2)).toBe(9);
    expect(t("ArrowUp", 9)).toBe(2);
    expect(t("ArrowUp", 3)).toBe(3);
    expect(t("ArrowDown", 30)).toBe(30);
  });
  it("goes to the last tile when down from the row above a short last row lands past it", () => {
    // tile 27 is the last of row 3; row 4 holds 28..33 (6 tiles), 34 would be a missing slot
    expect(arrowTarget("ArrowDown", 27, 7, 34)).toBe(33);
    expect(arrowTarget("ArrowDown", 26, 7, 34)).toBe(33);
    expect(arrowTarget("ArrowDown", 20, 7, 34)).toBe(27);
  });
  it("Home, End and other keys", () => {
    expect(t("Home", 12)).toBe(0);
    expect(t("End", 12)).toBe(33);
    expect(t("a", 12)).toBe(12);
  });
  it("works for one tile", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) expect(arrowTarget(key, 0, 1, 1)).toBe(0);
  });
});
