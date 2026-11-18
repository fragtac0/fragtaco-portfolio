import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const tab = read("./card-tab.css");
const cards = read("./cards.css");
const tokens = read("../../../styles/tokens.css");

describe("the tabs' CSS (R50.3b)", () => {
  it("hides the nudge strip while a finger drags the card, so no band pops on a drag open", () => {
    const rule = /\.home-hero \.card\.open \.rail::before,\s*\.home-hero \.card\[data-dragging\] \.rail::before \{([^}]*)\}/.exec(tab)?.[1] ?? "";
    expect(rule).toMatch(/opacity:\s*0;/);
    expect(rule).toMatch(/transition:\s*none;/);
  });

  it("takes the edge line from a token, the same colour on both sides", () => {
    expect(/--tab-edge:\s*rgba\(255, 255, 255, 0\.18\);/.test(tokens)).toBe(true);
    expect(tab.match(/var\(--tab-edge\)/g)).toHaveLength(2);
    expect(tab + cards).not.toMatch(/rgba\(255, 255, 255, 0\.18\)/);
  });

  it("under reduced motion: the strip has no delay, and a closing card fades out and back in", () => {
    const rm = tab.slice(tab.indexOf("prefers-reduced-motion"));
    expect(rm).toMatch(/\.rail::before \{\s*transition-delay:\s*0s;/);
    const close = /\.card\[data-slide\]:not\(\.open\) \{([^}]*)\}/.exec(cards)?.[1] ?? "";
    expect(close).toMatch(/animation:\s*home-fade-out 0\.6s/);
    expect(close).toMatch(/transition-delay:\s*0\.3s/); // holds its open pose for the fade out
    expect(tokens).toMatch(/@keyframes home-fade-out \{\s*50% \{\s*opacity: 0;/);
  });
});
