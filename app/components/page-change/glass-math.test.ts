import { describe, expect, it } from "vitest";
import {
  BEND_NEW,
  BEND_OLD,
  bendAt,
  bendPxFor,
  bendProfile,
  easeGlass,
  FRONT_CLEAR,
  FRONT_START,
  frontAt,
  GLASS,
  GLASS_EASING,
  glassVars,
  glowAt,
  isChromium,
  judgeGlass,
  SIGHT_FRAMES,
  SPAN,
  SPLIT,
  UNCOVERED_AT,
  WARP,
} from "./glass-math";

const radial = { radius: 1000 };

describe("GLASS", () => {
  it("holds the follow-up spec's numbers (4): 2.5 s, a 15% band, a bend of 5.7% of the height capped at 64 px, a 12% wander, a colour split", () => {
    expect(GLASS).toEqual({ ms: 2500, band: 0.15, bendShare: 0.057, bendMaxPx: 64 });
    expect(WARP).toBe(0.12);
    expect(SPLIT).toEqual({ r: 1.29, g: 1, b: 0.71 });
    expect(UNCOVERED_AT).toBe(0.95);
    expect(GLASS_EASING).toBe("cubic-bezier(0.65, 0, 0.35, 1)");
  });
});

describe("bendPxFor", () => {
  it("is 5.7% of the viewport's height, rounded, and never more than 64 px", () => {
    expect(bendPxFor(900)).toBe(51);
    expect(bendPxFor(844)).toBe(48);
    expect(bendPxFor(2000)).toBe(64);
    expect(bendPxFor(1125)).toBe(64);
    expect(bendPxFor(0)).toBe(0);
  });
});

describe("bendProfile", () => {
  it("is 1 at the front, and the push changes side with x (the lens): larger outside, smaller inside", () => {
    expect(bendProfile(0)).toBe(1);
    expect(bendProfile(0.3)).toBeGreaterThan(1);
    expect(bendProfile(-0.3)).toBeLessThan(1);
    expect(bendProfile(0.5)).toBeGreaterThan(bendProfile(-0.5));
    // the lens term is odd in x, the bell term even
    const bell = (x: number) => Math.exp(-1.6 * x * x);
    for (const x of [0.2, 0.7, 1.3]) expect(bendProfile(x) + bendProfile(-x)).toBeCloseTo(2 * bell(x), 9);
  });
  it("is the tenth preview's push: (exp(-1.6 x^2) * 0.03 + x * exp(-0.9 x^2) * 0.022) / 0.03", () => {
    for (const x of [-2, -1, -0.3, 0.3, 1, 2]) {
      expect(bendProfile(x)).toBeCloseTo((Math.exp(-1.6 * x * x) * 0.03 + x * Math.exp(-0.9 * x * x) * 0.022) / 0.03, 12);
    }
  });
  it("is under 0.02 beyond three half-bands, both sides", () => {
    for (const x of [3, 3.5, 5, -3, -3.5, -5]) expect(Math.abs(bendProfile(x))).toBeLessThan(0.02);
  });
});

describe("glowAt", () => {
  it("is 0.16 at the front and about 0.05 at the outer rim (0.9 half-bands out), and gone far away", () => {
    expect(Math.abs(glowAt(0) - 0.16)).toBeLessThan(1e-6);
    expect(glowAt(0.9)).toBeGreaterThan(0.05);
    expect(glowAt(0.9)).toBeLessThan(0.06);
    expect(glowAt(-2)).toBeLessThan(0.001);
    expect(glowAt(3)).toBeLessThan(0.001);
  });
  it("is the tenth preview's glint: 0.16 exp(-30 x^2) + 0.05 exp(-14 (x - 0.9)^2)", () => {
    for (const x of [-1, -0.2, 0.1, 0.5, 0.9, 1.4]) {
      expect(glowAt(x)).toBeCloseTo(0.16 * Math.exp(-30 * x * x) + 0.05 * Math.exp(-14 * (x - 0.9) ** 2), 12);
    }
  });
});

