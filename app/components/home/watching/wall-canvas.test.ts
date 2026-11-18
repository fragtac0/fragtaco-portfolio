import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createFrameBox } from "../layer/frame-box";
import type { Frame } from "../layer/frame-math";
import { bufferDpr, fitBuffer, placeAt } from "./wall-canvas";
import type { WallGl } from "./wall-gl";
import { createWallState } from "./wall-types";

function setup(frame: Frame | null) {
  const canvas = { width: 300, height: 150, style: new Proxy(
      { removeProperty: () => undefined, setProperty: () => undefined, getPropertyValue: () => "", getPropertyPriority: () => "" },
      { set: () => true },
    ) } as unknown as HTMLCanvasElement;
  const box = createFrameBox(canvas);
  box.request(frame);
  box.commit();
  const pictures: unknown[] = [];
  const wgl = { setPicture: (p: unknown) => pictures.push(p) } as unknown as WallGl;
  return { canvas, box, wgl, pictures };
}

// the pixel ratio comes from the window, which the node tests do not have
beforeAll(() => vi.stubGlobal("window", { devicePixelRatio: 2 }));
afterAll(() => vi.unstubAllGlobals());

describe("the wall's drawing buffer", () => {
  it("is the window at the pixel ratio with no frame, and the second pass shows the whole buffer", () => {
    const { canvas, box, wgl, pictures } = setup(null);
    fitBuffer(canvas, box, wgl, 1440, 900);
    expect([canvas.width, canvas.height]).toEqual([2880, 1800]);
    expect(pictures).toEqual([null]);
  });

  it("a frame that covers the window gives exactly the buffer and the picture of no frame", () => {
    const a = setup(null);
    const b = setup({ left: 0, top: 0, width: 1440, height: 900 });
    fitBuffer(a.canvas, a.box, a.wgl, 1440, 900);
    fitBuffer(b.canvas, b.box, b.wgl, 1440, 900);
    expect([b.canvas.width, b.canvas.height]).toEqual([a.canvas.width, a.canvas.height]);
    expect(b.pictures).toEqual(a.pictures);
  });

  it("a box is drawn at its own size, and a wide one tells the second pass where the cropped picture goes", () => {
    const { canvas, box, wgl, pictures } = setup({ left: 10, top: 10, width: 720, height: 200 });
    fitBuffer(canvas, box, wgl, 1440, 900);
    expect([canvas.width, canvas.height]).toEqual([1440, 400]);
    expect(pictures[0]).toMatchObject({ x: 0, y: -250, w: 1440, h: 900, bufW: 1440, bufH: 400 });
  });

  it("leaves the buffer alone when its size has not changed (a new size clears the canvas)", () => {
    const { canvas, box, wgl } = setup(null);
    fitBuffer(canvas, box, wgl, 150, 75);
    expect([canvas.width, canvas.height]).toEqual([300, 150]);
    let writes = 0;
    Object.defineProperty(canvas, "width", { get: () => 300, set: () => writes++ });
    fitBuffer(canvas, box, wgl, 150, 75);
    expect(writes).toBe(0);
  });
});

describe("the docked pixel-ratio cap", () => {
  it("is the screen's ratio up to 2 with no cap, and lowers the buffer when asked", () => {
    expect(bufferDpr()).toBe(2);
    expect(bufferDpr(1)).toBe(1);
    expect(bufferDpr(3)).toBe(2);
    const { canvas, box, wgl } = setup({ left: 0, top: 0, width: 720, height: 200 });
    fitBuffer(canvas, box, wgl, 1440, 900, 1);
    expect([canvas.width, canvas.height]).toEqual([720, 200]);
    fitBuffer(canvas, box, wgl, 1440, 900);
    expect([canvas.width, canvas.height]).toEqual([1440, 400]);
  });
});

describe("a frame that only moved", () => {
  it("is where the pointer maps from, and a missing frame leaves it", () => {
    const st = createWallState();
    placeAt(st, { left: 30, top: 40, width: 1, height: 1 });
    expect([st.ox, st.oy]).toEqual([30, 40]);
    placeAt(st, null);
    expect([st.ox, st.oy]).toEqual([30, 40]);
  });
});
