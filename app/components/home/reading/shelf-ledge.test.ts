import * as T from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLedge } from "./shelf-ledge";

/** Path2D and the DOM canvas are not in Node: stand-ins enough for drawLedge, counting the canvases made. */
class FakePath2D {}
let canvases: { width: number; height: number }[] = [];

beforeEach(() => {
  canvases = [];
  vi.stubGlobal("Path2D", FakePath2D);
  vi.stubGlobal("document", {
    createElement: () => {
      const gradient = { addColorStop: () => {} };
      const ctx = {
        setTransform: () => {},
        clearRect: () => {},
        stroke: () => {},
        fillRect: () => {},
        createLinearGradient: () => gradient,
      };
      const c = { width: 0, height: 0, getContext: () => ctx };
      canvases.push(c);
      return c;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ledge() {
  const tracked: { dispose(): void }[] = [];
  const track = <D extends { dispose(): void }>(d: D): D => {
    tracked.push(d);
    return d;
  };
  const l = createLedge(T, -1, new T.PlaneGeometry(1, 1), track);
  return { l, tracked };
}

describe("createLedge().fit", () => {
  it("is hidden until it is fitted, and hidden again for an empty box", () => {
    const { l } = ledge();
    expect(l.mesh.visible).toBe(false);
    l.fit(800, 74, 100, 1);
    expect(l.mesh.visible).toBe(true);
    l.fit(800, 0, 100, 1);
    expect(l.mesh.visible).toBe(false);
  });

  it("keeps one texture and one canvas however many times the window is resized, and tracks it once", () => {
    const { l, tracked } = ledge();
    const material = l.mesh.material;
    l.fit(800, 74, 100, 1);
    const tex = material.map;
    const count = tracked.length; // the material and the one texture
    expect(tex).toBeInstanceOf(T.CanvasTexture);
    for (let i = 1; i <= 40; i++) l.fit(800 + i * 7, 74, 100, 1);
    expect(material.map).toBe(tex);
    expect(tracked).toHaveLength(count);
    expect(canvases).toHaveLength(1);
    // the one canvas follows the newest size
    expect([canvases[0].width, canvases[0].height]).toEqual([800 + 40 * 7, 74]);
  });

  it("does not redraw for the same pixel size, and bumps the texture for a new one", () => {
    const { l } = ledge();
    const tex = () => (l.mesh.material).map as T.CanvasTexture;
    l.fit(800, 74, 100, 1);
    const v = tex().version;
    l.fit(800, 74, 100, 1);
    expect(tex().version).toBe(v);
    l.fit(900, 74, 100, 1);
    expect(tex().version).toBeGreaterThan(v);
  });

  it("frees the texture's storage when the size changes, and caps the picture's width", () => {
    const { l } = ledge();
    l.fit(800, 74, 100, 1);
    const tex = (l.mesh.material).map as T.CanvasTexture;
    const disposed = vi.fn();
    tex.addEventListener("dispose", disposed);
    l.fit(850, 74, 100, 1);
    expect(disposed).toHaveBeenCalledTimes(1);
    l.fit(9000, 74, 100, 2);
    expect(canvases[0].width).toBe(4096);
  });

  it("sizes the plane to the box in world units and hangs it from y 0", () => {
    const { l } = ledge();
    l.fit(900, 74, 100, 1);
    expect(l.mesh.scale.x).toBeCloseTo(9, 9);
    expect(l.mesh.scale.y).toBeCloseTo(0.74, 9);
    expect(l.mesh.position.y).toBeCloseTo(-0.37, 9);
  });
});
