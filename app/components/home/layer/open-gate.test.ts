import { describe, expect, it } from "vitest";
import { READY_WAIT_MS, createOpenGate, type SceneStatus } from "./open-gate";
import type { LayerKind } from "./layer-state";

/** A clock the test turns by hand. */
function setup(initial: Partial<Record<LayerKind, SceneStatus>> = {}) {
  const status: Record<LayerKind, SceneStatus> = {
    reading: "pending",
    watching: "pending",
    ...initial,
  };
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const log: string[] = [];
  const gate = createOpenGate({
    status: (k) => status[k],
    open: (k, plain) => log.push(`open ${k}${plain ? " plain" : ""}`),
    press: (k, on) => log.push(`press ${k} ${on ? "on" : "off"}`),
    setTimer: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (id) => void timers.delete(id),
  });
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };
  return { gate, status, log, advance, timers };
}

describe("the open gate (a click on a box whose scene may not be ready)", () => {
  it("waits at most 400 ms", () => {
    expect(READY_WAIT_MS).toBe(400);
  });

  it("opens at once when the scene is ready", () => {
    const { gate, log } = setup({ reading: "ready" });
    gate.request("reading");
    expect(log).toEqual(["open reading"]);
  });

  it("opens at once to the plain grid when the scene is plain (no WebGL, a failed scene)", () => {
    const { gate, log } = setup({ watching: "plain" });
    gate.request("watching");
    expect(log).toEqual(["open watching plain"]);
  });

  it("a click before the scene is ready shows the pressed state and opens when the scene is ready", () => {
    const { gate, status, log, advance } = setup();
    gate.request("reading");
    expect(log).toEqual(["press reading on"]);
    advance(150);
    status.reading = "ready";
    gate.settled("reading");
    expect(log).toEqual(["press reading on", "press reading off", "open reading"]);
    advance(1000); // the timer is gone: no second open
    expect(log).toHaveLength(3);
  });

  it("after 400 ms with no scene it opens to the plain grid, never empty and never ignoring the click", () => {
    const { gate, log, advance } = setup();
    gate.request("watching");
    advance(399);
    expect(log).toEqual(["press watching on"]);
    advance(1);
    expect(log).toEqual(["press watching on", "press watching off", "open watching plain"]);
  });

  it("a scene that turns plain while waiting opens at once, plain", () => {
    const { gate, status, log } = setup();
    gate.request("reading");
    status.reading = "plain";
    gate.settled("reading");
    expect(log).toEqual(["press reading on", "press reading off", "open reading plain"]);
  });

  it("a second click while waiting, or a click on the other block, changes nothing", () => {
    const { gate, log, timers } = setup();
    gate.request("reading");
    gate.request("reading");
    gate.request("watching");
    expect(log).toEqual(["press reading on"]);
    expect(timers.size).toBe(1);
  });

  it("settled for a kind that is not waited for does nothing", () => {
    const { gate, status, log } = setup();
    gate.request("reading");
    status.watching = "ready";
    gate.settled("watching");
    expect(log).toEqual(["press reading on"]);
  });

  it("cancel drops the wait without opening", () => {
    const { gate, log, advance, timers } = setup();
    gate.request("reading");
    gate.cancel();
    advance(1000);
    expect(log).toEqual(["press reading on", "press reading off"]);
    expect(timers.size).toBe(0);
  });

  it("can be used again after an open", () => {
    const { gate, status, log } = setup();
    gate.request("reading");
    status.reading = "ready";
    gate.settled("reading");
    log.length = 0;
    gate.request("reading");
    expect(log).toEqual(["open reading"]);
  });
});
