import { describe, expect, it } from "vitest";
import { bendAt, easeGlass, frontAt, GLASS, GLASS_EASING, glassVars, isChromium, REACH, WARP } from "./glass-math";

const radial = { kind: "radial", radius: 1000, width: 1440 };
const linear = { kind: "linear-right", radius: 1100, width: 1440 };

describe("GLASS", () => {
  it("holds the spec's numbers", () => {
    expect(GLASS).toEqual({ radialMs: 560, linearMs: 480, band: 0.07, bendPx: 22 });
    expect(GLASS_EASING).toBe("cubic-bezier(0.3, 0.7, 0.2, 1)");
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
  it("is fast at the start and slow at the end (cubic-bezier(0.3, 0.7, 0.2, 1))", () => {
    expect(easeGlass(0.1)).toBeGreaterThan(0.25);
    expect(easeGlass(0.5)).toBeGreaterThan(0.9);
    // values of the browser's own curve, at 0.12 and 0.3 of the time
    expect(easeGlass(0.12)).toBeCloseTo(0.31, 2);
    expect(easeGlass(0.3)).toBeCloseTo(0.744, 2);
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
  it("starts a radial front at the origin and ends it past the farthest corner, with the bend 0 at both ends", () => {
    const start = frontAt(0, radial);
    expect(start.radius).toBe(0);
    expect(start.bend).toBe(0);
    const end = frontAt(1, radial);
    // the opaque side of the soft, wandering edge (radius times 1 - band - warp) has reached the farthest corner
    expect((end.radius ?? 0) * (1 - GLASS.band - WARP)).toBeCloseTo(radial.radius, 5);
    expect(end.bend).toBe(0);
    expect(end.pos).toBeUndefined();
  });
  it("grows the radius and only the radius for radial kinds", () => {
    let last = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const f = frontAt(t, radial);
      expect(f.radius).toBeGreaterThanOrEqual(last);
      last = f.radius ?? 0;
      expect(f.pos).toBeUndefined();
    }
  });
  it("runs a linear front from just off the near edge to just past the far one", () => {
    const w = (GLASS.band + WARP) * linear.width;
    expect(frontAt(0, linear).pos).toBeCloseTo(-w);
    expect(frontAt(1, linear).pos).toBeCloseTo(linear.width + w);
    expect(frontAt(0.5, linear).radius).toBeUndefined();
    // the same for the other direction: the position is the distance travelled from the start edge
    expect(frontAt(1, { ...linear, kind: "linear-left" }).pos).toBeCloseTo(linear.width + w);
  });
  it("has the bend at full strength while the front crosses the screen", () => {
    expect(frontAt(0.2, radial).bend).toBe(1);
    expect(frontAt(0.3, linear).bend).toBe(1);
  });
});

describe("glassVars", () => {
  it("gives glass.css every constant, derived from the same ones the front and the pictures use", () => {
    const v = glassVars();
    expect(v["--change-band"]).toBe(String(GLASS.band));
    expect(v["--change-warp"]).toBe(String(WARP));
    const lead = GLASS.band + WARP;
    expect(Number(v["--change-lead"])).toBeCloseTo(lead, 6);
    expect(Number(v["--change-span"])).toBeCloseTo(1 + 2 * lead, 6);
    expect(Number(v["--change-travel"])).toBeCloseTo(1 / (1 - lead), 6);
    expect(Number(v["--change-reach"])).toBeCloseTo(1 + REACH * GLASS.band, 6);
    expect(v["--change-ease"]).toBe(GLASS_EASING);
  });
  it("agrees with frontAt: the radius at the end is the farthest corner times the travel; the linear end is the span less the lead", () => {
    const v = glassVars();
    expect(frontAt(1, radial).radius).toBeCloseTo(radial.radius * Number(v["--change-travel"]), 1);
    expect(frontAt(1, linear).pos).toBeCloseTo((Number(v["--change-span"]) - Number(v["--change-lead"])) * linear.width, 1);
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
