import { describe, expect, it } from "vitest";
import {
  DROP,
  DROP_FALL,
  FRONT,
  INCH,
  STAG,
  SHELF_GAP,
  WALLZ,
  bookSize,
  clamp,
  dropProgress,
  easeOut,
  flatFit,
  flatFrame,
  flick,
  initialCamX,
  introSeconds,
  markerLeft,
  markerShown,
  openPhases,
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

describe("flatFrame", () => {
  it("puts the books' feet at 90% of the height", () => {
    expect(flatFrame({ vw: 1440, vh: 900, ...row }).baseRow).toBe(810);
    expect(flatFrame({ vw: 1024, vh: 768, ...row }).baseRow).toBe(684); // 84 px kept below, not 691
  });
  it("keeps 84 px under the line on a small stage, for the marker and the hint", () => {
    expect(flatFrame({ vw: 320, vh: 568, ...row }).baseRow).toBe(484);
    for (const [vw, vh] of SIZES) {
      expect(vh - flatFrame({ vw, vh, ...row }).baseRow).toBeGreaterThanOrEqual(84);
    }
  });
  for (const [vw, vh] of SIZES) {
    it(`${vw} by ${vh}: the pan range stops the row's ends inside the edges and covers the reach`, () => {
      const f = flatFrame({ vw, vh, ...row });
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
  it("agrees with the flat frame at every width: shown exactly when the row pans", () => {
    for (let vw = 300; vw <= 2600; vw += 25) {
      const f = flatFrame({ vw, vh: 800, ...row });
      expect(markerShown(f.maxX, f.visible)).toBe(f.pans);
    }
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
