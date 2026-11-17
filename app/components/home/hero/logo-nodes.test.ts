import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { svgChildren } from "./logo-nodes";

const html = (nodes: ReactNode[]) => renderToStaticMarkup(createElement("svg", null, ...nodes)).replace(/^<svg>|<\/svg>$/g, "");
// the file writes empty elements as <x/>; React writes <x></x>: the same element
const expanded = (s: string) => s.replace(/<([a-z]+)((?:\s[^>]*?)?)\/>/g, "<$1$2></$1>");
const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

describe("svgChildren", () => {
  it("draws the logo's own SVG file exactly: the same elements, attributes and path data in the same order", () => {
    const file = readFileSync(fileURLToPath(new URL("./fragtaco-lockup.svg", import.meta.url)), "utf8");
    expect(html(svgChildren(file))).toBe(expanded(inner(file)));
  });

  it("keeps the parts the loader's CSS and the mask rely on", () => {
    const file = readFileSync(fileURLToPath(new URL("./fragtaco-lockup.svg", import.meta.url)), "utf8");
    const out = html(svgChildren(file));
    expect(out).toContain('<mask id="fragCut" maskUnits="userSpaceOnUse"');
    expect(out).toContain('<g class="gw">');
    expect(out.match(/<g class="gl">/g)?.length).toBe(4);
    expect(out).toContain('mask="url(#fragCut)"');
  });

  it("reads nested, self-closing and class attributes", () => {
    const svg = '<svg xmlns="x" viewBox="0 0 1 1"><g class="a"><rect x="1" y="2"/><path d="M0 0"/></g><g/></svg>';
    expect(html(svgChildren(svg))).toBe('<g class="a"><rect x="1" y="2"></rect><path d="M0 0"></path></g><g></g>');
  });

  it("refuses an element it does not know, a stray close and an unclosed element, rather than drawing the logo wrong", () => {
    expect(() => svgChildren("<svg><script>alert(1)</script></svg>")).toThrow(/not one the logo reader knows/);
    expect(() => svgChildren('<svg><image href="x"/></svg>')).toThrow(/not one/);
    expect(() => svgChildren("<svg></g></svg>")).toThrow(/does not close/);
    expect(() => svgChildren("<svg><g></svg>")).toThrow(/never closed/);
    expect(() => svgChildren("<svg><g>text</g></svg>")).toThrow(/unreadable/);
  });

  it("the module's own list is made from the real file without throwing", async () => {
    const { LOGO_NODES } = await import("./logo-nodes");
    expect(LOGO_NODES.length).toBe(3);
  });
});
