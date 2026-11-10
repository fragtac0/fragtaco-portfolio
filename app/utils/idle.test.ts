import { afterEach, describe, expect, it, vi } from "vitest";
import { idleSlice, whenIdle } from "./idle";

afterEach(() => vi.unstubAllGlobals());

describe("whenIdle", () => {
  it("uses requestIdleCallback with the given timeout and returns its cancel", () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal("window", { requestIdleCallback: request, cancelIdleCallback: cancel });
    const cb = () => {};
    const stop = whenIdle(cb, 1200);
    expect(request).toHaveBeenCalledWith(cb, { timeout: 1200 });
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("passes no options when there is no timeout", () => {
    const request = vi.fn(() => 1);
    vi.stubGlobal("window", { requestIdleCallback: request, cancelIdleCallback: () => {} });
    const cb = () => {};
    idleSlice(cb);
    expect(request).toHaveBeenCalledWith(cb);
  });

  it("falls back to a 120 ms timer without requestIdleCallback", () => {
    const set = vi.fn(() => 3);
    const clear = vi.fn();
    vi.stubGlobal("window", { setTimeout: set, clearTimeout: clear });
    const cb = () => {};
    const stop = whenIdle(cb, 1200);
    expect(set).toHaveBeenCalledWith(cb, 120);
    stop();
    expect(clear).toHaveBeenCalledWith(3);
  });
});
