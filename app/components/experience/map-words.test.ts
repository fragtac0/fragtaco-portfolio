// The words on the map (spec 9.6): in order of importance, with their sizes and strengths as tokens, and used from the tokens.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CREAM, channels } from "../../styles/tokens";
import { INK } from "./chart";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../../styles/tokens.css");
const words = read("./experience.css");
const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1].trim();
const rule = (css: string, selector: string) => new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

describe("the tokens of the words", () => {
  it("has the title at 34 to 64 px, its description at 12.5 px, the label at 13 px and its line at 11 px", () => {
    expect(token("--map-title-size")).toBe("clamp(34px, 4.6vw, 64px)");
    expect(token("--map-desc-size")).toBe("12.5px");
    expect(token("--map-label-size")).toBe("13px");
    expect(token("--map-line-size")).toBe("11px");
  });

  it("has the description at 70% cream, the line at 56%, and the label in a warm light orange", () => {
    expect(token("--map-ink-desc")).toBe("rgb(var(--ink-rgb) / 0.7)");
    expect(token("--map-ink-line")).toBe("rgb(var(--ink-rgb) / 0.56)");
    expect(token("--map-ink-label")).toBe("#ffc9a3");
  });
});

describe("the words' sheet", () => {
  it("sets the title in capitals, at the title size, in the cream itself", () => {
    const t = rule(words, ".map-title");

    expect(t).toContain("font-size: var(--map-title-size)");
    expect(t).toContain("text-transform: uppercase");
    expect(t).toContain("color: var(--cream)");
  });

  it("sets the description, the label and the line from the tokens", () => {
    expect(rule(words, ".map-text")).toContain("font-size: var(--map-desc-size)");
    expect(rule(words, ".map-text")).toContain("color: var(--map-ink-desc)");
    expect(rule(words, ".map-caption-title")).toContain("font-size: var(--map-label-size)");
    expect(rule(words, ".map-caption-title")).toContain("color: var(--map-ink-label)");
    expect(words).toMatch(/\.map-caption-line,\s*\.map-caption-fact,\s*\.map-caption-credit \{[^}]*font-size: var\(--map-line-size\)[^}]*color: var\(--map-ink-line\)/);
  });

  it("has no size or strength of its own for them (a number used twice is a token)", () => {
    expect(words).not.toMatch(/font-size:\s*\d/);
    expect(words).not.toMatch(/#ffc9a3/i);
  });
});

describe("the chart's ink", () => {
  it("is the cream (a canvas cannot read a CSS variable, so chart.ts repeats it)", () => {
    expect(INK).toBe(channels(CREAM).join(","));
  });
});
