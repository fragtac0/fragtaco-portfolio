import { describe, expect, it } from "vitest";
import { formatPublished } from "./video-date";

describe("formatPublished", () => {
  it("writes the day as written, whatever the time zone", () => {
    expect(formatPublished("2024-03-12")).toBe("12 Mar 2024");
    expect(formatPublished("2024-03-12T23:59:59Z")).toBe("12 Mar 2024");
    expect(formatPublished("2023-12-01T00:00:00+13:00")).toBe("1 Dec 2023");
  });
  it("leaves it out when there is no real date", () => {
    expect(formatPublished(null)).toBe("");
    expect(formatPublished(undefined)).toBe("");
    expect(formatPublished("")).toBe("");
    expect(formatPublished("last week")).toBe("");
    expect(formatPublished("2024-02-31")).toBe("");
    expect(formatPublished("2024-13-01")).toBe("");
  });
});
