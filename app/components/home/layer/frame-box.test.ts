import { describe, expect, it, vi } from "vitest";
import { createFrameBox } from "./frame-box";
import { fakeCanvas } from "./frame-box-fake";
import type { Frame } from "./frame-math";

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
    expect([props.get("left"), props.get("top"), props.get("width"), props.get("height")]).toEqual([
      "10px",
      "20px",
      "480px",
      "300px",
    ]);
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

  it("only size and place stop transitioning while framed: opacity keeps its transition", () => {
    const { canvas, props, prio } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A);
    box.commit();
    expect(props.get("transition-property")).toBe("opacity");
    expect(prio.get("transition-property")).toBe("important");
    expect(props.has("transition")).toBe(false);
  });

  it("keeps the override one more frame after the frame is taken back, so the size does not lag, and then puts back the inline transition the canvas had", () => {
    const { canvas, props, prio } = fakeCanvas();
    canvas.style.setProperty("transition-property", "opacity, filter");
    const queue: Array<() => void> = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => queue.push(cb));
    try {
      const box = createFrameBox(canvas);
      box.request(A);
      box.commit();
      box.request(null);
      box.commit();
      expect(props.get("transition-property")).toBe("opacity");
      queue.shift()?.();
      expect(props.get("transition-property")).toBe("opacity, filter");
      expect(prio.get("transition-property")).toBe("");
      expect([...props.keys()]).toEqual(["transition-property"]);
      // a frame asked for in between keeps it
      box.request(A);
      box.commit();
      box.request(null);
      box.commit();
      box.request(A);
      box.commit();
      queue.shift()?.();
      expect(props.get("transition-property")).toBe("opacity");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a canvas with no inline transition has none again afterwards", () => {
    const { canvas, props } = fakeCanvas();
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => cb());
    try {
      const box = createFrameBox(canvas);
      box.request(A);
      box.commit();
      box.request(null);
      box.commit();
      expect(props.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("whenDrawn waits for the first draw with the frame in force, and is ready again after it", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
    let got: string | null = null;
    void box.whenDrawn().then((r) => (got = r));
    await Promise.resolve();
    expect(got).toBeNull();
    box.drawn();
    await Promise.resolve();
    expect(got).toBe("drawn");
    await expect(box.whenDrawn()).resolves.toBe("drawn");
  });

  it("a new size makes whenDrawn wait again; a move does not", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
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
    await expect(box.whenDrawn()).resolves.toBe("drawn");
  });

  it("a frame of another size that is asked for but not applied yet makes whenDrawn wait for the frame that applies it", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
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
    box.resume();
    box.request(A);
    box.commit();
    box.drawn();
    box.request({ ...A, left: 1 });
    await expect(box.whenDrawn()).resolves.toBe("drawn");
  });

  it("invalidate makes the next draw the one whenDrawn waits for", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
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

  it("release lets a waiter go with stopped and clears the style", async () => {
    const { canvas, props } = fakeCanvas();
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => cb());
    try {
      const box = createFrameBox(canvas);
      box.resume();
      box.request(A);
      box.commit();
      box.invalidate();
      const waiter = box.whenDrawn();
      box.release();
      await expect(waiter).resolves.toBe("stopped");
      expect(props.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("whenDrawn never hangs", () => {
  it("abandon (the engine stopped, failed or lost its context) lets every waiter go with stopped", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
    const a = box.whenDrawn();
    const b = box.whenDrawn();
    box.abandon();
    await expect(Promise.all([a, b])).resolves.toEqual(["stopped", "stopped"]);
  });

  it("answers drawn when the picture asked for is already on the canvas, even after the engine stopped", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
    box.drawn();
    box.abandon();
    await expect(box.whenDrawn()).resolves.toBe("drawn");
  });

  it("before a start, or after a stop, with a picture waiting to be drawn it answers stopped at once", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    await expect(box.whenDrawn()).resolves.toBe("stopped");
    box.resume();
    const w = box.whenDrawn();
    box.abandon();
    await expect(w).resolves.toBe("stopped");
    await expect(box.whenDrawn()).resolves.toBe("stopped");
    box.request(A);
    box.commit();
    await expect(box.whenDrawn()).resolves.toBe("stopped");
  });

  it("a new run waits for its first frame again, and a frame drawn answers drawn", async () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.resume();
    box.abandon();
    box.resume();
    box.invalidate();
    const w = box.whenDrawn();
    box.drawn();
    await expect(w).resolves.toBe("drawn");
  });
});
