import { describe, expect, it } from "vitest";
import { links } from "./root";

const all = () => (links as unknown as () => Array<Record<string, unknown>>)();

describe("the root route's links", () => {
  it("holds no preconnect and no stylesheet from another origin", () => {
    for (const l of all()) {
      expect(l.rel).not.toBe("preconnect");
      // (a stylesheet imported with ?url is an empty string under vitest)
      if (l.rel === "stylesheet") expect(String(l.href)).toMatch(/^(\/(?!\/)|$)/);
    }
  });

  it("links the interface fonts' stylesheet from this site, and preloads (if any) at most two woff2 files, with crossorigin", () => {
    const preloads = all().filter((l) => l.rel === "preload");
    expect(preloads.length).toBeLessThanOrEqual(2);
    for (const l of preloads) {
      expect(l).toMatchObject({ as: "font", type: "font/woff2", crossOrigin: "anonymous" });
      expect(String(l.href)).toMatch(/^\/.*\.woff2/);
    }
    expect(all().filter((l) => l.rel === "stylesheet").length).toBeGreaterThanOrEqual(5); // the interface fonts' sheet, tailwind, tokens, page transition, glass
  });

  it("names no Google font origin anywhere", () => {
    expect(JSON.stringify(all())).not.toMatch(/googleapis|gstatic/);
  });
});
