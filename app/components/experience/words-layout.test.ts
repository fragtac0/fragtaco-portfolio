import { describe, expect, it } from "vitest";
import experience from "../../../content/site/experience.json";
import { SUMMIT_XY, xOf, yOf } from "./frame";
import type { Box } from "./keep-out";
import { CLIFF_GAP, MARK_GAP, TITLE_MIN, fitTitle, isWide, layoutWords, markBoxes, placeBlock, ringLeftWithin, summitRow, type Marks } from "./words-layout";
import { MILESTONE_SHARES, aheadTrail, lowerTrail, sampleTrail, trailAt } from "./trail";
import { OVERVIEW, overviewAt, type Stage } from "./view";

const trail = sampleTrail(lowerTrail(experience.route.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]), SUMMIT_XY));
const ahead = aheadTrail([trail[trail.length - 1].x, trail[trail.length - 1].y], SUMMIT_XY);
const cliff = experience.cliff.points.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]);
const marks: Marks = {
  beads: MILESTONE_SHARES.map((u) => {
    const p = trailAt(trail, u);

    return [p.x, p.y] as const;
  }),
  lines: [trail, ahead].map((line) => line.map((p) => [p.x, p.y] as const)),
};

/** The measured sizes of the page's blocks, as a browser gives them (Doto 800 is about 6.1 em for "EXPERIENCE", the description is 225 px wide). */
const measureTitle = (size: number) => ({ w: Math.max(6.1 * size, 225), h: 2 * size + 10 + 58 });
const caption = { w: 211, h: 130 };
const titleMaxFor = (w: number) => Math.min(64, Math.max(34, 0.046 * w));
/** The switch: 210 by 44 at the top right. */
const switchAt = (stage: Stage): Box => ({ l: stage.w - 48 - 210, t: 28, r: stage.w - 48, b: 72 });
/** The dock: the pill glass at the foot, 446 px wide and 112 tall, centred. */
const dockAt = (stage: Stage): Box => ({ l: stage.w / 2 - 223, t: stage.h - 12 - 112, r: stage.w / 2 + 223, b: stage.h - 12 });

const envFor = (stage: Stage) => ({
  stage,
  look: OVERVIEW,
  cliff,
  marks,
  gutter: 48,
  switchBox: switchAt(stage),
  dock: dockAt(stage),
  titleMax: titleMaxFor(stage.w),
  measureTitle,
  caption,
});

/** The distance from a box to a point (0 inside it). */
const distance = (b: Box, x: number, y: number) => Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b));
const gapBetween = (a: Box, b: Box) => Math.hypot(Math.max(a.l - b.r, 0, b.l - a.r), Math.max(a.t - b.b, 0, b.t - a.b));

/** The cliff's leftmost x over some rows, found the slow way: the ring's edges cut into a thousand steps each. */
function leftSlowly(ring: [number, number][], top: number, bottom: number): number {
  let left = Infinity;

  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];

    for (let s = 0; s <= 1000; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / 1000;
      const y = a[1] + ((b[1] - a[1]) * s) / 1000;

      if (y >= top && y <= bottom) left = Math.min(left, x);
    }
  });

  return left;
}

describe("isWide", () => {
  it("is at least 900 wide and wider than high", () => {
    expect(isWide({ w: 1440, h: 900 })).toBe(true);
    expect(isWide({ w: 900, h: 600 })).toBe(true);
    expect(isWide({ w: 899, h: 600 })).toBe(false);
    expect(isWide({ w: 900, h: 900 })).toBe(false);
    expect(isWide({ w: 820, h: 1180 })).toBe(false);
    expect(isWide({ w: 844, h: 390 })).toBe(false);
    expect(isWide({ w: 390, h: 844 })).toBe(false);
  });
});

