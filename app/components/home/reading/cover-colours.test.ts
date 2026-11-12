import { describe, expect, it } from "vitest";
import { pickColours } from "./cover-colours";
import { parseHex } from "./spine-styles";

const fill = (parts: [string, number][]): number[] => {
  const out: number[] = [];
  for (const [hex, n] of parts) {
    const [r, g, b] = parseHex(hex);
    for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  }
  return out;
};
const dist = (a: string, b: string) => {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
};

describe("pickColours", () => {
  it("takes the biggest colour and the biggest clearly different one", () => {
    const c = pickColours(fill([["#a8352a", 500], ["#ece6d6", 300], ["#15130f", 40]]));
    expect(c).not.toBeNull();
    expect(dist(c!.dominant, "#a8352a")).toBeLessThan(12);
    expect(dist(c!.secondary, "#ece6d6")).toBeLessThan(12);
  });

  it("lets a saturated cover beat a larger white margin only when it is not much smaller", () => {
    const art = pickColours(fill([["#1f4b73", 420], ["#ffffff", 500]]));
    expect(dist(art!.dominant, "#1f4b73")).toBeLessThan(12);
    const plain = pickColours(fill([["#1f4b73", 100], ["#ffffff", 900]]));
    expect(dist(plain!.dominant, "#ffffff")).toBeLessThan(12);
  });

  it("merges close shades into one colour", () => {
    const c = pickColours(fill([["#a8352a", 300], ["#aa372c", 300], ["#2c3b43", 100]]));
    expect(dist(c!.dominant, "#a9362b")).toBeLessThan(10);
    expect(dist(c!.secondary, "#2c3b43")).toBeLessThan(12);
  });

  it("makes a secondary from the dominant when the cover has one colour", () => {
    const light = pickColours(fill([["#ece6d6", 400]]));
    expect(light!.secondary).not.toBe(light!.dominant);
    const dark = pickColours(fill([["#151312", 400]]));
    expect(dark!.secondary).not.toBe(dark!.dominant);
  });

  it("skips transparent pixels and returns null for nothing", () => {
    expect(pickColours([])).toBeNull();
    expect(pickColours([255, 0, 0, 0, 255, 0, 0, 10])).toBeNull();
    const c = pickColours([...fill([["#00ff00", 3]]), 255, 0, 0, 0]);
    expect(dist(c!.dominant, "#00ff00")).toBeLessThan(12);
  });
});
