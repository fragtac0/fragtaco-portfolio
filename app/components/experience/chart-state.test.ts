import { describe, expect, it } from "vitest";
import { createChartState } from "./chart-state";
import { makeField } from "./heights";
import { WORDS_GAP, type KeepOut } from "./keep-out";
import { testCanvas } from "./test-canvas";
import { lowerTrail, sampleTrail, type Point } from "./trail";
import { OVERVIEW, viewOf, type Stage } from "./view";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const trail = sampleTrail(lowerTrail(ROUTE, [500, 325]), 200);
const cam = { ...OVERVIEW, trail };
const phone: Stage = { w: 390, h: 844 };
const overview = viewOf(cam, 0, 1, phone);
/** Level in the west half of the heights (the plain), climbing in the east half, so the ground rises under part of the grid. */
const ramp = () => makeField(Array.from({ length: 80 * 52 }, (_, i) => Math.max(0, (i % 80) - 40) * 6), 80, 52, 0);

describe("the chart state", () => {
  it("draws the frame at the stage's foot until it is told where the dock is", () => {
    const state = createChartState();
    const { c, strokes } = testCanvas();

    state.frame(c, overview, phone, 2, [500, 325], 1);
    expect(strokes[2].points[1]).toEqual([10, 834]); // the bottom corner marks, 10 px above the stage's foot
  });

  it("lifts the frame's foot onto the dock where the dock spans the stage, and takes the readout with it", () => {
    const state = createChartState();
    const keep: KeepOut = { words: [], dock: { l: 20, t: 740, r: 370, b: 830 } };
    const { c, strokes, words } = testCanvas();

    state.setKeepOut(keep, cam, phone, []);
    state.frame(c, overview, phone, 2, [500, 325], 1);
    expect(strokes[2].points[1]).toEqual([10, 724]); // 740 - 6 - 10
    expect(words.find((w) => /E$/.test(w.text) && w.text.includes("  "))!.y).toBe(712); // 22 above the foot
  });

  it("leaves out the overview's labels that would clash with the words, once, at the overview's view (not again as the camera moves)", () => {
    const state = createChartState();
    const keep: KeepOut = { words: [{ l: 0, t: 0, r: 390, b: 200 }], dock: null };
    const before = testCanvas();
    const after = testCanvas();

    state.frame(before.c, overview, phone, 1, [500, 325], 1);
    expect(before.words.map((w) => w.text)).toContain("N");
    state.setKeepOut(keep, cam, phone, []);
    state.frame(after.c, overview, phone, 1, [500, 325], 1);
    expect(after.words.map((w) => w.text)).not.toContain("N");
    // a view the camera has moved to does not bring it back
    state.frame(after.c, viewOf(cam, 0.3, 0.8, phone), phone, 1, [500, 325], 1);
    expect(after.words.map((w) => w.text).filter((t) => t === "N")).toEqual([]);
  });

  it("keeps out of the beads and the trail's line it is given", () => {
    const state = createChartState();
    const free = testCanvas();
    const blocked = testCanvas();

    state.refit(cam, phone, []);
    state.frame(free.c, overview, phone, 1, [500, 325], 1);

    const ring = free.words.find((w) => w.text === "150 km")!;

    state.refit(cam, phone, [{ l: ring.x - 5, t: ring.y - 10, r: ring.x + 40, b: ring.y + 10 }]);
    state.frame(blocked.c, overview, phone, 1, [500, 325], 1);
    expect(blocked.words.map((w) => w.text)).not.toContain("150 km");
  });

  it("draws the grid and the overview's marks on the trail's canvas (the overview's marks only at the overview)", () => {
    const state = createChartState();
    const { c, strokes } = testCanvas();

    state.under(c, overview, phone, 1);

    const withMarks = strokes.length;
    const bare = testCanvas();

    state.under(bare.c, overview, phone, 0);
    expect(withMarks).toBeGreaterThan(40);
    expect(withMarks - bare.strokes.length).toBe(3); // two rings and the summit's triangle
  });

  it("makes the grid's rows take the heights once they are read: raised in My climb, still flat in the overview", () => {
    const state = createChartState();
    const climb = viewOf(cam, 1, 0.5, phone);
    const ys = (v: typeof climb) => {
      const { c, strokes } = testCanvas();

      state.under(c, v, phone, 0);

      return strokes.flatMap((s) => s.points.map((p) => p[1]));
    };
    const [climbBefore, overviewBefore] = [ys(climb), ys(overview)];

    state.setHeights(ramp());
    const [climbAfter, overviewAfter] = [ys(climb), ys(overview)];
    const moved = climbAfter.map((y, i) => Math.abs(y - climbBefore[i]));

    expect(Math.max(...moved)).toBeGreaterThan(20); // a line over the high ground is lifted by tens of pixels
    expect(overviewAfter).toEqual(overviewBefore); // flat at the overview whatever the heights
  });

  it("leaves the rings and the grid's crosses bare where the page's words are, and the grid's lines as they were", () => {
    const state = createChartState();
    const words = { l: 100, t: 300, r: 300, b: 360 };
    const open = testCanvas();
    const bare = testCanvas();

    state.under(open.c, overview, phone, 1);
    state.setKeepOut({ words: [words], dock: null }, cam, phone, []);
    state.under(bare.c, overview, phone, 1);
    expect(open.clips).toHaveLength(0);
    expect(bare.clips.length).toBeGreaterThan(0);
    for (const clip of bare.clips) {
      expect(clip.rule).toBe("evenodd");
      expect(clip.rects).toContainEqual([words.l - WORDS_GAP, words.t - WORDS_GAP, words.r - words.l + 2 * WORDS_GAP, words.b - words.t + 2 * WORDS_GAP]);
    }
    expect(bare.balanced()).toBe(true); // every save has its restore
    expect(bare.strokes).toHaveLength(open.strokes.length);
  });
});
