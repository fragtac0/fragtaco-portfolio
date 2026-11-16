import { describe, expect, it } from "vitest";
import { frameAt } from "../layer/frame-math";
import {
  BOTTOM_PAD,
  SIDE_PAD,
  TOP_PAD,
  containFraming,
  DOT_RES_MIN,
  dotRes,
  dotRegion,
  framingRect,
  projectRow,
  shelfFraming,
  windowRow,
  type Row,
} from "./box-framing";
import { bookSize, flatFrame, headGuess, SHELF_GAP } from "./shelf-math";

const HEIGHTS = [8.5, 9, 8, 9, 9.5, 9, 9.3, 7.2, 7.2, 7.8, 10, 9, 11, 8.25];
const PAGES = [146, 254, 220, 160, 466, 195, 432, 160, 224, 176, 224, 224, 176, 368];
const BOOKS = HEIGHTS.map((heightIn, i) => ({ ...bookSize({ heightIn, aspect: 0.66, pages: PAGES[i] }) }));
const SPAN = BOOKS.reduce((n, b) => n + b.T, 0) + SHELF_GAP * (BOOKS.length - 1);
const TALLEST = Math.max(...BOOKS.map((b) => b.H));

/** The row of the open page at a window size, the camera at world x `cam` (what the shelf fit reports). */
function rowAt(vw: number, vh: number, cam = 0) {
  const f = flatFrame({ vw, vh, span: SPAN, tallest: TALLEST, top: headGuess(vw) });
  const row = windowRow({ vw, vh, scale: f.scale, baseRow: f.baseRow, reach: f.reach, tallest: TALLEST, cam });
  // every book: left edge, right edge in window pixels, and its top
  let x = -SPAN / 2;
  const books = BOOKS.map((b) => {
    const left = vw / 2 + (x - cam) * f.scale;
    x += b.T + SHELF_GAP;
    return { left, right: left + b.T * f.scale, top: f.baseRow - b.H * f.scale, bottom: f.baseRow };
  });
  return { row, books, scale: f.scale, maxX: f.maxX };
}

/** The home boxes at the sizes the round looks at: the window and the reading box in it. */
const CASES = [
  { name: "1440 by 900", win: { w: 1440, h: 900 }, box: { w: 648, h: 300 } },
  { name: "1366 by 768", win: { w: 1366, h: 768 }, box: { w: 614, h: 300 } },
  { name: "390 by 844", win: { w: 390, h: 844 }, box: { w: 358, h: 332 } },
];
const T_STEPS = Array.from({ length: 21 }, (_, i) => i / 20);

describe("the row of the open page", () => {
  it("has its books between the line they stand on and the top, and the ledge under the line", () => {
    const { row } = rowAt(1440, 900);
    expect(row.top).toBeLessThan(row.bottom);
    expect(row.ledgeBottom).toBeGreaterThan(row.bottom);
    expect(row.left).toBeLessThan(row.right);
  });

  it("moves sideways with the camera", () => {
    const a = rowAt(390, 844, 0).row;
    const b = rowAt(390, 844, -1).row;
    expect(b.left).toBeGreaterThan(a.left);
    expect(b.right - b.left).toBeCloseTo(a.right - a.left, 6);
  });
});

describe.each(CASES)("the box framing at t = 0 ($name)", ({ win, box }) => {
  // the phone starts at the left end of the row (initialCamX), the others centred
  const cams = win.w < 700 ? [0, -1, 1] : [0];
  it.each(cams)("every book and the ledge are inside the box, camera at %s", (cam) => {
    const { row, books } = rowAt(win.w, win.h, cam);
    const fr = shelfFraming(box, win, row, 0);
    const rect = framingRect(fr, box);
    const inFrame = (p: { left: number; right: number; top: number; bottom: number }) => {
      const l = (p.left - rect.x) * fr.scale;
      const r = (p.right - rect.x) * fr.scale;
      const t = (p.top - rect.y) * fr.scale;
      const b = (p.bottom - rect.y) * fr.scale;
      expect(l).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(box.w);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(box.h);
    };
    for (const b of books) inFrame(b);
    inFrame({ left: row.left, right: row.right, top: row.bottom, bottom: row.ledgeBottom }); // the ledge: top edge and front face
  });

  it("the tallest book's top is at least 6% of the box's height below the box's top", () => {
    const { row } = rowAt(win.w, win.h);
    const fr = shelfFraming(box, win, row, 0);
    const rect = framingRect(fr, box);
    expect((row.top - rect.y) * fr.scale).toBeGreaterThanOrEqual(0.06 * box.h);
  });

  it("is as large as fits: one of the box's margins is the padding itself", () => {
    const { row } = rowAt(win.w, win.h);
    const fr = shelfFraming(box, win, row, 0);
    const rect = framingRect(fr, box);
    const top = (row.top - rect.y) * fr.scale;
    const foot = box.h - (row.ledgeBottom - rect.y) * fr.scale;
    const side = Math.min((row.left - rect.x) * fr.scale, box.w - (row.right - rect.x) * fr.scale);
    const tight =
      Math.abs(top - TOP_PAD * box.h) < 1e-6 && Math.abs(foot - BOTTOM_PAD * box.h) < 1e-6
        ? true
        : Math.abs(side - SIDE_PAD * box.w) < 1e-6;
    expect(tight).toBe(true);
  });

  it("the picture is not stretched: the part of the window it shows has the box's own shape", () => {
    const { row } = rowAt(win.w, win.h);
    for (const t of T_STEPS) {
      const f = frameAt({ left: 0, top: 0, width: box.w, height: box.h }, win.w, win.h, t);
      const fr = shelfFraming(box, win, row, t);
      const rect = framingRect(fr, { w: f.width, h: f.height });
      expect(rect.w / rect.h).toBeCloseTo(f.width / f.height, 9);
    }
  });
});

