import { describe, expect, it } from "vitest";
import { countLabel } from "./count-label";

describe("countLabel", () => {
  it("uses the singular for exactly one", () => {
    expect(countLabel(1, "book", "books")).toBe("1 book");
    expect(countLabel(1, "video", "videos")).toBe("1 video");
  });
  it("uses the plural for everything else, zero included", () => {
    expect(countLabel(14, "book", "books")).toBe("14 books");
    expect(countLabel(0, "book", "books")).toBe("0 books");
    expect(countLabel(51, "video", "videos")).toBe("51 videos");
  });
  it("groups thousands the same way everywhere", () => {
    expect(countLabel(999, "day", "days")).toBe("999 days");
    expect(countLabel(1065, "day", "days")).toBe("1,065 days");
    expect(countLabel(2172, "day", "days")).toBe("2,172 days");
    expect(countLabel(1000000, "day", "days")).toBe("1,000,000 days");
  });
});
