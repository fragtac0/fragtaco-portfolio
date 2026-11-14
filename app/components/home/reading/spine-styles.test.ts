import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EDGE_BELOW_CONTRAST,
  MIN_ACCENT_CONTRAST,
  MIN_INK_CONTRAST,
  contrast,
  luminance,
  mix,
  needsEdge,
  parseHex,
  spineColours,
  toHex,
} from "./spine-styles";

const books = (
  JSON.parse(
    readFileSync(path.join(process.cwd(), "content", "site", "books.json"), "utf8"),
  ) as { items: { id: string; color: string }[] }
).items;

describe("colour maths", () => {
  it("round trips hex", () => {
    expect(toHex(parseHex("#c2410c"))).toBe("#c2410c");
    expect(toHex([300, -4, 7.6])).toBe("#ff0008");
  });
  it("has the WCAG extremes", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 6);
    expect(luminance("#000000")).toBeCloseTo(0, 6);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(contrast("#777777", "#777777")).toBe(1);
  });
  it("mixes", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#102030", "#102030", 0.7)).toBe("#102030");
  });
});

describe("spineColours", () => {
  it("puts light ink on a dark ground and dark ink on a light one, ground untouched", () => {
    const dark = spineColours({ dominant: "#151312", secondary: "#c79a2a" });
    expect(dark.ground).toBe("#151312");
    expect(luminance(dark.ink)).toBeGreaterThan(0.5);
    const pale = spineColours({ dominant: "#ece6d6", secondary: "#a8352a" });
    expect(pale.ground).toBe("#ece6d6");
    expect(luminance(pale.ink)).toBeLessThan(0.1);
  });

  it("gives every book's own colour ink of at least 4.5:1 and an accent of at least 3:1", () => {
    for (const b of books) {
      const c = spineColours({ dominant: b.color, secondary: b.color });
      expect(contrast(c.ink, c.ground), b.id).toBeGreaterThanOrEqual(MIN_INK_CONTRAST);
      expect(contrast(c.accent, c.ground), b.id).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
    }
  });

  it("moves a mid tone ground that neither ink would read on, and only that one", () => {
    const mid = "#8a6a4a"; // contrast with both inks is under 4.5
    const before = Math.max(contrast("#f6f0e2", mid), contrast("#17120d", mid));
    expect(before).toBeLessThan(MIN_INK_CONTRAST);
    const c = spineColours({ dominant: mid, secondary: "#222222" });
    expect(c.ground).not.toBe(mid);
    expect(contrast(c.ink, c.ground)).toBeGreaterThanOrEqual(MIN_INK_CONTRAST);
  });

  it("no colour pair fails the rule (a 17 x 17 x 17 grid of grounds against a spread of accents)", () => {
    const steps = Array.from({ length: 17 }, (_, i) => Math.min(255, i * 16));
    const accents = ["#000000", "#ffffff", "#808080", "#ff0000", "#00ff00", "#0000ff", "#c2410c"];
    let n = 0;
    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const dominant = toHex([r, g, b]);
          for (const secondary of accents) {
            const c = spineColours({ dominant, secondary });
            if (contrast(c.ink, c.ground) < MIN_INK_CONTRAST) {
              throw new Error(`ink fails on ${dominant}: ${c.ground} ${c.ink}`);
            }
            if (contrast(c.accent, c.ground) < MIN_ACCENT_CONTRAST) {
              throw new Error(`accent fails on ${dominant}/${secondary}`);
            }
            n++;
          }
        }
      }
    }
    expect(n).toBe(17 * 17 * 17 * accents.length);
  });
});

describe("needsEdge", () => {
  const tokens = readFileSync(path.join(process.cwd(), "app", "styles", "tokens.css"), "utf8");
  const pageGround = /--ground:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1] ?? "";

  it("compares against the --ground of tokens.css", () => {
    expect(pageGround).toMatch(/^#[0-9a-f]{6}$/i);
    expect(needsEdge(pageGround)).toBe(true);
  });

  it("is on for near black spines and off for any that read against the ground", () => {
    for (const hex of ["#000000", "#050505", "#0e0e0d", "#151312", "#1c1b19", "#201f1d"]) {
      expect(contrast(hex, pageGround), hex).toBeLessThan(EDGE_BELOW_CONTRAST);
      expect(needsEdge(hex), hex).toBe(true);
    }
    for (const hex of ["#2c3b43", "#3a3a38", "#a8352a", "#1f4b73", "#ece6d6", "#3a4a5a"]) {
      expect(contrast(hex, pageGround), hex).toBeGreaterThanOrEqual(EDGE_BELOW_CONTRAST);
      expect(needsEdge(hex), hex).toBe(false);
    }
  });

  it("sits where the ratio crosses 1.5", () => {
    // a grey just under and just over the threshold
    const grey = (v: number) => toHex([v, v, v]);
    const under = [...Array(120).keys()].map((v) => grey(v)).filter((g) => contrast(g, pageGround) < EDGE_BELOW_CONTRAST);
    const over = [...Array(120).keys()].map((v) => grey(v)).filter((g) => contrast(g, pageGround) >= EDGE_BELOW_CONTRAST);
    expect(under.length).toBeGreaterThan(10);
    expect(over.length).toBeGreaterThan(10);
    for (const g of under) expect(needsEdge(g)).toBe(true);
    for (const g of over) expect(needsEdge(g)).toBe(false);
  });
});
