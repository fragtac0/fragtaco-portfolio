import { describe, expect, it } from "vitest";
import { headClearPx } from "./use-head-clear";

describe("headClearPx", () => {
  it("is the header's bottom from the layer's top, rounded up", () => {
    expect(headClearPx(133, 0)).toBe(133);
    expect(headClearPx(132.2, 0)).toBe(133);
    expect(headClearPx(150.5, 20)).toBe(131);
  });
  it("is never negative (a header above the layer)", () => {
    expect(headClearPx(10, 40)).toBe(0);
  });
});
