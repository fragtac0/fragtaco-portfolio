import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteVideo } from "~/types";
import type { Frame } from "../layer/frame-math";
import { createWall } from "./wall-engine";
import type { WallEngine } from "./wall-types";

/**
 * The wall engine's loop with the GPU stubbed out: a fake canvas and window, hand-driven animation frames, and a draw counter in
 * place of the WebGL passes. What is real: the engine, its frame box, the block, the camera, the pose and the pointer/key code.
 */
const mocks = vi.hoisted(() => ({ draws: 0, pictures: [] as unknown[], targets: [] as Array<[number, number]>, createGl: true }));

vi.mock("./wall-gl", () => ({
  createWallGl: () =>
    mocks.createGl
      ? { gl: {}, uniforms: {}, setPicture: (p: unknown) => mocks.pictures.push(p), beginFrame: () => true, endFrame: () => undefined, prepareTarget: (vw: number, vh: number) => (mocks.targets.push([vw, vh]), true), quad: () => undefined, dispose: () => undefined }
      : null,
}));
vi.mock("./wall-thumbs", () => ({
  createThumbs: () => ({ pumpFrame: () => false, kick: () => undefined, loadedAt: new Float64Array(0), failedAt: new Float64Array(0), dispose: () => undefined }),
}));
vi.mock("./wall-draw", () => ({
  drawTiles: () => {
    mocks.draws++;
    return true;
  },
}));

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

const videos = Array.from({ length: 60 }, (_, i) => ({ id: `v${i}`, title: `T${i}`, channel: `c${i % 7}` })) as unknown as SiteVideo[];

function make(): WallEngine {
  const wall = createWall(videos, { fine: true, reducedMotion: true, onPick: () => undefined });
  wall.mount({ host: { appendChild: () => undefined } as unknown as HTMLElement, chip: { classList: { add: () => undefined, remove: () => undefined } } as unknown as HTMLElement });
  return wall;
}

/** Runs the animation frames that are queued, `n` of them at 60 Hz. */
function frames(n: number) {
  for (let i = 0; i < n; i++) {
    clock += 1000 / 60;
    const run = queue;
    queue = [];
    for (const cb of run) cb(clock);
  }
}

async function started(): Promise<WallEngine> {
  const wall = make();
  await wall.start();
  frames(3);
  return wall;
}

beforeEach(() => {
  clock = 1000;
  queue = [];
  canvasListeners.clear();
  styleProps.clear();
  mocks.draws = 0;
  mocks.pictures = [];
  mocks.targets = [];
  mocks.createGl = true;
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
  vi.stubGlobal("document", { createElement: fakeCanvas, documentElement: { clientWidth: VW, clientHeight: VH }, activeElement: null });
  vi.stubGlobal("requestAnimationFrame", win.requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", win.cancelAnimationFrame);
  vi.stubGlobal("performance", { now: () => clock });
});
afterEach(() => vi.unstubAllGlobals());

describe("the wall's whenDrawn never hangs", () => {
  it("resolves drawn after the first frame the running wall draws", async () => {
    const wall = make();
    await wall.start();
    const w = wall.whenDrawn();
    frames(2);
    await expect(w).resolves.toBe("drawn");
    expect(mocks.draws).toBeGreaterThan(0);
  });

  it("stop lets a waiter go", async () => {
    const wall = make();
    void wall.start(); // still preparing
    const w = wall.whenDrawn();
    wall.stop();
    await expect(w).resolves.toBe("stopped");
  });

  it("a running wall that is stopped lets a waiter for a new frame go", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    const w = wall.whenDrawn();
    wall.stop();
    await expect(w).resolves.toBe("stopped");
  });

  it("dispose (and so unmount) lets a waiter go", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    const w = wall.whenDrawn();
    wall.dispose();
    await expect(w).resolves.toBe("stopped");
  });

  it("a wall that cannot start (no WebGL) lets the waiter go", async () => {
    mocks.createGl = false;
    const wall = make();
    const started = wall.start();
    const w = wall.whenDrawn();
    await started;
    await expect(w).resolves.toBe("stopped");
    expect(wall.hasFailed()).toBe(true);
  });

  it("a lost context lets a waiter go", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    const w = wall.whenDrawn();
    (canvasEl.dispatchEvent as (e: { type: string }) => void)({ type: "webglcontextlost" });
    await expect(w).resolves.toBe("stopped");
  });

  it("before any start it answers stopped at once", async () => {
    const wall = make();
    wall.setFrame(BOX);
    await expect(wall.whenDrawn()).resolves.toBe("stopped");
  });
});

