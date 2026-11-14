import { describe, expect, it } from "vitest";
import { createFrameBox } from "../layer/frame-box";
import type { Frame } from "../layer/frame-math";
import { fitBuffer } from "./wall-canvas";
import type { WallGl } from "./wall-gl";

function setup(frame: Frame | null) {
  const canvas = { width: 300, height: 150, style: new Proxy({ removeProperty: () => undefined, setProperty: () => undefined }, { set: () => true }) } as unknown as HTMLCanvasElement;
  const box = createFrameBox(canvas);
  box.request(frame);
  box.commit();
  const pictures: unknown[] = [];
  const wgl = { setPicture: (p: unknown) => pictures.push(p) } as unknown as WallGl;
  return { canvas, box, wgl, pictures };
}

// the pixel ratio comes from the window, which the node tests do not have
(globalThis as { window?: unknown }).window = { devicePixelRatio: 2 };

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