describe("ringLeftWithin", () => {
  const square: [number, number][] = [[10, 10], [50, 10], [50, 50], [10, 50]];
  const diamond: [number, number][] = [[30, 0], [60, 30], [30, 60], [0, 30]];

  it("is the left side of a square for rows inside it, and Infinity for rows it does not reach", () => {
    expect(ringLeftWithin(square, 20, 40)).toBe(10);
    expect(ringLeftWithin(square, 0, 5)).toBe(Infinity);
    expect(ringLeftWithin(square, 60, 80)).toBe(Infinity);
  });

  it("finds where an edge crosses the rows' ends, not only the ring's own points", () => {
    expect(ringLeftWithin(diamond, 20, 40)).toBeCloseTo(0 + 20 * 0 + 0, 6); // the left point (0, 30) is inside the rows
    expect(ringLeftWithin(diamond, 0, 10)).toBeCloseTo(20, 6); // at y 10 the left edge is at x = 30 - 10 = 20
    expect(ringLeftWithin(diamond, 45, 50)).toBeCloseTo(15, 6); // at y 45 the lower left edge is at x = 15
  });

  it("agrees with the slow way over the real cliff at the rows round the summit", () => {
    for (const [t, b] of [[250, 400], [300, 380], [0, 1000]]) expect(ringLeftWithin(cliff, t, b)).toBeCloseTo(leftSlowly(cliff, t, b), 0);
  });
});

describe("fitTitle", () => {
  const stage = { w: 1000, h: 700 };
  const base = { row: 350, left: 48, max: 64, stage, dock: null };

  it("takes the biggest size where the block's right edge is CLIFF_GAP short of the cliff", () => {
    const got = fitTitle(measureTitle, { ...base, cliffLeft: () => 48 + 300 + CLIFF_GAP });

    expect(got?.size).toBe(Math.floor(((300 - 0) / 6.1)));
    expect(got?.box.r).toBeLessThanOrEqual(48 + 300);
  });

  it("keeps the biggest size when it fits, and never goes under TITLE_MIN", () => {
    expect(fitTitle(measureTitle, { ...base, cliffLeft: () => 5000 })?.size).toBe(64);
    expect(fitTitle(measureTitle, { ...base, cliffLeft: () => 48 + 225 + CLIFF_GAP })?.size).toBe(36); // the description (225 px) is the widest part below 37 px
    expect(fitTitle(measureTitle, { ...base, cliffLeft: () => 48 + 6.1 * TITLE_MIN + CLIFF_GAP })?.size).toBeUndefined();
    expect(fitTitle(measureTitle, { ...base, cliffLeft: () => 48 + 100 })).toBeNull();
  });

  it("is centred on the row and gives up where it would leave the screen", () => {
    const got = fitTitle(measureTitle, { ...base, cliffLeft: () => 5000 });

    expect(((got?.box.t ?? 0) + (got?.box.b ?? 0)) / 2).toBe(350);
    expect(fitTitle(measureTitle, { ...base, row: 20, cliffLeft: () => 5000 })).toBeNull();
  });
});

describe("placeBlock", () => {
  const bounds = { l: 0, t: 10, r: 1000, b: 690 };

  it("centres the block on the row where nothing is in the way", () => {
    expect(placeBlock(200, 100, 950, 350, [], bounds)).toBe(300);
  });

  it("moves it the least that clears what is in the way, up or down, and up on a tie", () => {
    const wall: Box = { l: 700, t: 330, r: 800, b: 370 }; // over the block's columns (750 to 950), rows 330 to 370

    expect(placeBlock(200, 100, 950, 350, [wall], bounds)).toBe(230); // up: bottom at 330
    expect(placeBlock(200, 100, 950, 350, [{ ...wall, t: 300, b: 470 }], bounds)).toBe(200); // up 100 (bottom at 300) is nearer than down 170 (top at 470)
    expect(placeBlock(200, 100, 950, 350, [{ ...wall, t: 100, b: 360 }], bounds)).toBe(360); // down: top at 360
  });

  it("stays inside the bounds and gives up where there is no free place", () => {
    expect(placeBlock(200, 100, 950, 20, [], bounds)).toBe(10);
    expect(placeBlock(200, 100, 950, 350, [{ l: 0, t: 0, r: 1000, b: 700 }], bounds)).toBeNull();
  });

  it("ignores what is out of its columns", () => {
    expect(placeBlock(200, 100, 950, 350, [{ l: 0, t: 0, r: 700, b: 700 }], bounds)).toBe(300);
  });
});

