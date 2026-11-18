import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SPINE_FONT_SHEETS } from "../styles/fonts";
import SpineFonts from "./spine-fonts";

describe("SpineFonts", () => {
  it("renders on the server without a window: print-media links and a plain noscript copy", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(createElement(SpineFonts));
    expect(html).toContain('media="print"');
    expect(html).toContain("data-spine-fonts");
    expect(html).toMatch(/<noscript><link rel="stylesheet"[^>]*><\/noscript>/);
    expect(html).not.toMatch(/<noscript>[^]*media=[^]*<\/noscript>/);
  });

  it("links every spine sheet with media=print and data-spine-fonts, and again without the media in the noscript", () => {
    const html = renderToString(createElement(SpineFonts));
    const [main, noscript = ""] = html.split("<noscript>");
    for (const href of SPINE_FONT_SHEETS) {
      expect(main).toMatch(new RegExp(`<link rel="stylesheet" href="${href}" media="print" data-spine-fonts=""`));
      expect(noscript).toContain(`href="${href}"`);
    }
  });

  it("asks no other origin for anything", () => {
    const html = renderToString(createElement(SpineFonts));
    expect(html).not.toMatch(/googleapis|gstatic|https?:\/\//);
    for (const href of SPINE_FONT_SHEETS) expect(href === "" || href.startsWith("/")).toBe(true); // an empty string under vitest (see styles/fonts.test.ts)
  });
});
