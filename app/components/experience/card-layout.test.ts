import { describe, expect, it } from "vitest";
import experience from "../../../content/site/experience.json";
import { cardSize, planCards, scaleOfStep, zoomStepOf } from "./card-layout";
import { frameOf } from "./geo";
import { buildJourney, dotBox, hits, sideRect } from "./journey";

const frame = { ...frameOf(experience.frame.centre, experience.frame.spanDeg), lonScale: 0.9490631544751487, size: 8192 };
const journey = buildJourney(experience.route, experience.moments, "2026-11-12", frame);
const preferred = journey.moments.map((m) => m.placement);
const fit = (w: number, h: number) => (0.78 * Math.min(w, h)) / (0.67 * 8192);
const plan = (scale: number, active: number | null) => planCards(journey.moments, experience.moments, preferred, scale, active);

/** The screen rectangle of moment `i`'s card for its plan. */
function boxOf(i: number, scale: number, p: ReturnType<typeof plan>[number]) {
  const { w, h } = cardSize(experience.moments[i], p.compact);
  const r = sideRect(p.side, w, h);
  const m = journey.moments[i];

  return { x0: m.x * scale + r.x0, x1: m.x * scale + r.x1, y0: m.y * scale + r.y0, y1: m.y * scale + r.y1 };
}

describe("cardSize", () => {
  it("is as wide for every card, and shorter without the line", () => {
    const text = { title: "First editing job", line: "Part-time short form editor at Bharat in Germany, while finishing the degree." };

    expect(cardSize(text, true).w).toBe(cardSize(text, false).w);
    expect(cardSize(text, true).h).toBeLessThan(cardSize(text, false).h);
    expect(cardSize({ ...text, line: "x".repeat(200) }, false).h).toBeGreaterThan(cardSize(text, false).h);
  });
});

describe("planCards", () => {
  it("gives every card its full words and its preferred side where the moments are far apart", () => {
    const far = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 0, y: 4000 }];
    const texts = [0, 1, 2].map(() => ({ title: "Title", line: "A line." }));
    const plans = planCards(far, texts, ["n", "e", "w"], 0.5, null);

    expect(plans).toEqual([
      { side: "n", compact: false, fits: true },
      { side: "e", compact: false, fits: true },
      { side: "w", compact: false, fits: true },
    ]);
  });

  it("collapses the one that is not active where two cannot both fit, and never the active one (the real route at a tablet's smallest explore zoom)", () => {
    const scale = 0.15;
    const plans = plan(scale, 8);
    const collapsed = plans.filter((p) => p.compact && p.fits);

    expect(collapsed.length).toBeGreaterThan(0);
    expect(plans[8]).toMatchObject({ compact: false, fits: true });
    // at twice that zoom there is room for every card in full
    expect(plan(0.3, 8).some((p) => p.compact)).toBe(false);
  });

  it("keeps the preferred side, collapsed, and says it does not fit when nothing clears", () => {
    const crowd = Array.from({ length: 6 }, () => ({ x: 0, y: 0 }));
    const texts = crowd.map(() => ({ title: "Title", line: "A line." }));
    const plans = planCards(crowd, texts, ["n", "s", "e", "w", "ne", "sw"], 1, 0);

    expect(plans.some((p) => !p.fits)).toBe(true);
    expect(plans[0].compact).toBe(false);
    plans.forEach((p, i) => {
      if (!p.fits) expect(p).toEqual({ side: ["n", "s", "e", "w", "ne", "sw"][i], compact: i !== 0, fits: false });
    });
  });

  describe("on the real route", () => {
    // 3 times the overview's scale on a 1440 x 900 screen, and at 2 times (where explore starts) and 1 (the picture's native size)
    for (const [name, scale] of [["2x", 2 * fit(1440, 900)], ["3x", 3 * fit(1440, 900)], ["native", 1]] as const) {
      for (const active of [null, 1, 2]) {
        it(`puts no card on another card or on a dot at ${name}${active === null ? "" : ` with moment ${active} active`}`, () => {
          const plans = plan(scale, active);
          const boxes = plans.map((p, i) => boxOf(i, scale, p));

          plans.forEach((p, i) => {
            if (!p.fits) return;
            journey.moments.forEach((m, k) => {
              if (k !== i) expect(hits(boxes[i], dotBox(m, scale)), `card ${i} on dot ${k}`).toBe(false);
              if (k > i && plans[k].fits) expect(hits(boxes[i], boxes[k]), `card ${i} on card ${k}`).toBe(false);
            });
          });
          if (active !== null) expect(plans[active].compact).toBe(false);
        });
      }
    }

    it("shows February and June 2021, 0.049 of the route apart, in full at the native size and with at least one in full at 3x", () => {
      const native = plan(1, null);

      expect(native[1].compact || native[2].compact).toBe(false);
      const three = plan(3 * fit(1440, 900), null);

      expect(three[1].compact && three[2].compact).toBe(false);
      expect(three.every((p) => p.fits)).toBe(true);
    });
  });
});

describe("the zoom step", () => {
  it("is the quarter octave at or below the scale, and the scale of a step is where it starts", () => {
    for (const s of [0.05, 0.128, 0.256, 0.384, 0.9999, 1]) {
      const step = zoomStepOf(s);

      expect(scaleOfStep(step)).toBeLessThanOrEqual(s * (1 + 1e-12));
      expect(scaleOfStep(step + 1)).toBeGreaterThan(s);
    }
    expect(zoomStepOf(1)).toBe(0);
    expect(scaleOfStep(4)).toBe(2);
  });
});
