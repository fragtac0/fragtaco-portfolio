import { describe, expect, it } from "vitest";
import { thawWaits } from "./wall-choice";

describe("thawWaits (when the close lets go of the choice only once the camera has arrived)", () => {
  const base = { running: true, chosen: true, settled: false };

  it("waits while the loop runs, a video is chosen and the camera has distance to go", () => {
    expect(thawWaits(base)).toBe(true);
    expect(thawWaits({ ...base, instant: false })).toBe(true);
  });

  it("lets go at once for an instant close, whatever the camera is doing (a resize)", () => {
    expect(thawWaits({ ...base, instant: true })).toBe(false);
  });

  it("lets go at once when the camera has arrived, nothing is chosen or the loop is not running", () => {
    expect(thawWaits({ ...base, settled: true })).toBe(false);
    expect(thawWaits({ ...base, chosen: false })).toBe(false);
    expect(thawWaits({ ...base, running: false })).toBe(false);
  });
});
