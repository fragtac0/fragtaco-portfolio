import { describe, expect, it } from "vitest";
import { normalizePageViewSource } from "./page-view-source";

describe("normalizePageViewSource", () => {
  it("keeps the three known sources, in any case and with spaces around them", () => {
    expect(normalizePageViewSource("twitter")).toBe("twitter");
    expect(normalizePageViewSource(" LinkedIn ")).toBe("linkedin");
    expect(normalizePageViewSource("instagram")).toBe("instagram");
  });

  it("cuts anything else to organic, a huge or hostile value included, so no caller can make a key of its own", () => {
    for (const v of ["", "x", "twitter.com", "twitter\nlinkedin", "a".repeat(100000), "__proto__", "../../etc", null, undefined])
      expect(normalizePageViewSource(v)).toBe("organic");
  });
});
