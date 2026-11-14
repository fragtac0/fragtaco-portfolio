// The overview's fit (Ruling R104): the framing that keeps the whole trail and its nine beads on a small stage, clear of the words and the dock, and the glide to it.
import { describe, expect, it } from "vitest";
import { PICTURE } from "./frame";
import { DOCK_GAP, WORDS_GAP, overlaps, type Box, type KeepOut } from "./keep-out";
import { MILESTONE_SHARES, aheadTrail, lowerTrail, sampleTrail, trailAt, type Point } from "./trail";
import { FIT_GUTTER, OVERVIEW, fitOverview, glideTo, overviewAt, overviewPoints, project, sameLook, viewOf, type Stage } from "./view";

const ROUTE: Point[] = [[639.5, 329.6], [619.2, 329.0], [604.8, 330.2], [589.7, 332.4], [579.2, 349.4], [565.5, 377.2], [542.1, 400.1], [511.4, 402.0], [487.3, 393.1], [468.9, 380.4], [458.1, 366.2]];
const SUMMIT: Point = [500, 325];
const STAGE: Stage = { w: 1440, h: 900 };
const flat = sampleTrail(lowerTrail(ROUTE, SUMMIT), 200);
const hilly = flat.map((p, i) => ({ ...p, n: 0.55 * (i / 200) }));

describe("overviewAt", () => {
  it("is where `project` puts a point at k = 0, for the picture's framing and for a moved and zoomed one", () => {
    for (const look of [OVERVIEW, { ax: 540, ay: 380, s: 0.8 }]) {
      const v = viewOf({ ...look, trail: flat }, 0, 1, STAGE);

      for (const [x, y] of [[640, 330], [500, 325], [458, 366]]) {
        const [a, b] = overviewAt(look, STAGE, x, y);
        const [c, d] = project(v, x, y, 0);

        expect(a).toBeCloseTo(c, 6);
        expect(b).toBeCloseTo(d, 6);
      }
    }
  });
});

// The boxes of the page's words and the dock, read from the production build at each size (Task 19's fix round).
const keep = (words: number[][], dock: number[]): KeepOut => ({ words: words.map(([l, t, r, b]) => ({ l, t, r, b })), dock: { l: dock[0], t: dock[1], r: dock[2], b: dock[3] } });
const PAGES: Record<string, { stage: Stage; keep: KeepOut }> = {
  "1440x900": { stage: { w: 1440, h: 900 }, keep: keep([[48, 28, 470.4, 224.1], [48, 668.8, 463.4, 746.5], [1193.2, 28, 1392, 69.5]], [496.2, 762.5, 943.8, 876]) },
  "820x1180": { stage: { w: 820, h: 1180 }, keep: keep([[48, 28, 296.9, 171.6], [48, 948.8, 463.4, 1026.5], [573.2, 28, 772, 69.5]], [186.2, 1042.5, 633.8, 1156]) },
  "390x844": { stage: { w: 390, h: 844 }, keep: keep([[16, 22, 301, 150.8], [16, 590.5, 374, 699], [16, 64, 198.8, 103.5]], [20.3, 739, 369.7, 832]) },
  "360x640": { stage: { w: 360, h: 640 }, keep: keep([[16, 22, 344, 150.8], [16, 440.7, 344, 495], [16, 64, 198.8, 103.5]], [8, 535, 352, 628]) },
  "320x568": { stage: { w: 320, h: 568 }, keep: keep([[16, 22, 304, 150.8], [16, 368.7, 304, 423], [16, 64, 198.8, 103.5]], [8, 463, 312, 556]) },
  "844x390": { stage: { w: 844, h: 390 }, keep: keep([[48, 28, 378, 115.6], [48, 197.6, 378.9, 236.5], [597.2, 28, 796, 69.5]], [198.2, 252.5, 645.8, 366]) },
};
const LINE = hilly;
const POINTS = overviewPoints(MILESTONE_SHARES.map((u) => trailAt(LINE, u)), [LINE, aheadTrail([LINE[200].x, LINE[200].y], SUMMIT)], 22, 6);

/** Every point of the trail and the beads, as a box on the screen, for a framing. */
const boxesFor = (look: typeof OVERVIEW, stage: Stage): Box[] => POINTS.map((p) => {
  const [x, y] = overviewAt(look, stage, p.x, p.y);

  return { l: x - p.pad, t: y - p.pad, r: x + p.pad, b: y + p.pad };
});

