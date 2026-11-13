import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, luminance } from "./contrast";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const hex = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, "i").exec(css)?.[1] as string;

describe("contrast", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#fc4c00", "#fc4c00")).toBe(1);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });
  it("does not depend on the order", () => {
    expect(contrast("#d44000", "#ffffff")).toBe(contrast("#ffffff", "#d44000"));
  });
});

describe("the About and Credits tabs (spec 6)", () => {
  const ink = hex("--tab-ink");
  const lightest = hex("--accent-tab");
  const deepest = hex("--accent-deep");

  it("is a gradient from --accent-tab down to --accent-deep, the first the lightest point", () => {
    expect(/--tab-gradient:\s*linear-gradient\(180deg, var\(--accent-tab\), var\(--accent-deep\)\);/.test(css)).toBe(true);
    expect(luminance(lightest)).toBeGreaterThan(luminance(deepest));
  });

  it("keeps the white text at 4.5 to 1 or more on the lightest point (and so on every point of the gradient)", () => {
    // measured: white on #d44000 is 4.64; on #a02900 it is 7.47
    const onLightest = contrast(ink, lightest);
    const onDeepest = contrast(ink, deepest);
    expect(ink).toBe("#ffffff");
    expect(onLightest).toBeGreaterThanOrEqual(4.5);
    expect(onLightest).toBeLessThan(5); // not darker than it has to be: still reads as the accent's orange
    expect(onDeepest).toBeGreaterThan(onLightest);
  });

  it("starts below --accent because white on --accent itself is under 4.5 to 1", () => {
    // 3.40: the reason the lightest point is --accent-tab, not --accent
    expect(contrast(ink, hex("--accent"))).toBeLessThan(4.5);
    expect(contrast(ink, hex("--accent"))).toBeGreaterThan(3.3);
  });

  it("stays the accent's orange: the hue is within 4 degrees of --accent at both ends", () => {
    const hue = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
      const d = Math.max(r, g, b) - Math.min(r, g, b);
      return (((g - b) / d + 6) % 6) * 60;
    };
    expect(Math.abs(hue(lightest) - hue(hex("--accent")))).toBeLessThan(4);
    expect(Math.abs(hue(deepest) - hue(hex("--accent")))).toBeLessThan(4);
  });
});
