import { describe, expect, it } from "vitest";
import { hintText } from "./shelf-hud";

describe("hintText", () => {
  it("tells a narrow screen with a mouse to drag sideways, in two lines or fewer at 320 px", () => {
    expect(hintText(true, true)).toBe("Drag sideways to browse. Click a book to open it.");
    expect(hintText(true, true).length).toBeLessThanOrEqual(52);
  });
  it("keeps the hover hint on a wide screen with a mouse", () => {
    expect(hintText(true, false)).toBe("Hover to pull a book out. Click to open it.");
  });
  it("keeps the touch hint on touch devices, narrow or not", () => {
    const touch = "Tap a book to open it. Drag to look along the shelf.";
    expect(hintText(false, true)).toBe(touch);
    expect(hintText(false, false)).toBe(touch);
  });
  it("has no dashes in any hint", () => {
    for (const fine of [true, false]) {
      for (const narrow of [true, false]) expect(hintText(fine, narrow)).not.toMatch(/[–—]/);
    }
  });
});
