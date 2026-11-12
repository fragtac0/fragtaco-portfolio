import { describe, expect, it } from "vitest";
import {
  liftLayout,
  MARGIN,
  MIN_OPEN_SCALE,
  SHEET_GAP,
  sideBySide,
  type LiftInput,
} from "./shelf-lift";
import { HEAD_GAP, LIFT } from "./shelf-math";

/** A wide stage like 1440 by 900: the row's feet at 810, a book 600 high, its cover 400 wide. */
const wide = (over: Partial<LiftInput> = {}): LiftInput => ({
  vw: 1440,
  vh: 900,
  rowX: 720,
  rowTop: 210,
  rowH: 600,
  coverW: 400,
  headBottom: 135,
  baseRow: 810,
  wide: true,
  note: { w: 380, h: 300 },
  gap: 50,
  ...over,
});
/** A phone like 390 by 844: a 591 px book, its cover as wide as the screen, a 300 px note sheet. */
const narrow = (over: Partial<LiftInput> = {}): LiftInput => ({
  vw: 390,
  vh: 844,
  rowX: 195,
  rowTop: 169,
  rowH: 591,
  coverW: 390,
  headBottom: 120,
  baseRow: 760,
  wide: false,
  note: { w: 358, h: 300 },
  gap: 28,
  ...over,
});

describe("liftLayout: the rise", () => {
  it("lifts a book by 38% of its height when there is room above it", () => {
    const o = liftLayout(wide({ rowH: 400, rowTop: 410, coverW: 260 }));
    expect(o.lift).toBeCloseTo(LIFT * 400, 9);
  });
  it("caps the lift so the book's top stays under the header, with the fit's gap", () => {
    // 38% of 600 is 228, but only 210 - (135 + 8) = 67 px lie between the book and the header
    const o = liftLayout(wide());
    expect(o.lift).toBe(210 - (135 + HEAD_GAP));
    expect(o.top).toBe(135 + HEAD_GAP);
    expect(o.cy - (o.scale * 600) / 2).toBeCloseTo(135 + HEAD_GAP, 9);
  });
  it("does not lift the tallest book at all when its top already stands at the header's line", () => {
    // 1440 by 900: the tallest spine's top is at header + 8
    expect(liftLayout(wide({ rowTop: 143, rowH: 667, coverW: 440 })).lift).toBe(0);
  });
  it("still lifts a shorter book by 38% when it clears the header", () => {
    const o = liftLayout(wide({ rowTop: 420, rowH: 390, coverW: 260 }));
    expect(o.lift).toBeCloseTo(LIFT * 390, 9);
    expect(420 - o.lift).toBeGreaterThanOrEqual(135 + HEAD_GAP);
  });
  it("does not lift a book that already touches the top", () => {
    expect(liftLayout(wide({ rowTop: 5 })).lift).toBe(0);
  });
});

describe("liftLayout: a wide screen", () => {
  it("keeps the book where it stands when the card fits beside it", () => {
    const o = liftLayout(wide());
    expect(o.cx).toBe(720);
    expect(o.scale).toBe(1);
    expect(o.note!.left).toBe(720 + 200 + 50); // the card to the right of the cover
  });
  it("puts the card on the other side, and moves the book only a little, near the right edge", () => {
    const o = liftLayout(wide({ rowX: 1300 }));
    expect(o.note!.left).toBeLessThan(o.cx - 200);
    expect(o.cx).toBeLessThan(1300);
    expect(o.cx + 200).toBeLessThanOrEqual(1440 - MARGIN);
    expect(o.note!.left).toBeGreaterThanOrEqual(MARGIN);
  });
  it("moves a book at the left edge in so its cover is inside the layer", () => {
    const o = liftLayout(wide({ rowX: 20 }));
    expect(o.cx - 200).toBeGreaterThanOrEqual(MARGIN);
    expect(o.note!.left).toBeGreaterThan(o.cx + 200);
  });
  it("shrinks the book when book and card are too wide for the screen", () => {
    const o = liftLayout(wide({ vw: 900, rowX: 450, coverW: 600, note: { w: 300, h: 300 }, gap: 31 }));
    expect(o.scale).toBeCloseTo((900 - 2 * MARGIN - 31 - 300) / 600, 9);
    const w = 600 * o.scale;
    expect(o.note!.left).toBeGreaterThanOrEqual(o.cx + w / 2 + 31 - 1e-9);
    expect(o.note!.left + 300).toBeLessThanOrEqual(900 - MARGIN + 1e-9);
  });
  it("centres the card on the book, but inside the layer", () => {
    const o = liftLayout(wide({ rowH: 400, rowTop: 410, coverW: 260 }));
    expect(o.note!.centreY).toBeCloseTo(o.cy, 9);
    const high = liftLayout(wide({ rowH: 200, rowTop: 20, coverW: 130 }));
    expect(high.note!.centreY).toBeGreaterThanOrEqual(MARGIN + 150);
  });
  it("never goes below its smallest size", () => {
    expect(liftLayout(wide({ vw: 200, coverW: 800 })).scale).toBe(MIN_OPEN_SCALE);
  });
});

