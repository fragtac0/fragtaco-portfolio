// The map ships its pictures and nothing else (spec 9.7: the round 6 tile pyramid, its manifest and the mosaic are gone): the toned
// picture of the overview (and a smaller one for a phone, Ruling R105) and the heights of My climb. A tile folder or a mosaic coming
// back would be megabytes on a first load.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.join(process.cwd(), "public", "mars");

describe("public/mars", () => {
  it("holds relief.webp, relief-phone.webp and heights.png and nothing else", () => {
    expect(readdirSync(dir).sort()).toEqual(["heights.png", "relief-phone.webp", "relief.webp"]);
  });

  it("is under 1.2 MB in all, and a phone's picture is well under the other (a first load takes one of the two)", () => {
    const size = (f: string) => statSync(path.join(dir, f)).size;
    const bytes = readdirSync(dir).reduce((sum, f) => sum + size(f), 0);

    expect(bytes).toBeLessThan(1_200_000);
    expect(size("relief.webp")).toBeLessThan(700 * 1024);
    expect(size("relief-phone.webp")).toBeLessThan(0.6 * size("relief.webp"));
  });
});
