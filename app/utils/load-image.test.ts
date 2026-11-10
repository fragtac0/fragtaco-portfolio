import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadImage } from "./load-image";

// a fresh copy of the module, so its cached answer starts empty
const freshModule = async () => {
  vi.resetModules();
  return import("./load-image");
};

class FakeImage {
  static last: FakeImage | null = null;
  decoding = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  width = 0;
  height = 0;
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

describe("supportsWebp", () => {
  const canvasReturning = (dataUrl: string | Error) => {
    const toDataURL = vi.fn(() => {
      if (dataUrl instanceof Error) throw dataUrl;
      return dataUrl;
    });
    const createElement = vi.fn(() => ({ width: 0, height: 0, toDataURL }));
    vi.stubGlobal("document", { createElement });
    return { toDataURL, createElement };
  };

  it("is false on the server and does not cache that", async () => {
    const { supportsWebp } = await freshModule();
    expect(supportsWebp()).toBe(false);
    canvasReturning("data:image/webp;base64,AAAA");
    expect(supportsWebp()).toBe(true);
  });

  it("is true when the canvas can encode WebP", async () => {
    const { toDataURL } = canvasReturning("data:image/webp;base64,AAAA");
    const { supportsWebp } = await freshModule();
    expect(supportsWebp()).toBe(true);
    expect(toDataURL).toHaveBeenCalledWith("image/webp");
  });

  it("asks only once", async () => {
    const { createElement } = canvasReturning("data:image/webp;base64,AAAA");
    const { supportsWebp } = await freshModule();
    supportsWebp();
    supportsWebp();
    supportsWebp();
    expect(createElement).toHaveBeenCalledTimes(1);
  });

  it("is false while the decode probe runs, then true once it shows an image", async () => {
    canvasReturning("data:image/png;base64,AAAA");
    const { supportsWebp } = await freshModule();
    expect(supportsWebp()).toBe(false);
    const probe = FakeImage.last!;
    expect(probe.src.startsWith("data:image/webp;base64,")).toBe(true);
    probe.width = 1;
    probe.height = 1;
    probe.onload?.();
    expect(supportsWebp()).toBe(true);
  });

  it("stays false when the probe fails, and does not probe twice", async () => {
    canvasReturning(new Error("blocked"));
    const { supportsWebp } = await freshModule();
    expect(supportsWebp()).toBe(false);
    const probe = FakeImage.last!;
    probe.onerror?.();
    FakeImage.last = null;
    expect(supportsWebp()).toBe(false);
    expect(FakeImage.last).toBeNull();
  });
});

describe("whenWebpKnown", () => {
  const canvasReturning = (dataUrl: string) => {
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ width: 0, height: 0, toDataURL: () => dataUrl })),
    });
  };

  it("resolves false on the server", async () => {
    const { whenWebpKnown } = await freshModule();
    await expect(whenWebpKnown()).resolves.toBe(false);
  });

  it("resolves true at once where the canvas can encode WebP", async () => {
    canvasReturning("data:image/webp;base64,AAAA");
    const { whenWebpKnown } = await freshModule();
    await expect(whenWebpKnown()).resolves.toBe(true);
  });

  it("waits for the decode probe where the canvas cannot (Safari)", async () => {
    canvasReturning("data:image/png;base64,AAAA");
    const { whenWebpKnown } = await freshModule();
    let answer: boolean | null = null;
    void whenWebpKnown().then((v) => (answer = v));
    await Promise.resolve();
    expect(answer).toBeNull();
    const probe = FakeImage.last!;
    probe.width = 1;
    probe.height = 1;
    probe.onload?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(answer).toBe(true);
  });

  it("gives up waiting for a probe that never answers, and says false", async () => {
    canvasReturning("data:image/png;base64,AAAA");
    const { whenWebpKnown } = await freshModule();
    let answer: boolean | null = null;
    void whenWebpKnown().then((v) => (answer = v));
    await vi.advanceTimersByTimeAsync(499);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toBe(false);
  });
});