describe("layoutWords at the sizes the page is checked at", () => {
  for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768], [900, 600]]) {
    describe(`${w} by ${h}`, () => {
      const stage = { w, h };
      const got = layoutWords(envFor(stage));

      it("puts the words beside the mountain", () => {
        expect(got.beside).toBe(true);
      });

      it("centres the title block on the summit's row, at the left gutter", () => {
        if (!got.beside) throw new Error("not beside");

        const row = summitRow(OVERVIEW, stage);

        expect(row).toBeCloseTo(h / 2, 6); // the summit is on the middle row of the overview
        expect((got.title.t + got.title.b) / 2).toBeCloseTo(row, 6);
        expect(got.title.l).toBe(48);
      });

      it("keeps the title block's right edge CLIFF_GAP clear of the cliff at its rows, the title between its smallest size and the stylesheet's", () => {
        if (!got.beside) throw new Error("not beside");

        const ring = cliff.map(([x, y]) => overviewAt(OVERVIEW, stage, x, y));
        const left = leftSlowly(ring, got.title.t, got.title.b);

        expect(left - got.title.r).toBeGreaterThanOrEqual(CLIFF_GAP - 0.5);
        expect(got.titleSize).toBeGreaterThanOrEqual(TITLE_MIN);
        expect(got.titleSize).toBeLessThanOrEqual(titleMaxFor(w));
      });

      it("sets the mountain's block flush right at the gutter, MARK_GAP clear of every bead, the trail and the switch", () => {
        if (!got.beside) throw new Error("not beside");

        expect(got.caption.r).toBe(w - 48);
        expect(got.caption.r - got.caption.l).toBe(caption.w);
        for (const [x, y] of marks.beads) {
          const [sx, sy] = overviewAt(OVERVIEW, stage, x, y);

          expect(distance(got.caption, sx, sy)).toBeGreaterThanOrEqual(MARK_GAP + 8.5); // 8.5 px is the bead's own radius in the overview
        }
        for (const line of marks.lines) {
          for (const [x, y] of line) {
            const [sx, sy] = overviewAt(OVERVIEW, stage, x, y);

            expect(distance(got.caption, sx, sy)).toBeGreaterThanOrEqual(MARK_GAP);
          }
        }
        expect(gapBetween(got.caption, switchAt(stage))).toBeGreaterThanOrEqual(MARK_GAP);
        expect(gapBetween(got.caption, dockAt(stage))).toBeGreaterThanOrEqual(6);
        expect(got.caption.t).toBeGreaterThanOrEqual(12);
      });

      it("moves the mountain's block only as far as the first milestone makes it", () => {
        if (!got.beside) throw new Error("not beside");

        const centred: Box = { l: got.caption.l, r: got.caption.r, t: summitRow(OVERVIEW, stage) - caption.h / 2, b: summitRow(OVERVIEW, stage) + caption.h / 2 };
        const blocked = markBoxes(marks, OVERVIEW, stage).some((b) => b.l < centred.r && b.r > centred.l && b.t < centred.b && b.b > centred.t);

        if (blocked) expect(got.captionDy).not.toBe(0);
        else expect(got.captionDy).toBe(0);
      });
    });
  }

  it("leaves the mountain's block centred where the first milestone is far enough away (1440 by 900) and moves it where it is not (900 by 600)", () => {
    const wide = layoutWords(envFor({ w: 1440, h: 900 }));
    const small = layoutWords(envFor({ w: 900, h: 600 }));

    expect(wide.beside && wide.captionDy).toBe(0);
    expect(small.beside && Math.abs(small.captionDy)).toBeGreaterThan(30);
  });

  it("keeps today's places on a narrow, upright or small screen", () => {
    for (const stage of [{ w: 390, h: 844 }, { w: 360, h: 640 }, { w: 320, h: 568 }, { w: 844, h: 390 }, { w: 820, h: 1180 }, { w: 900, h: 900 }]) {
      expect(layoutWords(envFor(stage))).toEqual({ beside: false });
    }
  });

  it("keeps today's places where the title cannot fit even at its smallest, or the block has no free place", () => {
    const tight = { ...envFor({ w: 1024, h: 768 }), cliff: cliff.map(([x, y]): [number, number] => [x - 500, y]) };

    expect(layoutWords(tight)).toEqual({ beside: false });
    expect(layoutWords({ ...envFor({ w: 1440, h: 900 }), caption: { w: 211, h: 5000 } })).toEqual({ beside: false });
  });
});
