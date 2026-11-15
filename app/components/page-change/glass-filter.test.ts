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

  it("the two filters have their own ids", () => {
    expect(new Set(Object.values(GLASS_IDS)).size).toBe(2);
    expect(mapId(GLASS_IDS.old)).not.toBe(mapId(GLASS_IDS.new));
  });
});
