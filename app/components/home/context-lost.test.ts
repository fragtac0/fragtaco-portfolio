import { describe, expect, it, vi } from "vitest";
import { watchContextLost } from "./context-lost";

const lose = (t: EventTarget) => t.dispatchEvent(new Event("webglcontextlost"));

describe("watchContextLost", () => {
  it("is not lost until the event arrives", () => {
    const t = new EventTarget();
    const w = watchContextLost(t);
    expect(w.lost()).toBe(false);
    lose(t);
    expect(w.lost()).toBe(true);
  });

  it("calls each subscriber once, and not again on a second loss", () => {
    const t = new EventTarget();
    const w = watchContextLost(t);
    const a = vi.fn();
    const b = vi.fn();
    w.subscribe(a);
    w.subscribe(b);
    lose(t);
    lose(t);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("does not call a subscriber that unsubscribed", () => {
    const t = new EventTarget();
    const w = watchContextLost(t);
    const a = vi.fn();
    w.subscribe(a)();
    lose(t);
    expect(a).not.toHaveBeenCalled();
    expect(w.lost()).toBe(true);
  });

  it("ignores other events", () => {
    const t = new EventTarget();
    const w = watchContextLost(t);
    t.dispatchEvent(new Event("webglcontextrestored"));
    expect(w.lost()).toBe(false);
  });
});
