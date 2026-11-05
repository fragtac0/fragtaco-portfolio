import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadImage } from "./load-image";

class FakeImage {
  static last: FakeImage | null = null;
  decoding = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    FakeImage.last = this;
  }
  decode() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("window", {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("loadImage", () => {
  it("resolves the image once it has loaded and decoded", async () => {
    const p = loadImage("/a.jpg");
    const img = FakeImage.last!;
    img.onload?.();
    await expect(p).resolves.toBe(img);
  });

  it("resolves null on an error", async () => {
    const p = loadImage("/a.jpg");
    FakeImage.last!.onerror?.();
    await expect(p).resolves.toBeNull();
  });

  it("resolves null when a stalled request passes the timeout, and cancels it", async () => {
    const p = loadImage("/a.jpg", 5000);
    const img = FakeImage.last!;
    expect(img.src).toBe("/a.jpg");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toBeNull();
    expect(img.src).toBe("");
  });

  it("defaults to a 12 s timeout", async () => {
    let done = false;
    void loadImage("/a.jpg").then(() => (done = true));
    await vi.advanceTimersByTimeAsync(11999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