describe("easeGlass", () => {
  it("runs from 0 to 1 and never goes back", () => {
    expect(easeGlass(0)).toBe(0);
    expect(easeGlass(1)).toBe(1);
    let last = 0;
    for (let t = 0.01; t <= 1; t += 0.01) {
      const p = easeGlass(t);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });
  it("eases in and out like the painting's sweep (cubic-bezier(0.65, 0, 0.35, 1)): slow at both ends, fastest in the middle", () => {
    expect(easeGlass(0.1)).toBeLessThan(0.02);
    expect(easeGlass(0.5)).toBeCloseTo(0.5, 5);
    expect(easeGlass(0.9)).toBeGreaterThan(0.98);
    // symmetric about the middle
    for (const t of [0.1, 0.25, 0.4]) expect(easeGlass(t) + easeGlass(1 - t)).toBeCloseTo(1, 4);
    // close to the painting's own curve (4t^3 then 1 - (-2t + 2)^3 / 2), as the CSS curve cannot be it exactly
    const own = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    for (let t = 0; t <= 1; t += 0.05) expect(Math.abs(easeGlass(t) - own(t))).toBeLessThan(0.03);
  });
});

describe("bendAt", () => {
  it("starts while the front is still behind the middle (p 0.05), reaches 1 by 0.15, holds, and falls to 0 from 0.93", () => {
    expect(bendAt(0)).toBe(0);
    expect(bendAt(0.05)).toBe(0);
    expect(bendAt(0.15)).toBe(1);
    expect(bendAt(0.5)).toBe(1);
    expect(bendAt(0.93)).toBe(1);
    expect(bendAt(1)).toBe(0);
    expect(bendAt(0.1)).toBeGreaterThan(0);
    expect(bendAt(0.1)).toBeLessThan(1);
    expect(bendAt(0.97)).toBeGreaterThan(0);
    expect(bendAt(0.97)).toBeLessThan(1);
  });
});

describe("frontAt", () => {
  it("starts a band behind the origin (R109), so the outer soft edge is just at it: none of the new page on the screen at t = 0, and no lead-in beyond that", () => {
    const start = frontAt(0, radial);
    expect(start.radius).toBeCloseTo(-GLASS.band * radial.radius, 9);
    expect(start.opening).toBeCloseTo(0, 9);
    expect(start.bend).toBe(0);
    expect(FRONT_START).toBe(-GLASS.band);
  });
  it("has opened at least 2% of the farthest-corner distance by 20% of the time (the drawn share is tested in glass-field.test.ts)", () => {
    expect(frontAt(0.2, radial).opening).toBeGreaterThanOrEqual(0.02 * radial.radius);
    expect(frontAt(0.1, radial).opening).toBeGreaterThan(0);
  });
  it("has the screen clear at 0.95 of the time, to the wander's worst, and not before (R62)", () => {
    // the farthest corner is fully the new page once the front's middle is a band past it and its wander (12% of the front's radius) is at its worst
    const clear = ((1 + GLASS.band) / (1 - WARP)) * radial.radius;
    expect(FRONT_CLEAR).toBeCloseTo((1 + GLASS.band) / (1 - WARP), 9);
    expect(FRONT_CLEAR - WARP * FRONT_CLEAR - GLASS.band).toBeCloseTo(1, 9);
    expect(frontAt(UNCOVERED_AT, radial).radius).toBeCloseTo(clear, 6);
    expect(frontAt(UNCOVERED_AT - 0.02, radial).radius).toBeLessThan(clear);
    expect(frontAt(0.8, radial).radius).toBeLessThan(clear);
    // the same on every screen: the front scales with the radius
    expect(frontAt(UNCOVERED_AT, { radius: 400 }).radius).toBeCloseTo(FRONT_CLEAR * 400, 6);
    // it keeps going to the end of the change, a little past
    expect(frontAt(1, radial).radius).toBeGreaterThanOrEqual(clear);
    expect(frontAt(1, radial).bend).toBe(0);
    expect(SPAN).toBeGreaterThan(FRONT_CLEAR - FRONT_START);
  });
  it("grows the radius and never shrinks it", () => {
    let last = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const f = frontAt(t, radial);
      expect(f.radius).toBeGreaterThanOrEqual(last);
      last = f.radius;
    }
  });
  it("has the bend at full strength while the front crosses the screen", () => {
    expect(frontAt(0.5, radial).bend).toBe(1);
    expect(frontAt(0.6, radial).bend).toBe(1);
  });
});

