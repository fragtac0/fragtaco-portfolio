import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteBook } from "~/types";
import type { Frame } from "../layer/frame-math";
import type * as ShelfBuild from "./shelf-build";
import { createShelf } from "./shelf-engine";
import type * as ShelfPose from "./shelf-pose";
import type * as ShelfScene from "./shelf-scene";
import type * as SpineFonts from "./shelf-spine-fonts";
import type { ShelfEngine } from "./shelf-engine-types";

/**
 * The shelf engine's loop with three.js, the fit and the poses stubbed out: a fake canvas and window, hand-driven animation
 * frames, and a render counter. What is real: the engine, its frame box, the camera stepping and the dock and frame code.
 */
const mocks = vi.hoisted((): { renders: number; build: string; sizes: number[][]; ratio: number } => ({ renders: 0, build: "ok", sizes: [], ratio: 1.75 }));

vi.mock("./shelf-build", async (orig) => ({
  ...(await orig<typeof ShelfBuild>()),
  buildShelf: () =>
    mocks.build === "fail"
      ? Promise.reject(new Error("no three"))
      : Promise.resolve({
      books: [{ anim: { open: 0 }, coverTex: {}, d: { id: "b" }, spine: {} }],
      maxX: 0,
      visible: 1,
      scale: 1,
      camera: {
        position: { x: 0, y: 0 },
        setViewOffset: () => undefined,
        clearViewOffset: () => undefined,
        updateProjectionMatrix: () => undefined,
      },
      scene: {},
      renderer: {
        render: () => void mocks.renders++,
        clear: () => undefined,
        setSize: (...a: number[]) => void mocks.sizes.push(a),
        setPixelRatio: (r: number) => void (mocks.ratio = r),
        getPixelRatio: () => mocks.ratio,
        initTexture: () => undefined,
      },
      dispose: () => undefined,
    }),
}));
vi.mock("./shelf-fit", () => ({ fitShelf: () => undefined, readCovers: () => undefined }));
vi.mock("./shelf-pose", async (orig) => ({ ...(await orig<typeof ShelfPose>()), poseBooks: () => false }));
vi.mock("./shelf-spine-fonts", async (orig) => ({
  ...(await orig<typeof SpineFonts>()),
  createSpineFonts: () => ({ ready: Promise.resolve(), scene: () => undefined, stop: () => undefined }),
}));
vi.mock("./shelf-scene", async (orig) => ({ ...(await orig<typeof ShelfScene>()), loadShelfFonts: () => Promise.resolve() }));

const VW = 1440;
const VH = 900;
const BOX: Frame = { left: 100, top: 400, width: 480, height: 300 };

let clock = 0;
let queue: Array<(t: number) => void> = [];
const canvasListeners = new Map<string, Array<() => void>>();
const styleProps = new Map<string, string>();
let canvasEl: Record<string, unknown>;

function fakeCanvas() {
  const target: Record<string, unknown> = {
    removeProperty: (p: string) => void styleProps.delete(p),
    setProperty: (p: string, v: string) => void styleProps.set(p, v),
    getPropertyValue: (p: string) => styleProps.get(p) ?? "",
    getPropertyPriority: () => "",
  };
  const style = new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : styleProps.get(k)),
    set: (_t, k: string, v: string) => (styleProps.set(k, v), true),
  });
  canvasEl = {
    width: 300,
    height: 150,
    clientWidth: VW,
    clientHeight: VH,
    tabIndex: 0,
    className: "",
    dataset: {},
    style,
    classList: { add: () => undefined, remove: () => undefined },
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
    blur: () => undefined,
    focus: () => undefined,
    remove: () => undefined,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }),
    addEventListener: (type: string, cb: () => void) => canvasListeners.set(type, [...(canvasListeners.get(type) ?? []), cb]),
    dispatchEvent: (e: { type: string }) => void canvasListeners.get(e.type)?.forEach((cb) => cb()),
  };
  return canvasEl;
}

const books = [{ id: "b", title: "T", author: "A", pages: 1, isbn: "", heightIn: 8, aspect: 0.7, color: "#336699", style: {} }] as unknown as SiteBook[];

function make(): ShelfEngine {
  const shelf = createShelf(books, { reducedMotion: true });
  shelf.mount({
    host: { appendChild: () => undefined } as unknown as HTMLElement,
    info: { classList: { toggle: () => undefined }, setAttribute: () => undefined, querySelector: () => null } as unknown as HTMLElement,
  });
  return shelf;
}

function frames(n: number) {
  for (let i = 0; i < n; i++) {
    clock += 1000 / 60;
    const run = queue;
    queue = [];
    for (const cb of run) cb(clock);
  }
}

async function started(): Promise<ShelfEngine> {
  const shelf = make();
  await shelf.start();
  frames(3);
  return shelf;
}

