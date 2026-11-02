import { describe, expect, it } from "vitest";
import { creditLinkLabel, creditLinkValue } from "./credit-link";

describe("creditLinkLabel", () => {
  it("names each link type", () => {
    expect(creditLinkLabel("website")).toBe("Website");
    expect(creditLinkLabel("github")).toBe("GitHub");
    expect(creditLinkLabel("x")).toBe("X");
  });
});

describe("creditLinkValue", () => {
  it("is the host for a website", () => {
    expect(creditLinkValue({ type: "website", url: "https://ohsh.in/" })).toBe("ohsh.in");
    expect(creditLinkValue({ type: "website", url: "https://www.example.com/a" })).toBe("example.com");
  });
  it("is the last path segment for GitHub and X", () => {
    expect(creditLinkValue({ type: "github", url: "https://github.com/ohshinbhat" })).toBe("ohshinbhat");
    expect(creditLinkValue({ type: "x", url: "https://x.com/ohshinbhat/" })).toBe("ohshinbhat");
  });
  it("falls back to the host with no path, and to the raw text for a bad URL", () => {
    expect(creditLinkValue({ type: "x", url: "https://x.com" })).toBe("x.com");
    expect(creditLinkValue({ type: "x", url: "nope" })).toBe("nope");
  });
});