describe.each(CASES)("the framing over the move ($name)", ({ win, box }) => {
  const cam = win.w < 700 ? -1 : 0;
  const { row } = rowAt(win.w, win.h, cam);

  it("at t = 1 it is exactly the open page's picture", () => {
    const fr = shelfFraming(box, win, row, 1);
    expect(fr.scale).toBe(1);
    expect(framingRect(fr, win)).toEqual({ x: 0, y: 0, w: win.w, h: win.h });
  });

  it("the scale only grows with t, in steps of 0.05", () => {
    let prev = 0;
    for (const t of T_STEPS) {
      const s = shelfFraming(box, win, row, t).scale;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("has no step at either end: a hair from t = 0 or 1 is a hair from the end's own framing", () => {
    for (const [t, near] of [
      [0, 0.001],
      [1, 0.999],
    ] as const) {
      const a = shelfFraming(box, win, row, t);
      const b = shelfFraming(box, win, row, near);
      expect(Math.abs(a.scale - b.scale)).toBeLessThan(0.002);
      expect(Math.abs(a.cx - b.cx)).toBeLessThan(0.002 * win.w);
      expect(Math.abs(a.cy - b.cy)).toBeLessThan(0.002 * win.h);
    }
  });

  it("the dot field covers the frame above the line the books stand on, at every t", () => {
    const region = dotRegion(box, win, row);
    for (const t of T_STEPS) {
      const f = frameAt({ left: 0, top: 0, width: box.w, height: box.h }, win.w, win.h, t);
      const rect = framingRect(shelfFraming(box, win, row, t), { w: f.width, h: f.height });
      expect(region.x).toBeLessThanOrEqual(rect.x + 1e-6);
      expect(region.x + region.w).toBeGreaterThanOrEqual(rect.x + rect.w - 1e-6);
      expect(region.y).toBeLessThanOrEqual(rect.y + 1e-6);
      // it ends at the line (the books' feet): the frame below the line is the ledge and the ground
      expect(region.y + region.h).toBeCloseTo(row.bottom, 6);
    }
  });
});

describe("the contain framing", () => {
  it("fits a wide row by its width and a tall one by its height", () => {
    const wide: Row = { left: 0, right: 1000, top: 0, bottom: 90, ledgeBottom: 100 };
    const a = containFraming({ w: 500, h: 500 }, wide);
    expect(a.scale).toBeCloseTo((500 * (1 - 2 * SIDE_PAD)) / 1000, 9);
    const tall: Row = { left: 0, right: 100, top: 0, bottom: 900, ledgeBottom: 1000 };
    const b = containFraming({ w: 500, h: 500 }, tall);
    expect(b.scale).toBeCloseTo((500 * (1 - TOP_PAD - BOTTOM_PAD)) / 1000, 9);
  });

  it("centres what it fits", () => {
    const row: Row = { left: 100, right: 300, top: 50, bottom: 140, ledgeBottom: 150 };
    const fr = containFraming({ w: 800, h: 200 }, row);
    const rect = framingRect(fr, { w: 800, h: 200 });
    expect(((row.left + row.right) / 2 - rect.x) * fr.scale).toBeCloseTo(400, 6);
    // the room under the top padding and above the bottom one is shared evenly
    const above = (row.top - rect.y) * fr.scale - TOP_PAD * 200;
    const below = 200 - (row.ledgeBottom - rect.y) * fr.scale - BOTTOM_PAD * 200;
    expect(above).toBeCloseTo(below, 6);
  });
});

describe("projecting a row", () => {
  it("gives every book's box and the ledge's in the frame's pixels", () => {
    const { row, books } = rowAt(1440, 900);
    const fr = shelfFraming({ w: 648, h: 300 }, { w: 1440, h: 900 }, row, 0);
    const p = projectRow(row, books, fr, { w: 648, h: 300 });
    expect(p.books).toHaveLength(14);
    expect(p.ledge.bottom).toBeLessThanOrEqual(300);
    expect(Math.min(...p.books.map((b) => b.top))).toBeGreaterThanOrEqual(0.06 * 300);
  });
});

describe("how fine the dot field is painted", () => {
  it("follows the framing's scale a little over, between a floor and the open page's own", () => {
    expect(dotRes(0.36)).toBeCloseTo(0.45, 9);
    expect(dotRes(0.9)).toBe(1);
    expect(dotRes(1)).toBe(1);
    expect(dotRes(0.05)).toBe(DOT_RES_MIN);
  });

  it("is less than the full ratio in every box, so the canvas that covers more than the window costs no more than the box's own did", () => {
    for (const { win, box } of CASES) {
      const { row } = rowAt(win.w, win.h);
      const region = dotRegion(box, win, row);
      const res = dotRes(containFraming(box, row).scale);
      expect(res).toBeLessThan(0.6);
      // the pixels painted (at the same pixel ratio) against the box's own canvas
      expect(region.w * region.h * res * res).toBeLessThan(box.w * box.h * 2);
    }
  });
});