beforeEach(() => {
  clock = 1000;
  queue = [];
  canvasListeners.clear();
  styleProps.clear();
  mocks.renders = 0;
  mocks.build = "ok";
  mocks.sizes = [];
  mocks.ratio = 1.75;
  const win = {
    devicePixelRatio: 2,
    innerWidth: VW,
    innerHeight: VH,
    addEventListener: () => undefined,
    requestIdleCallback: (cb: (d: unknown) => void) => {
      queueMicrotask(() => cb({ didTimeout: false, timeRemaining: () => 50 }));
      return 1;
    },
    cancelIdleCallback: () => undefined,
    requestAnimationFrame: (cb: (t: number) => void) => queue.push(cb),
    cancelAnimationFrame: () => undefined,
    setTimeout,
    clearTimeout,
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { createElement: fakeCanvas, documentElement: { clientWidth: VW, clientHeight: VH }, activeElement: null, fonts: undefined });
  vi.stubGlobal("requestAnimationFrame", win.requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", win.cancelAnimationFrame);
  vi.stubGlobal("performance", { now: () => clock });
});
afterEach(() => vi.unstubAllGlobals());

describe("the shelf's whenDrawn never hangs", () => {
  it("resolves drawn after the first frame the running shelf draws", async () => {
    const shelf = make();
    await shelf.start();
    const w = shelf.whenDrawn();
    frames(2);
    await expect(w).resolves.toBe("drawn");
    expect(mocks.renders).toBeGreaterThan(0);
  });

  it("stop lets a waiter go", async () => {
    const shelf = make();
    void shelf.start(); // still preparing
    const w = shelf.whenDrawn();
    shelf.stop();
    await expect(w).resolves.toBe("stopped");
  });

  it("a running shelf that is stopped lets a waiter for a new frame go", async () => {
    const shelf = await started();
    shelf.setFrame(BOX);
    const w = shelf.whenDrawn();
    shelf.stop();
    await expect(w).resolves.toBe("stopped");
  });

  it("dispose (and so unmount) lets a waiter go", async () => {
    const shelf = await started();
    shelf.setFrame(BOX);
    const w = shelf.whenDrawn();
    shelf.dispose();
    await expect(w).resolves.toBe("stopped");
  });

  it("a shelf whose build failed lets the waiter go", async () => {
    mocks.build = "fail";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const shelf = make();
    const started = shelf.start();
    const w = shelf.whenDrawn();
    await started;
    await expect(w).resolves.toBe("stopped");
    expect(shelf.hasFailed()).toBe(true);
  });

  it("a lost context lets a waiter go", async () => {
    const shelf = await started();
    shelf.setFrame(BOX);
    const w = shelf.whenDrawn();
    (canvasEl.dispatchEvent as (e: { type: string }) => void)({ type: "webglcontextlost" });
    await expect(w).resolves.toBe("stopped");
  });

  it("before any start it answers stopped at once", async () => {
    const shelf = make();
    shelf.setFrame(BOX);
    await expect(shelf.whenDrawn()).resolves.toBe("stopped");
  });
});

describe("a docked shelf", () => {
  it("draws nothing while still, and draws when something changes (a new frame size, a new pixel ratio)", async () => {
    const shelf = await started();
    shelf.setFrame(BOX);
    frames(3);
    shelf.setDocked(true);
    frames(3);
    let n = mocks.renders;
    frames(60);
    expect(mocks.renders - n).toBe(0);
    shelf.setFrame({ ...BOX, width: 500 });
    frames(2);
    expect(mocks.renders - n).toBe(1);
    n = mocks.renders;
    shelf.setDocked(true, { maxDpr: 1 });
    frames(2);
    expect(mocks.ratio).toBe(1);
    expect(mocks.renders - n).toBe(1);
    n = mocks.renders;
    shelf.setDocked(false);
    frames(2);
    expect(mocks.ratio).toBe(1.75);
    expect(mocks.renders - n).toBe(1);
  });

  it("a move of its frame draws nothing (the canvas is only placed)", async () => {
    const shelf = await started();
    shelf.setFrame(BOX);
    frames(3);
    shelf.setDocked(true);
    frames(3);
    const n = mocks.renders;
    for (let i = 0; i < 60; i++) {
      shelf.setFrame({ ...BOX, left: BOX.left + i });
      frames(1);
    }
    expect(mocks.renders - n).toBe(0);
    expect(styleProps.get("left")).toBe(`${BOX.left + 59}px`);
  });
});

describe("a frame the caller places", () => {
  it("writes no position to the canvas, and a move of it is nothing", async () => {
    const shelf = await started();
    shelf.setFrame(BOX, { place: false });
    frames(3);
    expect(styleProps.has("position")).toBe(false);
    expect(styleProps.has("left")).toBe(false);
    const sizes = mocks.sizes.length;
    shelf.setFrame({ ...BOX, left: 700, top: 20 }, { place: false });
    frames(3);
    expect(styleProps.has("left")).toBe(false);
    expect(mocks.sizes.length).toBe(sizes);
  });

  it("switching between placed and not at the same size sets no new renderer size and draws nothing", async () => {
    const shelf = await started();
    shelf.setDocked(true);
    shelf.setFrame(BOX, { place: false });
    frames(6);
    const sizes = mocks.sizes.length;
    const n = mocks.renders;
    shelf.setFrame(BOX);
    frames(2);
    expect(styleProps.get("position")).toBe("fixed");
    shelf.setFrame(BOX, { place: false });
    frames(2);
    expect(styleProps.has("position")).toBe(false);
    expect(mocks.sizes.length).toBe(sizes);
    expect(mocks.renders).toBe(n);
    await expect(shelf.whenDrawn()).resolves.toBe("drawn");
  });
});
