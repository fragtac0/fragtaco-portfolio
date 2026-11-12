import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENT, CREAM, GROUND, GROUND_EMBER, GROUND_POOL, SURFACE_1, glslVec3, rgba } from "./tokens";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const token = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, "i").exec(css)?.[1];

describe("tokens.ts", () => {
  it("repeats the grounds of tokens.css exactly", () => {
    expect(token("--ground")).toBe(GROUND);
    expect(token("--surface-1")).toBe(SURFACE_1);
    expect(token("--accent")).toBe(ACCENT);
    expect(token("--cream")).toBe(CREAM);
    expect(token("--ground-pool")).toBe(GROUND_POOL);
    expect(token("--ground-ember")).toBe(GROUND_EMBER);
  });

  it("writes a hex colour as a canvas colour with an opacity", () => {
    expect(rgba(GROUND, 0.9)).toBe("rgba(14, 14, 13, 0.9)");
  });

  it("writes a hex colour as a GLSL vec3 without a leading zero", () => {
    expect(glslVec3("#0e0e0d")).toBe("vec3(.055,.055,.051)");
    expect(glslVec3("#ffffff")).toBe("vec3(1.000,1.000,1.000)");
  });
});
