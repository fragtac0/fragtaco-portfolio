import { describe, expect, it } from "vitest";
import { bendAt, easeGlass, frontAt, GLASS, GLASS_EASING, glassVars, isChromium, judgeGlass, REACH, SIGHT_FRAMES, WARP } from "./glass-math";

const radial = { radius: 1000 };

describe("GLASS", () => {
  it("holds the spec's numbers", () => {
    expect(GLASS).toEqual({ ms: 3500, band: 0.07, bendPx: 22 });
    expect(GLASS_EASING).toBe("cubic-bezier(0.65, 0, 0.35, 1)");
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
  it("rises to 1 by 15%, holds, and falls to 0 from 80%", () => {
    expect(bendAt(0)).toBe(0);
    expect(bendAt(0.15)).toBe(1);
    expect(bendAt(0.5)).toBe(1);
    expect(bendAt(0.8)).toBe(1);
    expect(bendAt(1)).toBe(0);
    expect(bendAt(0.07)).toBeGreaterThan(0);
    expect(bendAt(0.07)).toBeLessThan(1);
    expect(bendAt(0.9)).toBeGreaterThan(0);
    expect(bendAt(0.9)).toBeLessThan(1);
  });
});

describe("frontAt", () => {
  it("starts the front at the origin and ends it past the farthest corner, with the bend 0 at both ends", () => {
    const start = frontAt(0, radial);
    expect(start.radius).toBe(0);
    expect(start.bend).toBe(0);
    const end = frontAt(1, radial);
    // the opaque side of the soft, wandering edge (radius times 1 - band - warp) has reached the farthest corner
    expect(end.radius * (1 - GLASS.band - WARP)).toBeCloseTo(radial.radius, 5);
    expect(end.bend).toBe(0);
  });
  it("grows the radius and never shrinks it", () => {
    let last = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const f = frontAt(t, radial);
      expect(f.radius).toBeGreaterThanOrEqual(last);
      last = f.radius;
    }
  });
  it("has the bend at full strength while the front crosses the screen", () => {
    expect(frontAt(0.5, radial).bend).toBe(1);
    expect(frontAt(0.4, radial).bend).toBe(1);
  });
});

describe("glassVars", () => {
  it("gives glass.css every constant, derived from the same ones the front and the pictures use", () => {
    const v = glassVars();
    expect(v["--change-band"]).toBe(String(GLASS.band));
    expect(v["--change-warp"]).toBe(String(WARP));
    const lead = GLASS.band + WARP;
    expect(Number(v["--change-lead"])).toBeCloseTo(lead, 6);
    expect(v["--change-span"]).toBeUndefined();
    expect(Number(v["--change-travel"])).toBeCloseTo(1 / (1 - lead), 6);
    expect(Number(v["--change-reach"])).toBeCloseTo(1 + REACH * GLASS.band, 6);
    expect(v["--change-ease"]).toBe(GLASS_EASING);
  });
  it("agrees with frontAt: the radius at the end is the farthest corner times the travel", () => {
    const v = glassVars();
    expect(frontAt(1, radial).radius).toBeCloseTo(radial.radius * Number(v["--change-travel"]), 1);
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
