import { describe, expect, it } from "vitest";
import {
  bookSize,
  flatFit,
  flatFrame,
  HEAD_GAP,
  headGuess,
  markerShown,
  SHELF_GAP,
} from "./shelf-math";

const HEIGHTS = [8.5, 9, 8, 9, 9.5, 9, 9.3, 7.2, 7.2, 7.8, 10, 9, 11, 8.25];
const PAGES = [146, 254, 220, 160, 466, 195, 432, 160, 224, 176, 224, 224, 176, 368];
/** The real 14 books: the row's width and the tallest spine, in world units. */
const row = (() => {
  const sizes = HEIGHTS.map((heightIn, i) => bookSize({ heightIn, aspect: 0.66, pages: PAGES[i] }));
  const span = sizes.reduce((sum, s) => sum + s.T, 0) + SHELF_GAP * (sizes.length - 1);
  return { span, tallest: Math.max(...sizes.map((s) => s.H)) };
})();
/** The sizes the review looks at (layer width by height). */
const SIZES: Array<[number, number]> = [
  [320, 568],
  [390, 844],
  [820, 1180],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
];

/**
 * Where the layer's header ends at each size, measured on the production build (`.xp-head`'s bottom,
 * rounded up as `headerBottom` does): its minimum height is 120 px, a little more on a wide screen.
 */
const HEAD: Record<string, number> = {
  "320x568": 120,
  "390x844": 120,
  "820x1180": 120,
  "844x390": 120,
  "1024x768": 120,
  "1440x900": 135,
  "2560x1440": 138,
};
const headAt = (vw: number, vh: number) => HEAD[`${vw}x${vh}`];

describe("flatFit", () => {
  it("fits the row to 88% of the width when that is smaller than the height rule", () => {
    // a row 1.2 wide and 1 high on a 1000 by 1000 stage: the width rule gives 733, the height rule 780
    const f = flatFit({ vw: 1000, vh: 1000, rowWidth: 1.2, tallest: 1 });
    expect(f.scale).toBeCloseTo(880 / 1.2, 10);
    expect(f.pans).toBe(false);
  });
  it("fits the tallest spine to 78% of the height when the row has room", () => {
    const f = flatFit({ vw: 2000, vh: 800, rowWidth: 2, tallest: 1 });
    expect(f.scale).toBeCloseTo(624, 10);
    expect(f.pans).toBe(false);
  });
  it("pans only once the width rule goes below 70% of the height", () => {
    // width rule 880 / 1.25 = 704 (70.4%): still fits; 880 / 1.3 = 677 (67.7%): pans at 700
    expect(flatFit({ vw: 1000, vh: 1000, rowWidth: 1.25, tallest: 1 }).pans).toBe(false);
    expect(flatFit({ vw: 1000, vh: 1000, rowWidth: 1.3, tallest: 1 })).toEqual({
      scale: 700,
      pans: true,
    });
  });
  it("keeps 70% of the height and pans when the width rule would shrink the tallest below it", () => {
    const f = flatFit({ vw: 390, vh: 844, rowWidth: 3, tallest: 1 });
    expect(f.pans).toBe(true);
    expect(f.scale).toBeCloseTo(0.7 * 844, 10);
  });

  describe("with the real 14 books", () => {
    for (const [vw, vh] of SIZES) {
      it(`${vw} by ${vh}: tallest spine 70% to 78% of the height, the row inside 88% of the width or panning`, () => {
        const { scale, pans } = flatFit({ vw, vh, rowWidth: row.span, tallest: row.tallest });
        const tall = (scale * row.tallest) / vh;
        expect(tall).toBeLessThanOrEqual(0.78 + 1e-9);
        expect(tall).toBeGreaterThanOrEqual(0.7 - 1e-9);
        if (pans) {
          expect(tall).toBeCloseTo(0.7, 9);
          expect(scale * row.span).toBeGreaterThan(0.88 * vw);
        } else {
          expect(scale * row.span).toBeLessThanOrEqual(0.88 * vw + 1e-9);
        }
      });
    }
    it("fits whole on the wide screens and pans on the narrow ones", () => {
      const pans = (vw: number, vh: number) =>
        flatFit({ vw, vh, rowWidth: row.span, tallest: row.tallest }).pans;
      expect(pans(1440, 900)).toBe(false);
      expect(pans(2560, 1440)).toBe(false);
      expect(pans(1024, 768)).toBe(false);
      expect(pans(320, 568)).toBe(true);
      expect(pans(390, 844)).toBe(true);
      expect(pans(820, 1180)).toBe(true);
    });
    it("is as large as fits: at 1440 by 900 the tallest spine is 78% or the row 88%", () => {
      const f = flatFit({ vw: 1440, vh: 900, rowWidth: row.span, tallest: row.tallest });
      const tall = (f.scale * row.tallest) / 900;
      const wide = (f.scale * row.span) / 1440;
      expect(Math.max(tall / 0.78, wide / 0.88)).toBeCloseTo(1, 9);
    });
  });
});

/** The six Review Focus sizes and a landscape phone. */
const ALL_SIZES: Array<[number, number]> = [...SIZES, [844, 390]];

