import { describe, expect, it } from "vitest";
import { chipSub } from "./wall-hud";

describe("chipSub", () => {
  it("is just the channel when it has no other video on the wall", () => {
    expect(chipSub("Fragtaco", 0)).toBe("Fragtaco");
  });

  it("appends how many more there are from the channel", () => {
    expect(chipSub("Fragtaco", 1)).toBe("Fragtaco, 1 more from this channel");
    expect(chipSub("Fragtaco", 3)).toBe("Fragtaco, 3 more from this channel");
  });

  it("has no dashes", () => {
    expect(chipSub("A", 2)).not.toMatch(/[–—-]/);
  });
});
