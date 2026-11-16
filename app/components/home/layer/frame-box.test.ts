import { describe, expect, it, vi } from "vitest";
import { createFrameBox } from "./frame-box";
import type { Frame } from "./frame-math";

/** A canvas with a style that remembers what was set, and with what priority (the box only writes style). */
function fakeCanvas() {
  const props = new Map<string, string>();
  const prio = new Map<string, string>();
  const own: Record<string, unknown> = {
    removeProperty: (p: string) => void (props.delete(p), prio.delete(p)),
    setProperty: (p: string, v: string, pr = "") => void (props.set(p, v), prio.set(p, pr)),
    getPropertyValue: (p: string) => props.get(p) ?? "",
    getPropertyPriority: (p: string) => prio.get(p) ?? "",
  };
  const style = new Proxy(own, {
    get: (t, k: string) => (k in t ? t[k] : props.get(k)),
    set: (_t, k: string, v: string) => (props.set(k, v), true),
  });
  return { canvas: { style } as unknown as HTMLCanvasElement, props, prio };
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

describe("a frame the caller places (place: false)", () => {
  it("writes nothing to the canvas's style, and takes only the frame's size", () => {
    const { canvas, props } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A, { place: false });
    expect(box.commit()).toBe("resized");
    expect(box.frame()).toEqual(A);
    expect(box.placed()).toBe(false);
    expect(props.size).toBe(0);
    // the picture is the same as a placed frame of that size
    const placed = createFrameBox(fakeCanvas().canvas);
    placed.request(A);
    placed.commit();
    expect(box.view(1440, 900, 2)).toEqual(placed.view(1440, 900, 2));
  });

  it("a move does nothing; a new size is a resize", () => {
    const { canvas, props } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A, { place: false });
    box.commit();
    box.drawn();
    box.request({ ...A, left: 400, top: 5 }, { place: false });
    expect(box.commit()).toBe("none");
    expect(box.frame()).toEqual({ ...A, left: 400, top: 5 });
    expect(props.size).toBe(0);
    box.request({ ...A, width: 500 }, { place: false });
    expect(box.commit()).toBe("resized");
  });

  it("leaves a style the caller wrote alone (an unplaced frame never clears what it did not write)", () => {
    const { canvas, props } = fakeCanvas();
    canvas.style.setProperty("width", "100%");
    canvas.style.setProperty("position", "absolute");
    const box = createFrameBox(canvas);
    box.request(A, { place: false });
    box.commit();
    box.request(null);
    box.commit();
    expect(props.get("width")).toBe("100%");
    expect(props.get("position")).toBe("absolute");
  });

  it("switching between the two modes at the same size changes the style only: no new picture, no waiting", async () => {
    const { canvas, props } = fakeCanvas();
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => cb());
    try {
      const box = createFrameBox(canvas);
      box.resume();
      box.request(A, { place: false });
      box.commit();
      box.drawn();
      const view = box.view(1440, 900, 2);
      box.request(A);
      expect(box.commit()).toBe("moved");
      expect(props.get("position")).toBe("fixed");
      expect(box.view(1440, 900, 2)).toEqual(view);
      await expect(box.whenDrawn()).resolves.toBe("drawn");
      box.request({ ...A, left: 3 }, { place: false });
      expect(box.commit()).toBe("moved");
      expect(props.size).toBe(0);
      expect(box.view(1440, 900, 2)).toEqual(view);
      await expect(box.whenDrawn()).resolves.toBe("drawn");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("onApplied (the caller's own element follows the frame in the same frame the engine draws)", () => {
  it("is called once, by commit, never by request", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    const seen = vi.fn();
    box.request(A, { place: false, onApplied: seen });
    expect(seen).not.toHaveBeenCalled();
    box.commit();
    expect(seen).toHaveBeenCalledTimes(1);
    box.commit(); // nothing pending now
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("is called after the frame is in force, whether the size changed, the place did or neither", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    const inForce: Array<Frame | null> = [];
    const hook = () => inForce.push(box.frame());
    box.request(A, { place: false, onApplied: hook });
    box.commit(); // a new size
    box.request(A, { place: false, onApplied: hook });
    box.commit(); // the same frame: "none"
    box.request({ ...A, left: 99 }, { place: false, onApplied: hook });
    box.commit(); // a move of an unplaced frame: "none"
    expect(inForce).toEqual([A, A, { ...A, left: 99 }]);
  });

  it("only the last request's hook runs when several were asked before a commit", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    const first = vi.fn();
    const second = vi.fn();
    box.request(A, { place: false, onApplied: first });
    box.request({ ...A, width: 600 }, { place: false, onApplied: second });
    box.commit();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("a request without a hook clears the one before it", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    const first = vi.fn();
    box.request(A, { place: false, onApplied: first });
    box.request(A, { place: false });
    box.commit();
    expect(first).not.toHaveBeenCalled();
  });

  it("release drops a hook that has not run", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    const hook = vi.fn();
    box.request(A, { place: false, onApplied: hook });
    box.release();
    box.commit();
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("a moving frame (coarse)", () => {
  it("is coarse only while a frame asked for as moving is in force", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    expect(box.coarse()).toBe(false);
    box.request(A, { place: false, coarse: true });
    expect(box.coarse()).toBe(false); // nothing changes until commit
    box.commit();
    expect(box.coarse()).toBe(true);
    box.request({ ...A, width: 500 }, { place: false });
    box.commit();
    expect(box.coarse()).toBe(false);
  });

  it("the same size that stops being a moving one counts as resized: the exact buffer is wanted", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A, { place: false, coarse: true });
    box.commit();
    box.drawn();
    box.request(A, { place: false });
    expect(box.commit()).toBe("resized");
    box.request(A, { place: false });
    expect(box.commit()).toBe("none");
  });

  it("no frame is never coarse, and a release puts it back", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(A, { place: false, coarse: true });
    box.commit();
    box.request(null, { coarse: true });
    box.commit();
    expect(box.coarse()).toBe(false);
    box.request(A, { place: false, coarse: true });
    box.commit();
    box.release();
    expect(box.coarse()).toBe(false);
  });
});


describe("a move in progress (the box the frame started from, and how far along)", () => {
  const BOX = { width: 648, height: 300 };
  const at = (w: number): Frame => ({ left: 0, top: 0, width: w, height: w / 2 });

  it("is what the last committed request said, and nothing for a frame at rest", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    expect(box.move()).toBeNull();
    box.request(at(700), { place: false, move: { box: BOX, t: 0.1 } });
    expect(box.move()).toBeNull(); // not until the commit
    box.commit();
    expect(box.move()).toEqual({ box: BOX, t: 0.1 });
    box.request(at(648), { place: false });
    box.commit();
    expect(box.move()).toBeNull();
  });

  it("a new position of the move at the same size is a new picture: resized", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(at(700), { place: false, move: { box: BOX, t: 0.1 } });
    box.commit();
    box.request(at(700), { place: false, move: { box: BOX, t: 0.2 } });
    expect(box.commit()).toBe("resized");
    box.request(at(700), { place: false, move: { box: BOX, t: 0.2 } });
    expect(box.commit()).toBe("none");
    box.request(at(700), { place: false });
    expect(box.commit()).toBe("resized");
  });

  it("a frame at rest that says t = 0 for its own size is no move at all (the end of a closing is not drawn twice)", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(at(648), { place: false, move: { box: { width: 648, height: 324 }, t: 0 } });
    box.commit();
    box.request(at(648), { place: false });
    expect(box.commit()).toBe("none");
  });

  it("a release forgets it", () => {
    const { canvas } = fakeCanvas();
    const box = createFrameBox(canvas);
    box.request(at(700), { place: false, move: { box: BOX, t: 0.5 } });
    box.commit();
    box.release();
    expect(box.move()).toBeNull();
  });
});
