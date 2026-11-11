import { describe, expect, it } from "vitest";
import { isHashOnlyMove } from "./revalidate";

const u = (pathname: string, search = "") => ({ pathname, search });

describe("isHashOnlyMove", () => {
  it("is true when only the hash changes (same path and search)", () => {
    expect(isHashOnlyMove(u("/"), u("/"))).toBe(true);
    expect(isHashOnlyMove(u("/", "?a=1"), u("/", "?a=1"))).toBe(true);
  });
  it("is also true for an identical URL (the content is static: nothing to re-read)", () => {
    expect(isHashOnlyMove(u("/work", "?a=1"), u("/work", "?a=1"))).toBe(true);
  });
  it("is false when the path or the search changes", () => {
    expect(isHashOnlyMove(u("/"), u("/work"))).toBe(false);
    expect(isHashOnlyMove(u("/", "?a=1"), u("/", "?a=2"))).toBe(false);
    expect(isHashOnlyMove(u("/"), u("/", "?a=1"))).toBe(false);
  });
});
