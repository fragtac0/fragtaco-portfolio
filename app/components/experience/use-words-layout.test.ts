import { describe, expect, it } from "vitest";
import experience from "../../../content/site/experience.json";
import { SUMMIT_XY, xOf, yOf } from "./frame";
import { DY_VAR, TITLE_VAR, applyWordsLayout, type LayoutPage } from "./use-words-layout";
import { MILESTONE_SHARES, aheadTrail, lowerTrail, sampleTrail, trailAt } from "./trail";

const trail = sampleTrail(lowerTrail(experience.route.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]), SUMMIT_XY));
const ahead = aheadTrail([trail[trail.length - 1].x, trail[trail.length - 1].y], SUMMIT_XY);
const cliff = experience.cliff.points.map((p): [number, number] => [xOf(p.lon), yOf(p.lat)]);
const marks = {
  beads: MILESTONE_SHARES.map((u) => {
    const p = trailAt(trail, u);

    return [p.x, p.y] as const;
  }),
  lines: [trail, ahead].map((l) => l.map((p) => [p.x, p.y] as const)),
};

/** A page with a heading whose box follows `--map-title-size` as a browser's would (the title at 6.1 em, the description 225 px), and a caption of 211 by 130. */
function fakePage(w: number, h: number, max = 64) {
  const vars: Record<string, string> = {};
  const dataset: Record<string, string | undefined> = {};
  const size = () => parseFloat(vars[TITLE_VAR] ?? `${max}`);
  const page: LayoutPage = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    style: { setProperty: (n, v) => void (vars[n] = v), removeProperty: (n) => void delete vars[n] },
    dataset,
    gutter: () => 48,
    parts: () => ({
      heading: { getBoundingClientRect: () => ({ width: Math.max(6.1 * size(), 225), height: 2 * size() + 68 }) },
      titleSize: () => max,
      caption: { getBoundingClientRect: () => ({ width: 211, height: 130 }) },
      switchBox: { l: w - 258, t: 28, r: w - 48, b: 72 },
      dock: { l: w / 2 - 223, t: h - 124, r: w / 2 + 223, b: h - 12 },
    }),
  };

  return { page, vars, dataset };
}

describe("applyWordsLayout", () => {
  it("writes the title's size and how far the mountain's block moves, on a wide screen, and leaves no veto", () => {
    const { page, vars, dataset } = fakePage(900, 600, 41.4);
    const layout = applyWordsLayout(page, cliff, marks);

    expect(layout.beside).toBe(true);
    expect(vars[TITLE_VAR]).toMatch(/^\d+px$/);
    expect(parseFloat(vars[TITLE_VAR])).toBeLessThanOrEqual(41.4);
    expect(parseFloat(vars[DY_VAR])).toBeLessThan(0); // up, out of the first milestone's way
    expect(dataset.words).toBeUndefined();
  });

  it("does not shrink the title where it fits at the stylesheet's size", () => {
    const { page, vars } = fakePage(1440, 900, 64);

    applyWordsLayout(page, cliff, marks);
    expect(vars[TITLE_VAR]).toBe("64px");
    expect(vars[DY_VAR]).toBe("0px");
  });

  it("starts from the stylesheet's size each time, not the last one it wrote (the screen grew)", () => {
    const { page, vars } = fakePage(900, 600, 41);

    applyWordsLayout(page, cliff, marks);
    expect(parseFloat(vars[TITLE_VAR])).toBeLessThanOrEqual(41);

    const bigger = fakePage(1440, 900, 64);

    bigger.vars[TITLE_VAR] = "36px"; // left over from a smaller screen
    applyWordsLayout(bigger.page, cliff, marks);
    expect(bigger.vars[TITLE_VAR]).toBe("64px");
  });

  it("vetoes the beside places on a narrow or upright screen: no numbers written, the stylesheet's old places", () => {
    for (const [w, h] of [[390, 844], [844, 390], [820, 1180]]) {
      const { page, vars, dataset } = fakePage(w, h);

      expect(applyWordsLayout(page, cliff, marks)).toEqual({ beside: false });
      expect(vars[TITLE_VAR]).toBeUndefined();
      expect(vars[DY_VAR]).toBeUndefined();
      expect(dataset.words).toBe("old");
    }
  });
});