describe("fitOverview", () => {
  it("keeps the picture's own framing where the whole trail and its beads already fit (the desktop and the tablet)", () => {
    for (const name of ["1440x900", "820x1180"]) {
      expect(fitOverview(OVERVIEW, POINTS, PAGES[name].stage, PAGES[name].keep)).toEqual(OVERVIEW);
    }
  });

  it("moves the framing, at the picture's zoom, so the beads of a phone are all on the screen, clear of the words and the dock", () => {
    for (const name of ["390x844", "360x640", "320x568", "844x390"]) {
      const { stage, keep: k } = PAGES[name];
      const look = fitOverview(OVERVIEW, POINTS, stage, k);

      expect(look, name).not.toEqual(OVERVIEW);
      for (const b of boxesFor(look, stage)) {
        expect(b.l, name).toBeGreaterThanOrEqual(FIT_GUTTER);
        expect(b.r, name).toBeLessThanOrEqual(stage.w - FIT_GUTTER);
        expect(b.t, name).toBeGreaterThanOrEqual(FIT_GUTTER);
        expect(b.b, name).toBeLessThanOrEqual(stage.h - FIT_GUTTER);
        for (const w of k.words) expect(overlaps(b, w, WORDS_GAP), name).toBe(false);
        expect(overlaps(b, k.dock as Box, DOCK_GAP), name).toBe(false);
      }
    }
  });

  it("leaves the picture covering the stage while the zoom is the picture's or more", () => {
    for (const name of ["390x844", "360x640", "320x568", "844x390"]) {
      const { stage } = PAGES[name];
      const look = fitOverview(OVERVIEW, POINTS, stage, PAGES[name].keep);

      expect(look.s, `${name} ${JSON.stringify(look)}`).toBeGreaterThanOrEqual(1);
      for (const [x, y] of [[0, 0], [stage.w, 0], [0, stage.h], [stage.w, stage.h]]) {
        const S = Math.max(stage.w / PICTURE.w, stage.h / PICTURE.h) * look.s;
        const [mx, my] = [look.ax + (x - stage.w / 2) / S, look.ay + (y - stage.h / 2) / S];

        expect(mx).toBeGreaterThanOrEqual(-1e-6);
        expect(mx).toBeLessThanOrEqual(PICTURE.w + 1e-6);
        expect(my).toBeGreaterThanOrEqual(-1e-6);
        expect(my).toBeLessThanOrEqual(PICTURE.h + 1e-6);
      }
    }
  });

  it("zooms in, to leave the look-at point room, when the picture would not cover the stage after the move that is needed (a small phone)", () => {
    const { stage, keep: k } = PAGES["320x568"];
    const look = fitOverview(OVERVIEW, POINTS, stage, k);

    expect(look.s).toBeGreaterThan(OVERVIEW.s);
  });

  it("lowers the zoom, a step at a time, only when no move of the look-at point is enough", () => {
    // a stage so narrow that the trail cannot fit at the picture's zoom
    const stage = { w: 200, h: 568 };
    const look = fitOverview(OVERVIEW, POINTS, stage, { words: [], dock: null });

    expect(look.s).toBeLessThan(OVERVIEW.s);
    for (const b of boxesFor(look, stage)) {
      expect(b.l).toBeGreaterThanOrEqual(FIT_GUTTER);
      expect(b.r).toBeLessThanOrEqual(stage.w - FIT_GUTTER);
    }
  });

  it("takes the nearest framing: a small shift for a small need", () => {
    const stage = { w: 390, h: 844 };
    const look = fitOverview(OVERVIEW, POINTS, stage, { words: [], dock: null });

    // only the right edge is the problem, so only the look-at point moves, and not by more than the trail's overhang
    expect(look.s).toBe(OVERVIEW.s);
    expect(look.ay).toBe(OVERVIEW.ay);
    expect(look.ax).toBeGreaterThan(OVERVIEW.ax);
    expect(look.ax - OVERVIEW.ax).toBeLessThan(120);
  });

  it("gives the picture's framing back when nothing fits (a stage too small for the beads)", () => {
    expect(fitOverview(OVERVIEW, POINTS, { w: 40, h: 40 }, { words: [], dock: null })).toEqual(OVERVIEW);
    expect(fitOverview(OVERVIEW, POINTS, { w: 0, h: 0 }, { words: [], dock: null })).toEqual(OVERVIEW);
  });

  it("is quick enough to run when the window is resized", () => {
    const t0 = performance.now();

    fitOverview(OVERVIEW, POINTS, PAGES["844x390"].stage, PAGES["844x390"].keep);
    expect(performance.now() - t0).toBeLessThan(150);
  });
});

describe("glideTo", () => {
  const to = { ax: 534, ay: 325, s: 1.1 };

  it("eases toward the framing, the same share of what is left each moment whatever the frame rate", () => {
    const once = glideTo(OVERVIEW, to, 1 / 30);
    const twice = glideTo(glideTo(OVERVIEW, to, 1 / 60), to, 1 / 60);

    expect(once.ax).toBeGreaterThan(OVERVIEW.ax);
    expect(once.ax).toBeLessThan(to.ax);
    expect(twice.ax).toBeCloseTo(once.ax, 9);
    expect(glideTo(OVERVIEW, to, 0)).toEqual(OVERVIEW);
  });

  it("is the framing itself once it is near, and sameLook then holds", () => {
    expect(sameLook(OVERVIEW, { ...OVERVIEW })).toBe(true);
    expect(sameLook(OVERVIEW, to)).toBe(false);
    expect(glideTo({ ax: 533.99, ay: 325, s: 1.1 }, to, 1 / 60)).toEqual(to);
  });
});
