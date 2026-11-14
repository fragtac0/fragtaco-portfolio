import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMoveDriver, type DriverParts, type FramedEngine } from "./move-driver";
import { OPEN_MS, REDUCED_FADE_MS, BOX_RADIUS } from "./open-move";
import type { Frame } from "./frame-math";
import type { FrameOptions } from "./frame-box";

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/** An element with a style, a dataset, classes and a parent: only what the driver touches. */
class El {
  style: Record<string, unknown> & {
    setProperty(p: string, v: string): void;
    removeProperty(p: string): void;
  };
  props = new Map<string, string>();
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  classes = new Set<string>();
  parentElement: El | null = null;
  rect: () => Frame = () => ({ left: 0, top: 0, width: 0, height: 0 });
  constructor() {
    const props = this.props;
    const own: Record<string, unknown> = {
      setProperty: (p: string, v: string) => void props.set(p, v),
      removeProperty: (p: string) => void props.delete(p),
    };
    this.style = new Proxy(own, {
      get: (t, k: string) => (k in t ? t[k] : props.get(kebab(k))),
      set: (_t, k: string, v: string) => (props.set(kebab(k), v), true),
    }) as unknown as El["style"];
  }
  classList = {
    add: (c: string) => void this.classes.add(c),
    remove: (c: string) => void this.classes.delete(c),
  };
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
    if (k.startsWith("data-")) delete this.dataset[k.slice(5)];
  }
  appendChild(c: El) {
    c.parentElement = this;
  }
  getBoundingClientRect() {
    const r = this.rect();
    return { ...r, right: r.left + r.width, bottom: r.top + r.height };
  }
  num(p: string) {
    return parseFloat(this.props.get(p) ?? "NaN");
  }
}

type Call = { frame: Frame | null; opts?: FrameOptions };
function fakeEngine() {
  const calls: Call[] = [];
  const docked: boolean[] = [];
  const engine: FramedEngine = {
    setFrame(frame, opts) {
      calls.push({ frame, opts });
      opts?.onApplied?.(); // the engine commits at once and calls the hook
    },
    setDocked(on) {
      docked.push(on);
    },
  };
  return { engine, calls, docked };
}

let clock = 0;
let queue: Array<(t: number) => void> = [];
const step = (ms: number) => {
  clock += ms;
  const run = queue;
  queue = [];
  run.forEach((f) => f(clock));
};
/** Runs the animation frames at 16 ms until the queue is empty or `max` ms have gone. */
const settle = (max = 3000) => {
  for (let t = 0; t < max && queue.length; t += 16) step(16);
};

const BOX: Frame = { left: 100, top: 400, width: 320, height: 200 };

function setup(over: Partial<DriverParts> & { reduced?: boolean } = {}) {
  const scene = new El();
  const stage = new El();
  const slot = new El();
  const box = new El();
  const root = new El();
  const shade = new El();
  const head = new El();
  const sink = new El();
  slot.appendChild(scene);
  // the box as the page shows it: sunk with the home page (a scale about the middle of the window)
  let base = { ...BOX };
  box.rect = () => {
    const m = /scale\(([\d.]+)\)/.exec(String(sink.props.get("transform") ?? ""));
    const s = m ? Number(m[1]) : 1;
    return {
      left: 720 + (base.left - 720) * s,
      top: 450 + (base.top - 450) * s,
      width: base.width * s,
      height: base.height * s,
    };
  };
  const e = fakeEngine();
  const done = vi.fn();
  const closeDetail = vi.fn();
  let current: FramedEngine | null = over.engine ? (over.engine as never) : e.engine;
  const parts: DriverParts = {
    scene: scene as never,
    stage: stage as never,
    box: box as never,
    slot: slot as never,
    root: root as never,
    shade: shade as never,
    head: head as never,
    sink: sink as never,
    engine: () => current,
    reduced: over.reduced ?? false,
    closeDetail,
    done,
  };
  const driver = createMoveDriver(parts);
  return {
    driver,
    scene,
    stage,
    slot,
    root,
    shade,
    head,
    sink,
    done,
    closeDetail,
    ...e,
    setEngine: (x: FramedEngine | null) => void (current = x),
    setBox: (f: Frame) => void (base = f),
  };
}

beforeEach(() => {
  clock = 1000;
  queue = [];
  vi.stubGlobal("window", { scrollY: 0, innerWidth: 1440, innerHeight: 900 });
  vi.stubGlobal("document", { documentElement: { clientWidth: 1440, clientHeight: 900 } });
  vi.stubGlobal("requestAnimationFrame", (f: (t: number) => void) => {
    queue.push(f);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    queue = [];
  });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

describe("the move driver: reduced motion", () => {
  it("never grows a frame: the black rises over the page with the scene in its box, then the open page fades in", () => {
    const t = setup({ reduced: true });
    t.driver.go(1);
    expect(t.scene.parentElement).toBe(t.slot);
    // first quarter: the shade is rising, the scene is still in its box
    step(16);
    step(REDUCED_FADE_MS / 4);
    expect(Number(t.shade.props.get("opacity"))).toBeGreaterThan(0.3);
    expect(Number(t.shade.props.get("opacity"))).toBeLessThan(0.9);
    expect(t.scene.parentElement).toBe(t.slot);
    expect(t.scene.dataset.at).toBeUndefined();
    // the second half: carried to the layer under the black, fading in
    step(REDUCED_FADE_MS * 0.4);
    expect(t.scene.dataset.at).toBe("open");
    expect(Number(t.shade.props.get("opacity"))).toBe(1);
    expect(Number(t.scene.props.get("opacity"))).toBeLessThan(1);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    // no frame of it was a growing frame
    expect(t.calls.every((c) => c.frame === null || c.frame.width === 1440 || c.frame.width === BOX.width)).toBe(true);
    expect(t.scene.props.has("width")).toBe(false);
  });

  it("the scene is never in the layer while the page is lit (an empty box beside a lit page)", () => {
    const t = setup({ reduced: true });
    t.driver.go(1);
    let seenCarriedLit = false;
    for (let i = 0; i < 20 && queue.length; i++) {
      step(10);
      if (t.scene.dataset.at && Number(t.shade.props.get("opacity") ?? 0) < 1) seenCarriedLit = true;
    }
    expect(seenCarriedLit).toBe(false);
  });

  it("closing is the dip backwards and ends with the scene back in its box", () => {
    const t = setup({ reduced: true });
    t.driver.go(1);
    settle();
    t.done.mockClear();
    t.driver.go(0);
    step(16);
    expect(t.scene.dataset.at).toBe("open"); // still the open page, fading out
    step(REDUCED_FADE_MS * 0.75);
    expect(t.scene.parentElement).toBe(t.slot); // back in the box under the black while it lifts
    expect(Number(t.shade.props.get("opacity"))).toBeGreaterThan(0);
    settle();
    expect(t.done).toHaveBeenCalledExactlyOnceWith(0);
    expect(t.scene.dataset.at).toBeUndefined();
    expect(t.shade.props.get("opacity")).toBe("0");
    expect(t.docked.at(-1)).toBe(true);
  });

  it("an instant open is the open page at once", () => {
    const t = setup({ reduced: true });
    t.driver.go(1, true);
    expect(t.scene.dataset.at).toBe("open");
    expect(t.done).toHaveBeenCalledExactlyOnceWith(1);
    expect(queue.length).toBe(0);
  });
});