describe("liftLayout: a short wide screen (a landscape phone)", () => {
  const short = (over: Partial<LiftInput> = {}) =>
    wide({ vw: 844, vh: 390, rowX: 422, rowTop: 128, rowH: 178, baseRow: 306, coverW: 117, note: { w: 287, h: 220 }, gap: 29, headBottom: 120, ...over });
  it("keeps the card under the header so Close does not cover it", () => {
    const o = liftLayout(short());
    expect(o.note!.centreY - 110).toBeGreaterThanOrEqual(120 - 1e-9);
  });
  it("on a tall wide screen the card may go up to the layer's margin", () => {
    const o = liftLayout(wide({ rowH: 200, rowTop: 20, coverW: 130 }));
    expect(o.note!.centreY - 150).toBeGreaterThanOrEqual(MARGIN - 1e-9);
    expect(o.note!.centreY - 150).toBeLessThan(120);
  });
});

describe("liftLayout: a narrow screen", () => {
  it("keeps the book above the note sheet and under the header, shrunk to fit", () => {
    const o = liftLayout(narrow());
    const sheetTop = 844 - 16 - 300 - SHEET_GAP;
    const h = 591 * o.scale;
    expect(o.scale).toBeLessThan(1);
    expect(o.cy + h / 2).toBeLessThanOrEqual(sheetTop + 1e-9);
    expect(o.cy - h / 2).toBeGreaterThanOrEqual(120 - 1e-9);
    expect(o.note).toBeNull(); // the stylesheet's bottom sheet stands
  });
  it("keeps the cover inside the screen's width, following the book's own column", () => {
    const o = liftLayout(narrow({ rowX: 20, coverW: 300 }));
    expect(o.cx - (300 * o.scale) / 2).toBeGreaterThanOrEqual(MARGIN - 1e-9);
    const r = liftLayout(narrow({ rowX: 380, coverW: 300 }));
    expect(r.cx + (300 * r.scale) / 2).toBeLessThanOrEqual(390 - MARGIN + 1e-9);
  });
  it("stays whole when the sheet is tall", () => {
    const o = liftLayout(narrow({ note: { w: 358, h: 500 } }));
    expect(o.scale).toBeGreaterThanOrEqual(MIN_OPEN_SCALE);
    expect(o.cy + (591 * o.scale) / 2).toBeLessThanOrEqual(844 - 16 - 500 - SHEET_GAP + 1e-9);
  });
});

describe("sideBySide", () => {
  it("is true on a wide screen and on a landscape phone, false on a phone held upright", () => {
    expect(sideBySide(1440, 900)).toBe(true);
    expect(sideBySide(1024, 768)).toBe(true);
    expect(sideBySide(861, 1000)).toBe(true);
    expect(sideBySide(844, 390)).toBe(true);
    expect(sideBySide(820, 1180)).toBe(false);
    expect(sideBySide(390, 844)).toBe(false);
    expect(sideBySide(320, 568)).toBe(false);
    expect(sideBySide(568, 320)).toBe(false); // too narrow for a card beside the book
    expect(sideBySide(667, 375)).toBe(true);
  });
});

