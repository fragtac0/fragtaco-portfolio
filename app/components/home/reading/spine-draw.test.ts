import { describe, expect, it } from "vitest";
import { coverCrop } from "./spine-draw";

describe("coverCrop", () => {
  it("crops the overflow evenly and covers the canvas", () => {
    expect(coverCrop(200, 100, 50, 100)).toEqual({ sx: 75, sy: 0, cw: 50, ch: 100 });
    expect(coverCrop(100, 400, 50, 100)).toEqual({ sx: 0, sy: 100, cw: 100, ch: 200 });
    expect(coverCrop(50, 100, 50, 100)).toEqual({ sx: 0, sy: 0, cw: 50, ch: 100 });
  });
});
