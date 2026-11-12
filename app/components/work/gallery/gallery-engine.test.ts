import { describe, expect, it, vi } from "vitest";
import { createGallery } from "./gallery-engine";

/** A canvas that has no WebGL: getContext answers null for everything. */
function noGlCanvas(): HTMLCanvasElement {
  const target = new EventTarget();
  return Object.assign(target, {
    getContext: () => null,
    clientWidth: 800,
    clientHeight: 600,
    width: 800,
    height: 600,
    style: {},
  }) as unknown as HTMLCanvasElement;
}

describe("createGallery without WebGL", () => {
  it("resolves to null instead of throwing, so the page keeps its plain grid", async () => {
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await createGallery(noGlCanvas(), {
      items: [{ src: "data:," }, { src: "data:," }],
      aspect: 16 / 9,
      reduced: false,
      onHover: () => {},
    });
    error.mockRestore();
    expect(out).toBeNull();
  });
});
