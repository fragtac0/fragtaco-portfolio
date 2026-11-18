// Stand-ins for the move driver tests (move-driver.test.ts, move-driver-reduced.test.ts): a fake element, engine and animation-frame clock.
import { afterEach, beforeEach, vi } from "vitest";
import { createMoveDriver, type DriverParts, type FramedEngine } from "./move-driver";
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
export let queue: Array<(t: number) => void> = [];
export const step = (ms: number) => {
  clock += ms;
  const run = queue;
  queue = [];
  run.forEach((f) => f(clock));
};
/** Runs the animation frames at 16 ms until the queue is empty or `max` ms have gone. */
export const settle = (max = 3000) => {
  for (let t = 0; t < max && queue.length; t += 16) step(16);
};

export const BOX: Frame = { left: 100, top: 400, width: 320, height: 200 };

export function setup(over: Partial<DriverParts> & { reduced?: boolean } = {}) {
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

/** Registers the fake clock, animation frames and window for the tests of the file that calls it (at its top level). */
export function installDriverEnv() {
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
}
