import { describe, expect, it } from "vitest";
import { placeholderArt } from "./placeholder-art";

const decode = (uri: string) => decodeURIComponent(uri.slice(uri.indexOf(",") + 1));

describe("placeholderArt", () => {
  it("is a data address holding an SVG that needs no network", () => {
    const uri = placeholderArt("short-01", true);
    const svg = decode(uri);

    expect(uri.startsWith("data:image/svg+xml,")).toBe(true);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/https?:|href=|<text|<image/);
  });

  it("is the same for the same seed and shape", () => {
    expect(placeholderArt("short-01", true)).toBe(placeholderArt("short-01", true));
    expect(placeholderArt("a", false)).toBe(placeholderArt("a", false));
  });

  it("differs between seeds and between upright and wide", () => {
    const seeds = Array.from({ length: 35 }, (_, i) => placeholderArt(`short-${i + 1}`, true));

    expect(new Set(seeds).size).toBe(35);
    expect(placeholderArt("a", true)).not.toBe(placeholderArt("a", false));
  });

  it("is 9 by 16 when upright and 16 by 9 when wide", () => {
    expect(decode(placeholderArt("a", true))).toContain('viewBox="0 0 360 640"');
    expect(decode(placeholderArt("a", false))).toContain('viewBox="0 0 640 360"');
  });

  it("has an intrinsic size (width and height), so a canvas can draw it in every browser", () => {
    expect(decode(placeholderArt("a", true))).toMatch(/<svg [^>]*width="360" height="640"/);
    expect(decode(placeholderArt("a", false))).toMatch(/<svg [^>]*width="640" height="360"/);
  });

  it("draws a dark ground and two or three soft shapes", () => {
    for (let i = 0; i < 20; i++) {
      const svg = decode(placeholderArt(`seed-${i}`, i % 2 === 0));
      const shapes = svg.match(/<circle /g)?.length ?? 0;

      expect(shapes).toBeGreaterThanOrEqual(2);
      expect(shapes).toBeLessThanOrEqual(3);
      expect(svg).toMatch(/<rect [^>]*fill="hsl\(\d+ \d+% (\d|1\d)%\)"/);
    }
  });
});
