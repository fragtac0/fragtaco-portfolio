// The map ships two pictures and nothing else (spec 9.7: the round 6 tile pyramid, its manifest and the mosaic are gone): the toned
// picture of the overview and the heights of My climb. A tile folder or a mosaic coming back would be megabytes on a first load.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.join(process.cwd(), "public", "mars");

describe("public/mars", () => {
  it("holds relief.webp and heights.png and nothing else", () => {
    expect(readdirSync(dir).sort()).toEqual(["heights.png", "relief.webp"]);
  });

  it("is under 1 MB in all", () => {
    const bytes = readdirSync(dir).reduce((sum, f) => sum + statSync(path.join(dir, f)).size, 0);

    expect(bytes).toBeLessThan(1_000_000);
  });
});
