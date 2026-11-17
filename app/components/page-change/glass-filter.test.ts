import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlassFilter, { GLASS_IDS, mapId, vignetteId } from "./glass-filter";

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
      // strength * direction - strength / 2 + 1 / 2
      const k = f.match(/<feComposite in="strength"[^>]*>/)?.[0] ?? "";
      expect(k).toContain('operator="arithmetic"');
      for (const [name, value] of [["k1", "1"], ["k2", "-0.5"], ["k3", "0"], ["k4", "0.5"]]) expect(k).toContain(`${name}="${value}"`);
    });
  }

  it("the two filters have their own ids", () => {
    expect(new Set(Object.values(GLASS_IDS)).size).toBe(2);
    expect(mapId(GLASS_IDS.old)).not.toBe(mapId(GLASS_IDS.new));
  });
});