describe("a docked wall", () => {
  it("draws at most 30 times a second, also when its frame moves every frame (a move is not a new picture)", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    frames(3);
    wall.setDocked(true);
    frames(3);
    const before = mocks.draws;
    for (let i = 0; i < 120; i++) {
      wall.setFrame({ ...BOX, left: BOX.left + i, top: BOX.top + (i % 5) });
      frames(1);
    }
    const n = mocks.draws - before;
    expect(n).toBeLessThanOrEqual(62);
    expect(n).toBeGreaterThanOrEqual(55);
    // and the canvas did follow the frame
    expect(styleProps.get("left")).toBe(`${BOX.left + 119}px`);
  });

  it("an undocked wall draws every frame, a frame that is resized every frame also draws every frame (a new size is a new picture)", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    frames(3);
    wall.setDocked(true);
    frames(3);
    const before = mocks.draws;
    for (let i = 0; i < 60; i++) {
      wall.setFrame({ ...BOX, width: BOX.width + 1 + i });
      frames(1);
    }
    expect(mocks.draws - before).toBe(60);
  });

  it("a moved frame updates where the canvas is for the pointer, without a draw", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    frames(3);
    wall.setDocked(true);
    frames(3);
    const before = mocks.draws;
    wall.setFrame({ ...BOX, left: 300 });
    frames(1); // between two 30 Hz draws
    expect(styleProps.get("left")).toBe("300px");
    expect(mocks.draws - before).toBeLessThanOrEqual(1);
  });

  it("caps the drawing buffer's pixel ratio while docked, and puts it back when undocked", async () => {
    const wall = await started();
    wall.setFrame(BOX);
    frames(3);
    expect([canvasEl.width, canvasEl.height]).toEqual([960, 600]);
    wall.setDocked(true, { maxDpr: 1 });
    frames(3);
    expect([canvasEl.width, canvasEl.height]).toEqual([480, 300]);
    wall.setDocked(false);
    frames(3);
    expect([canvasEl.width, canvasEl.height]).toEqual([960, 600]);
  });
});

describe("a frame the caller places", () => {
  it("writes no position to the canvas, and a move of it is nothing", async () => {
    const wall = await started();
    wall.setFrame(BOX, { place: false });
    frames(3);
    expect(styleProps.has("position")).toBe(false);
    expect(styleProps.has("left")).toBe(false);
    expect([canvasEl.width, canvasEl.height]).toEqual([960, 600]);
    const pics = mocks.pictures.length;
    wall.setFrame({ ...BOX, left: 700, top: 20 }, { place: false });
    frames(3);
    expect(styleProps.has("left")).toBe(false);
    expect(mocks.pictures.length).toBe(pics);
  });

  it("the same size placed or not is the same picture, and switching between them does not redraw", async () => {
    const wall = await started();
    wall.setDocked(true);
    wall.setFrame(BOX, { place: false });
    frames(6);
    const picture = mocks.pictures[mocks.pictures.length - 1];
    const buffer = [canvasEl.width, canvasEl.height];
    const w = wall.whenDrawn();
    await expect(w).resolves.toBe("drawn");
    wall.setFrame(BOX); // the open move starts: the window placement takes over
    frames(1);
    expect(styleProps.get("position")).toBe("fixed");
    expect(mocks.pictures[mocks.pictures.length - 1]).toEqual(picture);
    expect([canvasEl.width, canvasEl.height]).toEqual(buffer);
    wall.setFrame(BOX, { place: false });
    frames(1);
    expect(styleProps.has("position")).toBe(false);
    expect(mocks.pictures[mocks.pictures.length - 1]).toEqual(picture);
    expect([canvasEl.width, canvasEl.height]).toEqual(buffer);
    // a switch asks for no new picture: the wait for one is over at once
    await expect(wall.whenDrawn()).resolves.toBe("drawn");
  });
});

describe("a docked wall's arrival work (Task 26 I1)", () => {
  it("is done by prepare(), off screen: the buffer is the box's size and the target is allocated for the window, and nothing is drawn", async () => {
    const wall = make();
    wall.setDocked(true);
    wall.setFrame(BOX, { place: false });
    await wall.prepare();
    expect(mocks.targets).toEqual([[VW, VH]]);
    expect([canvasEl.width, canvasEl.height]).toEqual([960, 600]);
    expect(mocks.draws).toBe(0);
  });

  it("is not done for a wall that is not docked, or docked with no frame yet (start() does it, as before)", async () => {
    const free = make();
    free.setFrame(BOX, { place: false });
    await free.prepare();
    expect(mocks.targets).toEqual([]);
    mocks.targets = [];
    const noFrame = make();
    noFrame.setDocked(true);
    await noFrame.prepare();
    expect(mocks.targets).toEqual([]);
  });
});
