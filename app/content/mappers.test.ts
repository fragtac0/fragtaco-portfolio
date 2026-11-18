import { describe, expect, it } from "vitest";
import { ensureUniqueBy } from "./mappers";

describe("ensureUniqueBy", () => {
  const byId = (item: { id: string }) => item.id;

  it("returns the same items when every key is unique", () => {
    const items = [{ id: "a" }, { id: "b" }];

    expect(ensureUniqueBy(items, byId, "book id")).toBe(items);
  });

  it("throws on a duplicate, naming the label and the value", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "a" }];

    expect(() => ensureUniqueBy(items, byId, "book id")).toThrow("Duplicate book id: a");
  });

  it("accepts an empty list", () => {
    expect(ensureUniqueBy([], byId, "book id")).toEqual([]);
  });
});
