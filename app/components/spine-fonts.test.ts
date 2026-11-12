import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SpineFonts, { SPINE_FONTS_HREF } from "./spine-fonts";

describe("SpineFonts", () => {
  it("renders on the server without a window: a print-media link and a plain noscript link", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(createElement(SpineFonts));
    expect(html).toContain('media="print"');
    expect(html).toContain("data-spine-fonts");
    expect(html).toMatch(/<noscript><link rel="stylesheet"[^>]*><\/noscript>/);
    expect(html).not.toMatch(/<noscript>[^]*media=[^]*<\/noscript>/);
  });

  it("asks for the six spine families and no interface family", () => {
    for (const f of ["Archivo", "Bodoni+Moda", "Newsreader", "Space+Grotesk", "Unbounded", "Young+Serif"]) {
      expect(SPINE_FONTS_HREF).toContain(`family=${f}`);
    }
    expect(SPINE_FONTS_HREF).not.toMatch(/Doto|Tektur|Lora|IBM|Space\+Mono/);
  });
});