describe("glassVars", () => {
  it("gives glass.css every constant, derived from the same ones the front and the pictures use", () => {
    const v = glassVars();
    expect(v["--change-band"]).toBe(String(GLASS.band));
    expect(v["--change-warp"]).toBe(String(WARP));
    expect(Number(v["--change-start"])).toBeCloseTo(FRONT_START, 6);
    expect(Number(v["--change-span"])).toBeCloseTo(SPAN, 6);
    expect(v["--change-ease"]).toBe(GLASS_EASING);
  });
  it("agrees with frontAt: the radius is the start plus the span times the eased progress, in farthest-corner distances", () => {
    const v = glassVars();
    for (const t of [0, 0.3, 0.7, 1]) {
      expect(frontAt(t, radial).radius).toBeCloseTo(radial.radius * (Number(v["--change-start"]) + Number(v["--change-span"]) * easeGlass(t)), 3);
    }
  });
});

describe("isChromium", () => {
  it("accepts Chrome, headless Chrome and Edge, and not Safari or Firefox", () => {
    expect(isChromium("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36")).toBe(true);
    expect(isChromium("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36")).toBe(true);
    expect(isChromium("Mozilla/5.0 AppleWebKit/537.36 Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0")).toBe(true);
    expect(isChromium("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")).toBe(false);
    expect(isChromium("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe(false);
  });
});

describe("judgeGlass", () => {
  const seen = { frames: 3, found: true, timeMs: 50, progress: 0.4, computed: 0.4 };
  it("accepts an animation that has advanced and has progress", () => {
    expect(judgeGlass(seen)).toBe("ok");
  });
  it("does not count an empty or unreadable computed value against it (WebKit)", () => {
    expect(judgeGlass({ ...seen, computed: null })).toBe("ok");
  });
  it("waits while the animation has not shown up, started or advanced yet", () => {
    expect(judgeGlass({ ...seen, found: false, frames: 2 })).toBe("wait");
    expect(judgeGlass({ ...seen, timeMs: null })).toBe("wait");
    expect(judgeGlass({ ...seen, timeMs: 4, frames: 1 })).toBe("wait");
    expect(judgeGlass({ ...seen, frames: 1 })).toBe("wait");
  });
  it("falls back when the animation never shows up in the list", () => {
    expect(judgeGlass({ ...seen, found: false, frames: SIGHT_FRAMES })).toBe("fallback");
  });
  it("falls back when the animation has advanced but its progress stays 0", () => {
    expect(judgeGlass({ ...seen, progress: 0 })).toBe("fallback");
  });
  it("falls back when the style says 0 though the animation has clearly progressed", () => {
    expect(judgeGlass({ ...seen, computed: 0, progress: 0.5 })).toBe("fallback");
    // a style of 0 early in the easing, before any progress to speak of, is not a failure yet: look again
    expect(judgeGlass({ ...seen, computed: 0, progress: 0.01 })).toBe("wait");
    // with no readable progress, a style of 0 only counts once the animation has run for a while
    expect(judgeGlass({ ...seen, computed: 0, progress: null, timeMs: 60 })).toBe("ok");
    expect(judgeGlass({ ...seen, computed: 0, progress: null, timeMs: 200 })).toBe("fallback");
  });
  it("never falls back just because the animation has not advanced (a paused or throttled page)", () => {
    expect(judgeGlass({ ...seen, timeMs: 0, frames: 500 })).toBe("wait");
  });
});

describe("BEND_NEW (R56)", () => {
  it("the arriving page gets half of the push; the page being left has all of it", () => {
    expect(BEND_NEW).toBe(0.5);
    expect(BEND_OLD).toBe(1);
  });
});
