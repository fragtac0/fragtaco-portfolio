import { describe, expect, it } from "vitest";
import { beginReveal, endReveal, getReveal, skipReveal, startReveal, subscribeReveal } from "./change-state";

describe("the reveal's state (what a page that times its own arrival reads)", () => {
  it("goes hold, run, over for a change that runs its length, and says it was not cut short", () => {
    beginReveal(2250);
    expect(getReveal()).toEqual({ phase: "hold", at: null, ms: 2250, skipped: false });
    startReveal(1000);
    expect(getReveal()).toEqual({ phase: "run", at: 1000, ms: 2250, skipped: false });
    endReveal(1000 + 2250);
    expect(getReveal()).toEqual({ phase: "over", at: 1000, ms: 2250, skipped: false });
  });

  it("calls a change that ends well before its length cut short, and one that never started the reveal too", () => {
    beginReveal(2250);
    startReveal(1000);
    endReveal(1000 + 1500);
    expect(getReveal().skipped).toBe(true);
    beginReveal(2250);
    endReveal(5000);
    expect(getReveal()).toMatchObject({ phase: "over", at: null, skipped: true });
  });

  it("marks a press, Back or a cut that comes first, before or during the reveal", () => {
    beginReveal(2250);
    skipReveal();
    expect(getReveal().skipped).toBe(true);
    beginReveal(2250);
    startReveal(10);
    skipReveal();
    endReveal(10 + 2250);
    expect(getReveal().skipped).toBe(true);
  });

  it("starts the reveal only from the hold, and a second begin starts over", () => {
    beginReveal(120);
    startReveal(5);
    startReveal(99);
    expect(getReveal().at).toBe(5);
    beginReveal(2250);
    expect(getReveal()).toEqual({ phase: "hold", at: null, ms: 2250, skipped: false });
  });

  it("tells its listeners about each phase, and stops when they leave", () => {
    const seen: string[] = [];
    const off = subscribeReveal(() => seen.push(getReveal().phase));

    beginReveal(2250);
    startReveal(1);
    endReveal(2251);
    off();
    beginReveal(2250);
    expect(seen).toEqual(["hold", "run", "over"]);
  });
});
