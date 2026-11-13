import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAGMENT_SRC } from "../../ground/eclipse-shader";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const css = read("./hero.css");
const tokens = read("../../../styles/tokens.css");
const edge = /\.home-hero \.hero-edge \{([^}]*)\}/.exec(css)?.[1] ?? "";

describe("the painting's lower edge (spec 6)", () => {
  it("covers the last 18% of the hero, with one pixel past the seam", () => {
    expect(edge).toMatch(/height:\s*calc\(18% \+ 1px\);/);
    expect(edge).toMatch(/bottom:\s*-1px;/);
  });

  it("ramps from nothing to the seam colour on a smoothstep, so there is no start or finish to see", () => {
    const stops = [...edge.matchAll(/rgb\(var\(--hero-seam-rgb\)(?: \/ ([\d.]+))?\) (\d+)%/g)].map((m) => ({
      a: m[1] === undefined ? 1 : Number(m[1]),
      at: Number(m[2]) / 100,
    }));
    expect(stops.length).toBeGreaterThanOrEqual(8);
    expect(stops[0]).toEqual({ a: 0, at: 0 });
    expect(stops.at(-1)).toEqual({ a: 1, at: 1 });
    for (const { a, at } of stops) expect(Math.abs(a - at * at * (3 - 2 * at))).toBeLessThan(0.002);
  });

  it("ends on the colour the home section's Eclipse ground starts with: the shader's base colour, within 1 level", () => {
    const seam = /--hero-seam-rgb:\s*(\d+) (\d+) (\d+);/.exec(tokens)?.slice(1).map(Number) ?? [];
    expect(seam).toHaveLength(3);
    // `vec3 col=vec3(r,g,b);` is the colour of the ground with no light on it, which is all of the top row at placement 2
    const base = /vec3 col=vec3\(([\d.]+),([\d.]+),([\d.]+)\);/.exec(FRAGMENT_SRC)?.slice(1).map(Number) ?? [];
    expect(base).toHaveLength(3);
    seam.forEach((c, i) => expect(Math.abs(c - (base[i] ?? 0) * 255)).toBeLessThanOrEqual(1));
  });

  it("is a layer of the hero's own, under the lockup, caption and cue", () => {
    const tsx = read("./hero.tsx");
    expect(tsx.indexOf('className="hero-edge"')).toBeGreaterThan(tsx.indexOf('className="vignette"'));
    expect(tsx.indexOf('className="hero-edge"')).toBeLessThan(tsx.indexOf("<Lockup"));
  });
});
