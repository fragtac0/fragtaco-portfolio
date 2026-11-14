import { describe, expect, it } from "vitest";
import { createBackTracker } from "./back-tracker";

describe("the back tracker", () => {
  it("lets a turn push its entry at once when no Back is on its way", () => {
    const t = createBackTracker();
    expect(t.turned("reading")).toBe(false);
    expect(t.popped()).toBeNull();
  });

  it("holds the entry of a turn made before the pop arrived, and gives it once when the pop comes", () => {
    const t = createBackTracker();
    t.backCalled();
    expect(t.pending()).toBe(true);
    expect(t.turned("watching")).toBe(true);
    expect(t.popped()).toBe("watching");
    expect(t.pending()).toBe(false);
    expect(t.popped()).toBeNull();
  });

  it("drops the held entry when the layer is closed again before the pop arrives (no stray entry)", () => {
    const t = createBackTracker();
    t.backCalled();
    t.turned("reading");
    t.closed();
    expect(t.popped()).toBeNull();
  });

  it("a pop with nothing held gives nothing and clears the pending Back", () => {
    const t = createBackTracker();
    t.backCalled();
    expect(t.popped()).toBeNull();
    expect(t.pending()).toBe(false);
  });

  it("a second turn replaces the first while the pop is still to come", () => {
    const t = createBackTracker();
    t.backCalled();
    t.turned("reading");
    t.turned("reading");
    expect(t.popped()).toBe("reading");
  });
});
