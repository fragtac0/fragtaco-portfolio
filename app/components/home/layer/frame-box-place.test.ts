import { describe, expect, it, vi } from "vitest";
import { createFrameBox } from "./frame-box";
import { fakeCanvas } from "./frame-box-fake";
import type { Frame } from "./frame-math";

const A: Frame = { left: 10, top: 20, width: 480, height: 300 };

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
