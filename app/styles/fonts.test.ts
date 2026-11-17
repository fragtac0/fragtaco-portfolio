import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FONT_PRELOADS, INTERFACE_FONT_SHEETS, SPINE_FONT_SHEETS } from "./fonts";

// Under vitest a stylesheet imported with ?url is an empty string (the real hashed address is made by the build and checked in the served HTML).
const onThisSite = (href: string) => href === "" || (href.startsWith("/") && !href.startsWith("//"));
const css = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const familiesIn = (text: string) => new Set([...text.matchAll(/font-family:"([^"]+)"/g)].map((m) => m[1]));

describe("the site's fonts", () => {
  it("no page asks another origin for a font or a stylesheet", () => {
    for (const href of [...INTERFACE_FONT_SHEETS, ...SPINE_FONT_SHEETS]) expect(onThisSite(href)).toBe(true);
    for (const href of FONT_PRELOADS) expect(onThisSite(href)).toBe(true);
  });

  it("at most two font files are preloaded for a page", () => {
    expect(FONT_PRELOADS.length).toBeLessThanOrEqual(2);
  });

  it("a preloaded file is a woff2 on this site (none is preloaded today: the measured LCP was worse, see fonts.ts)", () => {
    for (const href of FONT_PRELOADS) expect(href).toMatch(/^\/.*\.woff2(\?|$)/);
  });

  it("the interface sheet declares the five interface families by the names the site asks for, and no spine family", () => {
    expect([...familiesIn(css("fonts-interface.css"))].sort()).toEqual(["Doto", "IBM Plex Mono", "Lora", "Space Mono", "Tektur"]);
  });

  it("the spine sheet declares the six spine families by the names the spines draw with, and no interface family", () => {
    expect([...familiesIn(css("fonts-spine.css"))].sort()).toEqual([
      "Archivo", "Bodoni Moda", "Newsreader", "Space Grotesk", "Unbounded", "Young Serif",
    ]);
  });

  it("every face keeps font-display: swap and points at a file on this site, none at another origin", () => {
    for (const sheet of ["fonts-interface.css", "fonts-spine.css"]) {
      const text = css(sheet);
      const faces = text.match(/@font-face\{[^}]*\}/g) ?? [];
      expect(faces.length).toBeGreaterThan(20);
      for (const face of faces) {
        expect(face).toContain("font-display:swap");
        expect(face).toMatch(/src:url\("\.\.\/\.\.\/node_modules\/@fontsource/);
        expect(face).not.toMatch(/https?:\/\//);
      }
    }
  });

  it("the width axis (Archivo) and the weight ranges are the ones the two Google stylesheets asked for", () => {
    const spine = css("fonts-spine.css");
    expect(spine).toMatch(/font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%/);
    expect(spine).toMatch(/font-family:"Archivo";font-style:italic;font-weight:100 900;font-stretch:62% 125%/);
    expect(spine).toMatch(/font-family:"Bodoni Moda";font-style:italic;font-weight:400 900/);
    expect(spine).toMatch(/font-family:"Newsreader";font-style:normal;font-weight:300 800/);
    const ui = css("fonts-interface.css");
    expect(ui).toMatch(/font-family:"Doto";font-style:normal;font-weight:400 900/);
    expect(ui).toMatch(/font-family:"Space Mono";font-style:italic;font-weight:400/);
    expect(ui).toMatch(/font-family:"Tektur";font-style:normal;font-weight:500 800/);
  });
});