describe("flatFrame", () => {
  it("puts the books' feet at 90% of the height", () => {
    expect(flatFrame({ vw: 1440, vh: 900, top: 135, ...row }).baseRow).toBe(810);
    expect(flatFrame({ vw: 1024, vh: 768, top: 120, ...row }).baseRow).toBe(684); // 84 px kept below, not 691
  });
  it("keeps 84 px under the line on a small stage, for the marker and the hint", () => {
    expect(flatFrame({ vw: 320, vh: 568, top: 120, ...row }).baseRow).toBe(484);
    for (const [vw, vh] of ALL_SIZES) {
      expect(vh - flatFrame({ vw, vh, top: headAt(vw, vh), ...row }).baseRow).toBeGreaterThanOrEqual(84);
    }
  });
  describe("the height rule reads the room between the header and the line", () => {
    for (const [vw, vh] of ALL_SIZES) {
      it(`${vw} by ${vh}: the tallest spine's top is at least ${HEAD_GAP} px under the header and never over 78% of the height`, () => {
        const top = headAt(vw, vh);
        const f = flatFrame({ vw, vh, top, ...row });
        const tallPx = f.scale * row.tallest;
        expect(f.baseRow - tallPx).toBeGreaterThanOrEqual(top + HEAD_GAP - 1e-6);
        expect(tallPx / vh).toBeLessThanOrEqual(0.78 + 1e-9);
        // and it is as large as fits: the height rule, the width rule or the room is what stopped it
        const room = f.baseRow - top - HEAD_GAP;
        const limit = Math.min(0.78 * vh, room);
        if (!f.pans) {
          expect(Math.max(tallPx / limit, (f.scale * row.span) / (0.88 * vw))).toBeCloseTo(1, 6);
        } else {
          expect(tallPx).toBeCloseTo(Math.min(0.7 * vh, room), 6);
        }
      });
    }
    it("lifts nothing it did not have to: where the room is ample the old 78% and 70% stand", () => {
      const wide = flatFrame({ vw: 2560, vh: 1440, top: 138, ...row });
      expect((wide.scale * row.tallest) / 1440).toBeCloseTo(0.78, 9);
      const narrow = flatFrame({ vw: 390, vh: 844, top: 120, ...row });
      expect((narrow.scale * row.tallest) / 844).toBeCloseTo(0.7, 9);
      expect(narrow.pans).toBe(true);
    });
    it("on a landscape phone (844 by 390) the row is smaller than 70% rather than run into the header", () => {
      const f = flatFrame({ vw: 844, vh: 390, top: 120, ...row });
      const tallPx = f.scale * row.tallest;
      expect(f.baseRow).toBe(306);
      expect(tallPx).toBeCloseTo(306 - 120 - HEAD_GAP, 6);
      expect(tallPx / 390).toBeLessThan(0.7);
      expect(f.pans).toBe(false); // the row is small enough to stand whole
    });
    it("at 1024 by 768 the tallest spine's top no longer moves up to 85 px", () => {
      const f = flatFrame({ vw: 1024, vh: 768, top: 120, ...row });
      expect(f.baseRow - f.scale * row.tallest).toBeGreaterThanOrEqual(128 - 1e-6);
    });
    it("a taller header leaves less room", () => {
      const a = flatFrame({ vw: 1440, vh: 900, top: 120, ...row });
      const b = flatFrame({ vw: 1440, vh: 900, top: 200, ...row });
      expect(b.scale).toBeLessThan(a.scale);
    });
    it("never gives a zero or negative scale, even for a header taller than the stage", () => {
      expect(flatFrame({ vw: 400, vh: 300, top: 900, ...row }).scale).toBeGreaterThan(0);
    });
  });
  it("guesses the header's height before it is measured, as measured at the review sizes", () => {
    for (const [vw, vh] of ALL_SIZES) expect(headGuess(vw), `${vw} by ${vh}`).toBe(headAt(vw, vh));
    expect(headGuess(1280)).toBe(127); // 51.2 + 25.8 + 8 + 19.5 + 22 = 126.5
    expect(headGuess(699)).toBe(120);
  });
  for (const [vw, vh] of ALL_SIZES) {
    it(`${vw} by ${vh}: the pan range stops the row's ends inside the edges and covers the reach`, () => {
      const f = flatFrame({ vw, vh, top: headAt(vw, vh), ...row });
      const viewW = vw / f.scale;
      if (!f.pans) {
        expect(f.maxX).toBe(0);
        expect(f.visible).toBe(1);
        return;
      }
      expect(f.maxX).toBeGreaterThan(0);
      // at the left end of the pan, the row's left edge is 6% of the width from the screen edge
      expect(((f.maxX + viewW / 2 - row.span / 2) * f.scale) / vw).toBeCloseTo(0.06, 9);
      expect(f.visible).toBeGreaterThan(0);
      expect(f.visible).toBeLessThan(1);
      // the whole visible range is the reach
      expect(viewW + 2 * f.maxX).toBeCloseTo(f.reach, 9);
    });
  }
});

describe("markerShown with the flat frame", () => {
  it("agrees at every width: shown exactly when the row pans", () => {
    for (let vw = 300; vw <= 2600; vw += 25) {
      const f = flatFrame({ vw, vh: 800, top: 120, ...row });
      expect(markerShown(f.maxX, f.visible)).toBe(f.pans);
    }
  });
});
