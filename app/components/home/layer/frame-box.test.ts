import { describe, expect, it, vi } from "vitest";
import { createFrameBox } from "./frame-box";
import type { Frame } from "./frame-math";

/** A canvas with a style that remembers what was set (the box only writes style). */
function fakeCanvas() {
  const props = new Map<string, string>();
  const own: Record<string, unknown> = {
    removeProperty: (p: string) => void props.delete(p),
    setProperty: (p: string, v: string) => void props.set(p, v),
  };
  const style = new Proxy(own, {
    get: (t, k: string) => (k in t ? t[k] : props.get(k)),
    set: (_t, k: string, v: string) => (props.set(k, v), true),
  });
  return { canvas: { style } as unknown as HTMLCanvasElement, props };
}

const A: Frame = { left: 10, top: 20, width: 480, height: 300 };

describe("the frame box", () => {
  it("changes nothing until a request is committed, and then places the canvas fixed at the frame", () => {
    const { canvas, props } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    expect(box.hasPending()).toBe(true);
    expect(box.frame()).toBeNull();
    expect(props.size).toBe(0);
    expect(box.commit()).toBe("resized");
    expect(box.hasPending()).toBe(false);
    expect(box.frame()).toEqual(A);
    expect(props.get("position")).toBe("fixed");
    expect([props.get("left"), props.get("top"), props.get("width"), props.get("height")]).toEqual(["10px", "20px", "480px", "300px"]);
  });

  it("a move alone writes the style but asks for no new picture; a new size does", () => {
    const { canvas, props } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    box.commit();
    box.drawn();
    box.request({ ...A, left: 50, top: 60 });
    expect(box.commit()).toBe("moved");
    expect(props.get("left")).toBe("50px");
    box.request({ ...A, width: 500 });
    expect(box.commit()).toBe("resized");
  });

  it("the same frame again is nothing", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    box.commit();
    box.request({ ...A });
    expect(box.commit()).toBe("none");
  });

  it("null puts the canvas's own style back", () => {
    const { canvas, props } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    box.commit();
    box.request(null);
    expect(box.commit()).toBe("resized");
    expect(box.frame()).toBeNull();
    expect(props.size).toBe(0);
  });

  it("keeps the inline transition off for one more frame after the frame is taken back, so the size does not lag", () => {
    const { canvas, props } = fakeCanvas();
    const queue: Array<() => void> = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => queue.push(cb));
    try {
      const box = createFrameBox(canvas);
      box.request(A);
      box.commit();
      box.request(null);
      box.commit();
      expect([...props.keys()]).toEqual(["transition"]);
      queue.shift()?.();
      expect(props.size).toBe(0);
      // a frame asked for in between keeps it
      box.request(A);
      box.commit();
      box.request(null);
      box.commit();
      box.request(A);
      box.commit();
      queue.shift()?.();
      expect(props.get("transition")).toBe("none");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("whenDrawn waits for the first draw with the frame in force, and is ready again after it", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    let done = false;
    void box.whenDrawn().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    box.drawn();
    await Promise.resolve();
    expect(done).toBe(true);
    await expect(box.whenDrawn()).resolves.toBeUndefined();
  });

  it("a new size makes whenDrawn wait again; a move does not", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.drawn();
    box.request({ ...A });
    box.commit();
    let done = false;
    void box.whenDrawn().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    box.drawn();
    await Promise.resolve();
    expect(done).toBe(true);
    box.request({ ...A, left: 99 });
    box.commit();
    await expect(box.whenDrawn()).resolves.toBeUndefined();
  });

  it("a frame of another size that is asked for but not applied yet makes whenDrawn wait for the frame that applies it", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.drawn();
    box.request(A);
    let done = false;
    void box.whenDrawn().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    box.commit();
    box.drawn();
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it("asking for the size already in force does not make whenDrawn wait", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    box.commit();
    box.drawn();
    box.request({ ...A, left: 1 });
    await expect(box.whenDrawn()).resolves.toBeUndefined();
  });

  it("invalidate makes the next draw the one whenDrawn waits for", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.drawn();
    box.invalidate();
    let done = false;
    void box.whenDrawn().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    box.drawn();
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it("release lets a waiter go and clears the style", async () => {
    const { canvas, props } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    box.commit();
    box.invalidate();
    let done = false;
    void box.whenDrawn().then(() => (done = true));
    box.release();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(props.size).toBe(0);
  });
});
