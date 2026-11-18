import { describe, expect, it } from "vitest";
import { REDUCED_REVEAL_MS, revealDuration, runProgress } from "./paint-progress";

describe("runProgress", () => {
  it("runs from 0 to 1 over its length and holds at the ends", () => {
    expect(runProgress(1000, 1000, 500)).toBe(0);
    expect(runProgress(1250, 1000, 500)).toBe(0.5);
    expect(runProgress(1500, 1000, 500)).toBe(1);
    expect(runProgress(9000, 1000, 500)).toBe(1);
  });
  it("is over at once for a run of no length, whatever the clocks say (never the bare first frame)", () => {
    expect(runProgress(1000, 1000, 0)).toBe(1);
    expect(runProgress(990, 1000, 0)).toBe(1); // the frame time is earlier than the time the run was started
    expect(runProgress(1010, 1000, 0)).toBe(1);
    expect(runProgress(1000, 1000, Number.NaN)).toBe(1);
  });
  it("is 0 for a run that has not started yet", () => {
    expect(runProgress(990, 1000, 500)).toBe(0);
  });
});

describe("revealDuration", () => {
  it("keeps a reveal of 0 ms at once, under reduced motion too", () => {
    expect(revealDuration(0, false)).toBe(0);
    expect(revealDuration(0, true)).toBe(0);
  });
  it("turns an animated reveal into the 400 ms fade under reduced motion only", () => {
    expect(revealDuration(1500, false)).toBe(1500);
    expect(revealDuration(1500, true)).toBe(REDUCED_REVEAL_MS);
  });
});
