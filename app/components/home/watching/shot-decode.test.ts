import { afterEach, describe, expect, it, vi } from "vitest";
import { whenDecoded } from "./shot-decode";

afterEach(() => vi.useRealTimers());

describe("whenDecoded", () => {
  it("resolves true as soon as the picture has decoded", async () => {
    await expect(whenDecoded({ decode: () => Promise.resolve() }, 150)).resolves.toBe(true);
  });

  it("resolves false when decoding fails (the picture is broken)", async () => {
    await expect(whenDecoded({ decode: () => Promise.reject(new Error("x")) }, 150)).resolves.toBe(
      false,
    );
  });

  it("resolves false after the wait when decoding is slow", async () => {
    vi.useFakeTimers();
    const slow = new Promise<void>(() => {});
    const done = vi.fn();
    void whenDecoded({ decode: () => slow }, 150).then(done);
    await vi.advanceTimersByTimeAsync(149);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toHaveBeenCalledWith(false);
  });

  it("does not wait out the clock once decoded", async () => {
    vi.useFakeTimers();
    const r = await whenDecoded({ decode: () => Promise.resolve() }, 150);
    expect(r).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
