import { beforeEach, describe, expect, it, vi } from "vitest";

// a fresh copy of the module, so its one entry starts empty
const freshModule = async () => {
  vi.resetModules();
  return import("./painting-memory");
};
const fakeImg = () => ({ naturalWidth: 1600 }) as unknown as HTMLImageElement;

describe("painting memory", () => {
  beforeEach(() => vi.resetModules());

  it("is empty before anything is remembered", async () => {
    const { recallPainting } = await freshModule();
    expect(recallPainting()).toBeNull();
  });

  it("returns the same image object it was given", async () => {
    const { rememberPainting, recallPainting } = await freshModule();
    const img = fakeImg();
    rememberPainting("a", img);
    const got = recallPainting();
    expect(got?.id).toBe("a");
    expect(got?.img).toBe(img);
  });

  it("holds one entry: the newest replaces the last", async () => {
    const { rememberPainting, recallPainting } = await freshModule();
    const b = fakeImg();
    rememberPainting("a", fakeImg());
    rememberPainting("b", b);
    expect(recallPainting()).toEqual({ id: "b", img: b });
  });

  it("is not tied to a component: recalling does not empty it", async () => {
    const { rememberPainting, recallPainting } = await freshModule();
    rememberPainting("a", fakeImg());
    recallPainting();
    expect(recallPainting()?.id).toBe("a");
  });
});
