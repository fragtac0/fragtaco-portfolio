import { afterEach, describe, expect, it, vi } from "vitest";
import { createSlicer, idleSlice, whenIdle } from "./idle";

afterEach(() => vi.unstubAllGlobals());

describe("whenIdle", () => {
  it("uses requestIdleCallback with the given timeout and returns its cancel", () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal("window", { requestIdleCallback: request, cancelIdleCallback: cancel });
    const cb = () => {};
    const stop = whenIdle(cb, 1200);
    expect(request).toHaveBeenCalledWith(cb, { timeout: 1200 });
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("passes no options when there is no timeout", () => {
    const request = vi.fn(() => 1);
    vi.stubGlobal("window", { requestIdleCallback: request, cancelIdleCallback: () => {} });
    const cb = () => {};
    idleSlice(cb);
    expect(request).toHaveBeenCalledWith(cb);
  });

  it("falls back to a 120 ms timer without requestIdleCallback", () => {
    const set = vi.fn(() => 3);
    const clear = vi.fn();
    vi.stubGlobal("window", { setTimeout: set, clearTimeout: clear });
    const cb = () => {};
    const stop = whenIdle(cb, 1200);
    expect(set).toHaveBeenCalledWith(cb, 120);
    stop();
    expect(clear).toHaveBeenCalledWith(3);
  });
});

/** Fake idle callbacks, animation frames and a clock where `work()` costs 3 ms. */
function fakeBrowser() {
  let clock = 0;
  let nextId = 1;
  const idle = new Map<number, { cb: () => void; timeout?: number }>();
  const frames = new Map<number, () => void>();
  vi.stubGlobal("window", {
    requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => {
      idle.set(nextId, { cb, timeout: opts?.timeout });
      return nextId++;
    },
    cancelIdleCallback: (id: number) => void idle.delete(id),
    requestAnimationFrame: (cb: () => void) => {
      frames.set(nextId, cb);
      return nextId++;
    },
    cancelAnimationFrame: (id: number) => void frames.delete(id),
  });
  vi.stubGlobal("performance", { now: () => clock });
  const take = <V>(m: Map<number, V>) => {
    const [id, v] = [...m.entries()][0];
    m.delete(id);
    return v;
  };
  return {
    work: (ms = 3) => void (clock += ms),
    idleCount: () => idle.size,
    frameCount: () => frames.size,
    idleTimeouts: () => [...idle.values()].map((i) => i.timeout),
    flushIdle: () => take(idle).cb(),
    flushFrame: () => take(frames)(),
  };
}

describe("createSlicer", () => {
  it("urgent: 10 steps of 3 ms finish in 4 frames (3, 3, 3, 1)", async () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    slicer.setUrgent(true);
    let ran = 0;
    const done = slicer.run(
      Array.from({ length: 10 }, () => () => {
        ran++;
        b.work();
      }),
    );
    const perFrame: number[] = [];
    while (b.frameCount()) {
      const before = ran;
      b.flushFrame();
      perFrame.push(ran - before);
    }
    await done;
    expect(perFrame).toEqual([3, 3, 3, 1]);
    expect(b.idleCount()).toBe(0);
  });

  it("urgent: runs nothing until the first frame", () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    slicer.setUrgent(true);
    const step = vi.fn();
    void slicer.run([step]);
    expect(step).not.toHaveBeenCalled();
    expect(b.frameCount()).toBe(1);
  });

  it("relaxed: each step waits for its own idle callback (1200 ms timeout)", async () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    let ran = 0;
    const done = slicer.run(Array.from({ length: 3 }, () => () => void ran++));
    expect(ran).toBe(0);
    expect(b.idleTimeouts()).toEqual([1200]);
    for (let i = 1; i <= 3; i++) {
      b.flushIdle();
      expect(ran).toBe(i);
    }
    await done;
    expect(b.frameCount()).toBe(0);
    expect(b.idleCount()).toBe(0);
  });

  it("switching to urgent after step 2 runs the rest in frames", async () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    let ran = 0;
    const done = slicer.run(
      Array.from({ length: 10 }, () => () => {
        ran++;
        b.work();
      }),
    );
    b.flushIdle();
    b.flushIdle();
    expect(ran).toBe(2);
    slicer.setUrgent(true);
    // the wait for step 3 moves from an idle callback to a frame
    expect(b.idleCount()).toBe(0);
    expect(b.frameCount()).toBe(1);
    const perFrame: number[] = [];
    while (b.frameCount()) {
      const before = ran;
      b.flushFrame();
      perFrame.push(ran - before);
    }
    await done;
    expect(perFrame).toEqual([3, 3, 2]);
    expect(ran).toBe(10);
  });

  it("switching to urgent from inside a step takes effect at the next step", async () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    const log: string[] = [];
    const done = slicer.run([
      () => log.push("a"),
      () => {
        log.push("b");
        slicer.setUrgent(true);
      },
      () => log.push("c"),
    ]);
    b.flushIdle();
    b.flushIdle();
    expect(b.idleCount()).toBe(0);
    expect(b.frameCount()).toBe(1);
    b.flushFrame();
    await done;
    expect(log).toEqual(["a", "b", "c"]);
  });

  it("switching back to relaxed returns to idle callbacks", async () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    slicer.setUrgent(true);
    let ran = 0;
    const done = slicer.run(Array.from({ length: 4 }, () => () => void ran++));
    b.flushFrame(); // all four fit one frame at 0 ms each
    await done;
    expect(ran).toBe(4);

    let again = 0;
    slicer.setUrgent(false);
    const second = slicer.run([() => void again++, () => void again++]);
    expect(b.frameCount()).toBe(0);
    b.flushIdle();
    b.flushIdle();
    await second;
    expect(again).toBe(2);
  });

  it("rejects with a step's error and runs no further steps", async () => {
    const b = fakeBrowser();
    const slicer = createSlicer();
    const after = vi.fn();
    const done = slicer.run([
      () => {
        throw new Error("stop");
      },
      after,
    ]);
    b.flushIdle();
    await expect(done).rejects.toThrow("stop");
    expect(after).not.toHaveBeenCalled();
    expect(b.idleCount()).toBe(0);
  });

  it("resolves at once with no steps", async () => {
    fakeBrowser();
    await createSlicer().run([]);
  });
});
