import { describe, expect, it } from "vitest";
import { BOX, queue, settle, setup, step, installDriverEnv } from "./move-driver-fake";
import { OPEN_MS, BOX_RADIUS } from "./open-move";

installDriverEnv();

describe("the move driver: opening", () => {
  it("carries the scene to the stage at the box's place, grows it to the window over OPEN_MS and ends open", () => {
    const t = setup();
    t.driver.go(1);
    expect(t.scene.parentElement).toBe(t.stage);
    expect(t.scene.dataset.at).toBe("move");
    expect(t.scene.attrs.has("inert")).toBe(false); // in the layer it answers the keyboard and a screen reader
    // the first frame is the box's own rect
    step(16);
    expect([t.scene.num("left"), t.scene.num("top"), t.scene.num("width"), t.scene.num("height")]).toEqual([
      expect.closeTo(BOX.left, 0),
      expect.closeTo(BOX.top, 0),
      expect.closeTo(BOX.width, 0),
      expect.closeTo(BOX.height, 0),
    ]);
    expect(t.scene.num("border-radius")).toBeCloseTo(BOX_RADIUS, 0);
    // the engine is asked for the frame's size (docked, not placed), and the element follows in the engine's frame
    const first = t.calls.at(-1)!;
    expect(first.frame).toMatchObject({ left: 0, top: 0 });
    expect(first.frame!.width).toBeCloseTo(BOX.width, 0);
    expect(first.opts?.place).toBe(false);
    // half way the frame is between the box and the window
    step(OPEN_MS / 2 - 16);
    const w = t.scene.num("width");
    expect(w).toBeGreaterThan(BOX.width);
    expect(w).toBeLessThan(1440);
    expect(t.sink.props.get("transform")).toMatch(/^scale\(/);
    expect(Number(t.shade.props.get("opacity"))).toBeGreaterThan(0);
    expect(t.done).not.toHaveBeenCalled();
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    expect(t.scene.dataset.at).toBe("open");
    expect(t.scene.props.has("width")).toBe(false); // the stylesheet's window frame takes over
    expect(t.calls.at(-1)!.frame).toBeNull(); // the engine draws the whole window again
    expect(t.docked.at(-1)).toBe(false);
    expect(t.root.classes.has("ready")).toBe(true);
    expect(t.head.props.has("opacity")).toBe(false); // the stylesheet decides again
  });

  it("tells the engine where the move is: the box it started in and how far along, so a scene can frame its picture over it", () => {
    const t = setup();
    t.driver.go(1);
    step(16);
    const first = t.calls.at(-1)!;
    expect(first.opts?.move?.box).toMatchObject({ width: BOX.width, height: BOX.height });
    expect(first.opts?.move?.t).toBeLessThan(0.01);
    step(OPEN_MS / 2 - 16);
    const mid = t.calls.at(-1)!;
    expect(mid.opts?.move?.t).toBeGreaterThan(0.3);
    expect(mid.opts?.move?.t).toBeLessThan(0.7);
    // the frame is the line from the box to the window at that position
    expect(mid.frame!.width).toBeCloseTo(BOX.width + mid.opts!.move!.t * (1440 - BOX.width), 6);
    // the positions only grow, and the last frame of the move is the window at 1
    let prev = -1;
    for (const c of t.calls) {
      if (!c.opts?.move) continue;
      expect(c.opts.move.t).toBeGreaterThanOrEqual(prev);
      prev = c.opts.move.t;
    }
    settle();
    const last = t.calls.filter((c) => c.opts?.move).at(-1)!;
    expect(last.opts!.move!.t).toBe(1);
    expect(last.frame).toMatchObject({ width: 1440, height: 900 });
  });

  it("the whole-window frame a closing starts from says it is at 1 for the box it will return to", () => {
    const t = setup();
    t.driver.go(1);
    settle();
    t.driver.go(0);
    const start = t.calls.at(-1)!;
    expect(start.frame).toMatchObject({ width: 1440, height: 900 });
    expect(start.opts?.move).toMatchObject({ t: 1, box: { width: BOX.width, height: BOX.height } });
  });

  it("the chrome follows the move: hidden until 72% of it, whole at the end", () => {
    const t = setup();
    t.driver.go(1);
    step(16);
    expect(t.head.props.get("visibility")).toBe("hidden");
    step(500);
    expect(t.head.props.get("visibility")).toBe("hidden");
    step(400);
    expect(Number(t.head.props.get("opacity"))).toBeGreaterThan(0);
    expect(t.head.props.get("visibility")).toBe("visible");
  });

  it("an instant open (a deep link) shows no move: it is open and ready at once", () => {
    const t = setup();
    t.driver.go(1, true);
    expect(queue.length).toBe(0);
    expect(t.scene.dataset.at).toBe("open");
    expect(t.root.classes.has("ready")).toBe(true);
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    expect(t.docked.at(-1)).toBe(false);
    expect(t.calls.some((c) => c.frame && c.frame.width < 1440)).toBe(false);
  });

  it("a plain scene (no engine) is glued to the frame at full size from the first frame", () => {
    const t = setup();
    t.setEngine(null);
    t.driver.go(1);
    step(16);
    expect(t.scene.props.has("--glue")).toBe(true);
    expect(t.scene.num("--glue")).toBeGreaterThan(0);
    step(OPEN_MS / 2);
    expect(t.scene.num("width")).toBeGreaterThan(BOX.width);
    settle();
    expect(t.done).toHaveBeenCalledWith(1);
    expect(t.scene.props.has("--glue")).toBe(false);
  });

  it("reads the engine on every frame: one lost part way is not called after it", () => {
    const t = setup();
    t.driver.go(1);
    step(16);
    const n = t.calls.length;
    t.setEngine(null);
    step(16);
    expect(t.calls.length).toBe(n);
    expect(t.scene.num("width")).toBeGreaterThan(0); // the element still follows, as the plain grid
  });
});

describe("the move driver: closing and turning", () => {
  function open(t: ReturnType<typeof setup>) {
    t.driver.go(1);
    settle();
    t.done.mockClear();
  }

  it("closing is the move backwards: the scene ends back in its slot at the box, docked", () => {
    const t = setup();
    open(t);
    t.driver.go(0);
    expect(t.closeDetail).toHaveBeenCalledOnce(); // an open video is put away
    expect(t.docked.at(-1)).toBe(true);
    expect(t.scene.dataset.at).toBe("move");
    step(16);
    expect(t.scene.num("width")).toBeGreaterThan(1300);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(0);
    expect(t.scene.parentElement).toBe(t.slot);
    expect(t.scene.dataset.at).toBeUndefined();
    expect(t.scene.attrs.get("inert")).toBe("");
    expect(t.root.classes.has("ready")).toBe(false);
    expect(t.sink.props.get("transform")).toBe("");
    const last = t.calls.at(-1)!;
    expect(last.frame).toEqual({ left: 0, top: 0, width: BOX.width, height: BOX.height });
    expect(t.docked.at(-1)).toBe(true);
  });

  it("closing measures the box where it is now (the window was resized while open)", () => {
    const t = setup();
    open(t);
    t.driver.go(0);
    step(16);
    // the page was laid out again while open: the box is somewhere else and smaller
    t.setBox({ left: 50, top: 300, width: 260, height: 180 });
    t.driver.resized();
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(0);
    expect(t.calls.at(-1)!.frame).toEqual({ left: 0, top: 0, width: 260, height: 180 });
    expect(t.scene.parentElement).toBe(t.slot);
  });

  it("a Close in the middle of an opening turns the move round from where it is: no jump", () => {
    const t = setup();
    t.driver.go(1);
    step(16);
    step(450);
    const wBefore = t.scene.num("width");
    t.driver.go(0);
    step(16);
    const wAfter = t.scene.num("width");
    expect(Math.abs(wAfter - wBefore)).toBeLessThan(80); // one frame of a 1 s move at its fastest is about 5% of the way
    // and it goes down from there to the box
    step(100);
    expect(t.scene.num("width")).toBeLessThan(wAfter);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(0);
    expect(t.scene.parentElement).toBe(t.slot);
  });

  it("a click during a closing turns it back into an opening", () => {
    const t = setup();
    open(t);
    t.driver.go(0);
    step(16);
    step(400);
    const w = t.scene.num("width");
    t.driver.go(1);
    step(16);
    expect(Math.abs(t.scene.num("width") - w)).toBeLessThan(80);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    expect(t.scene.dataset.at).toBe("open");
  });

  it("go(1) when open and go(0) when in the box are nothing", () => {
    const t = setup();
    t.driver.go(0);
    expect(queue.length).toBe(0);
    expect(t.done).not.toHaveBeenCalled();
    open(t);
    t.driver.go(1);
    expect(queue.length).toBe(0);
  });

  it("dispose stops the loop", () => {
    const t = setup();
    t.driver.go(1);
    step(16);
    t.driver.dispose();
    expect(queue.length).toBe(0);
  });
});
