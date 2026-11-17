import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlassFilter, { GLASS_IDS, MAP_K, mapId, mapValue, vignetteId } from "./glass-filter";

const markup = renderToStaticMarkup(createElement(GlassFilter));
const filterOf = (id: string) => {
  const m = markup.match(new RegExp(`<filter id="${id}"[\\s\\S]*?</filter>`));
  if (!m) throw new Error(`no filter ${id}`);
  return m[0];
};

describe("the bend's filters (R56: one map picture each)", () => {
  for (const id of Object.values(GLASS_IDS)) {
    it(`${id} holds exactly one map picture besides the vignette`, () => {
      const f = filterOf(id);
      const images = f.match(/<feImage\b[^>]*>/g) ?? [];
      expect(images).toHaveLength(2);
      expect(images.filter((i) => i.includes(`id="${mapId(id)}"`))).toHaveLength(1);
      expect(images.filter((i) => i.includes(`id="${vignetteId(id)}"`))).toHaveLength(1);
      expect(f).not.toContain("-tile-");
    });

    it(`${id} pushes the picture three times (red, green, blue)`, () => {
      expect((filterOf(id).match(/<feDisplacementMap\b/g) ?? []).length).toBe(3);
    });
  }

  for (const id of Object.values(GLASS_IDS)) {
    it(`${id} makes the map as 1/2 plus the direction picture's push times the strength tile (R129)`, () => {
      const f = filterOf(id);
      expect(f).toContain('in="strength"');
      expect(f).toContain('in2="direction"');
      // strength * direction - strength * 128 / 255 + 1 / 2 (R130)
      const k = f.match(/<feComposite in="strength"[^>]*>/)?.[0] ?? "";
      expect(k).toContain('operator="arithmetic"');
      for (const name of ["k1", "k2", "k3", "k4"] as const) expect(k).toContain(`${name}="${MAP_K[name]}"`);
    });
  }

  it("a neutral direction (byte 128) gives exactly no push at every strength, damp 1 and 0.5 included (R130)", () => {
    // the map's value minus 1/2 is the push in units of the scale; a displacement map byte of 128 / 255 is the vignette's neutral
    for (const damp of [1, 0.5, 0.25, 0]) for (const strength of [0, 0.3, 1]) expect(mapValue(strength * damp, 128 / 255) - 0.5).toBeCloseTo(0, 14);
    // the old constant (k2 = -1/2) left 0.00196 of the strength: half a pixel at a scale of 255
    expect((128 / 255 - 0.5) * 255).toBeCloseTo(0.5, 12);
  });

  it("the push stays signed about the neutral: a direction above 128 pushes one way and below the other", () => {
    expect(mapValue(1, 255 / 255) - 0.5).toBeGreaterThan(0.49);
    expect(mapValue(1, 0) - 0.5).toBeLessThan(-0.49);
  });

  it("the two filters have their own ids", () => {
    expect(new Set(Object.values(GLASS_IDS)).size).toBe(2);
    expect(mapId(GLASS_IDS.old)).not.toBe(mapId(GLASS_IDS.new));
  });
});