describe("liftLayout: every book at every column of the Review Focus sizes", () => {
  // the stage, the row's feet and the header at each size (the fit's numbers), tallest book 78% or less
  const stages: Array<{ vw: number; vh: number; head: number; baseRow: number; tall: number }> = [
    { vw: 320, vh: 568, head: 120, baseRow: 484, tall: 0.7 * 568 },
    { vw: 390, vh: 844, head: 120, baseRow: 760, tall: 0.7 * 844 },
    { vw: 820, vh: 1180, head: 120, baseRow: 1062, tall: 0.7 * 1180 },
    { vw: 844, vh: 390, head: 120, baseRow: 306, tall: 306 - 128 },
    { vw: 1024, vh: 768, head: 120, baseRow: 684, tall: 684 - 128 },
    { vw: 1440, vh: 900, head: 135, baseRow: 810, tall: 810 - 143 },
    { vw: 2560, vh: 1440, head: 138, baseRow: 1296, tall: 0.78 * 1440 },
  ];
  for (const s of stages) {
    it(`${s.vw} by ${s.vh}: the lifted book stays inside the layer and clear of its note`, () => {
      const wideStage = sideBySide(s.vw, s.vh);
      const noteW = wideStage ? Math.min(380, 0.34 * s.vw) : s.vw - 32;
      const noteH = wideStage ? 300 : 260;
      for (const frac of [0.55, 0.7, 0.85, 1]) {
        const rowH = s.tall * frac;
        for (let rowX = 0; rowX <= s.vw; rowX += s.vw / 20) {
          const o = liftLayout({
            vw: s.vw,
            vh: s.vh,
            rowX,
            rowTop: s.baseRow - rowH,
            rowH,
            coverW: rowH * 0.66,
            headBottom: s.head,
            baseRow: s.baseRow,
            wide: wideStage,
            note: { w: noteW, h: noteH },
            gap: Math.min(64, Math.max(28, s.vw * 0.035)),
          });
          const w = rowH * 0.66 * o.scale;
          const h = rowH * o.scale;
          const where = `${s.vw}x${s.vh} frac ${frac} x ${rowX.toFixed(0)}`;
          expect(o.cy - h / 2, where).toBeGreaterThanOrEqual(MARGIN - 1e-6);
          // under the header with the fit's gap, at the top of the rise and where it settles
          expect(o.cy - h / 2, where).toBeGreaterThanOrEqual(s.head + HEAD_GAP - 1e-6);
          expect(s.baseRow - rowH - o.lift, where).toBeGreaterThanOrEqual(
            Math.min(s.baseRow - rowH, s.head + HEAD_GAP) - 1e-6,
          );
          expect(o.cx - w / 2, where).toBeGreaterThanOrEqual(MARGIN - 1e-6);
          expect(o.cx + w / 2, where).toBeLessThanOrEqual(s.vw - MARGIN + 1e-6);
          expect(o.cy + h / 2, where).toBeLessThanOrEqual(s.vh - MARGIN + 1e-6);
          if (o.note) {
            const apart =
              o.note.left >= o.cx + w / 2 - 1e-6 || o.note.left + noteW <= o.cx - w / 2 + 1e-6;
            expect(apart, where).toBe(true);
            expect(o.note.left, where).toBeGreaterThanOrEqual(MARGIN - 1e-6);
            expect(o.note.left + noteW, where).toBeLessThanOrEqual(s.vw - MARGIN + 1e-6);
          } else {
            // under the header, above the sheet
            expect(o.cy - h / 2, where).toBeGreaterThanOrEqual(Math.min(s.head, 0.5 * s.vh) - 1e-6);
            expect(o.cy + h / 2, where).toBeLessThanOrEqual(s.vh - 16 - noteH - SHEET_GAP + 1e-6);
          }
        }
      }
    });
  }
});
