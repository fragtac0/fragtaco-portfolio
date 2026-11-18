import { afterEach, describe, expect, it, vi } from "vitest";

type FakeGl = { getExtension: (name: string) => { loseContext: () => void } | null };

function stubBrowser(opts: { webgl2: boolean; webgl: boolean; search?: string }) {
  const lose = vi.fn();
  const gl: FakeGl = { getExtension: () => ({ loseContext: lose }) };
  const createElement = vi.fn(() => ({
    getContext: (type: string) =>
      (type === "webgl2" && opts.webgl2) || (type === "webgl" && opts.webgl) ? gl : null,
  }));
  vi.stubGlobal("window", { location: { search: opts.search ?? "" } });
  vi.stubGlobal("document", { createElement });
  return { createElement, lose };
}

async function load() {
  vi.resetModules();
  return import("./webgl-support");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webgl-support", () => {
  it("imports and answers false on the server without touching window", async () => {
    expect(typeof window).toBe("undefined");
    const m = await load();
    expect(m.hasWebGL()).toBe(false);
    expect(m.hasWebGL2()).toBe(false);
  });

  it("caches the first answer and probes once", async () => {
    const { createElement, lose } = stubBrowser({ webgl2: true, webgl: true });
    const m = await load();
    expect(m.hasWebGL2()).toBe(true);
    expect(m.hasWebGL2()).toBe(true);
    expect(m.hasWebGL()).toBe(true);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(lose).toHaveBeenCalledTimes(1);
  });

  it("reports WebGL1 only when WebGL2 is missing", async () => {
    stubBrowser({ webgl2: false, webgl: true });
    const m = await load();
    expect(m.hasWebGL()).toBe(true);
    expect(m.hasWebGL2()).toBe(false);
  });

  it("reports neither without any context", async () => {
    stubBrowser({ webgl2: false, webgl: false });
    const m = await load();
    expect(m.hasWebGL()).toBe(false);
    expect(m.hasWebGL2()).toBe(false);
  });

  it("?nogl=1 forces both to false without probing", async () => {
    const { createElement } = stubBrowser({ webgl2: true, webgl: true, search: "?a=b&nogl=1" });
    const m = await load();
    expect(m.hasWebGL()).toBe(false);
    expect(m.hasWebGL2()).toBe(false);
    expect(createElement).not.toHaveBeenCalled();
  });
});
