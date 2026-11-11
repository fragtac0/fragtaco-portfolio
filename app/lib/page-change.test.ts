import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterSettled, changePage, isPageSettled, pageCommitted, planChange, subscribeSettled } from "./page-change";

const screen = { vw: 1440, vh: 900 };

describe("planChange", () => {
  it("gives none without View Transitions support", () => {
    const plan = planChange({ supported: false, reduced: false, ...screen });
    expect(plan.kind).toBe("none");
    expect(plan.ms).toBe(0);
  });

  it("gives a 120 ms fade under reduced motion, whatever kind was asked", () => {
    expect(planChange({ supported: true, reduced: true, kind: "radial", ...screen })).toMatchObject({ kind: "fade", ms: 120 });
    expect(planChange({ supported: true, reduced: true, kind: "linear-left", ...screen })).toMatchObject({ kind: "fade", ms: 120 });
  });

  it("puts the origin at the centre of the screen by default", () => {
    expect(planChange({ supported: true, reduced: false, ...screen }).origin).toEqual({ x: 720, y: 450 });
    expect(planChange({ supported: true, reduced: true, ...screen }).origin).toEqual({ x: 720, y: 450 });
  });

  it("keeps a given origin", () => {
    const origin = { x: 100, y: 800 };
    expect(planChange({ supported: true, reduced: false, origin, ...screen }).origin).toEqual(origin);
  });

  it("makes the radius the distance to the farthest corner", () => {
    expect(planChange({ supported: true, reduced: false, ...screen }).radius).toBeCloseTo(Math.hypot(720, 450));
    // bottom left: the farthest corner is the top right
    expect(planChange({ supported: true, reduced: false, origin: { x: 0, y: 900 }, ...screen }).radius).toBeCloseTo(Math.hypot(1440, 900));
    // near the top right: the farthest corner is the bottom left
    expect(planChange({ supported: true, reduced: false, origin: { x: 1400, y: 40 }, ...screen }).radius).toBeCloseTo(Math.hypot(1400, 860));
  });

  it("defaults to the radial reveal and takes the spec's times", () => {
    expect(planChange({ supported: true, reduced: false, ...screen })).toMatchObject({ kind: "radial", ms: 560 });
    expect(planChange({ supported: true, reduced: false, kind: "linear-right", ...screen })).toMatchObject({ kind: "linear-right", ms: 480 });
    expect(planChange({ supported: true, reduced: false, kind: "fade", ...screen })).toMatchObject({ kind: "fade", ms: 120 });
  });
});

/** A document with a controllable view transition, enough for changePage. */
function fakeEnvironment(opts: { supported?: boolean; finishedRejects?: boolean } = {}) {
  const props = new Map<string, string>();
  const html = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (k: string, v: string) => void props.set(k, v),
      removeProperty: (k: string) => void props.delete(k),
    },
  };
  const transitions: { skipped: boolean; finish: () => void; callbackDone: Promise<void> }[] = [];
  const doc: Record<string, unknown> = { documentElement: html };
  if (opts.supported !== false) {
    doc.startViewTransition = (update: () => Promise<void> | void) => {
      let finish = () => {};
      const t = { skipped: false, finish: () => finish(), callbackDone: Promise.resolve() };
      const callbackDone = Promise.resolve().then(update);
      t.callbackDone = callbackDone;
      const finished = new Promise<void>((resolve, reject) => {
        finish = () => (opts.finishedRejects ? reject(new Error("aborted")) : resolve());
        void callbackDone.then(() => undefined);
      });
      transitions.push(t);
      return {
        ready: Promise.resolve(),
        updateCallbackDone: callbackDone,
        finished,
        skipTransition: () => {
          t.skipped = true;
          finish();
        },
      };
    };
  }
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false }),
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: "/" },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return { html, props, transitions };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("changePage", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks the page while the change runs, clears it when it is over, and is unsettled in between", async () => {
    const env = fakeEnvironment();
    const navigate = vi.fn();
    const seen: boolean[] = [];
    const off = subscribeSettled(() => seen.push(isPageSettled()));
    const done = changePage(navigate, "/work", { origin: { x: 10, y: 20 } });
    expect(env.html.dataset.changeKind).toBe("radial");
    expect(env.props.get("--change-x")).toBe("10px");
    expect(env.props.get("--change-y")).toBe("20px");
    expect(isPageSettled()).toBe(false);
    await tick();
    expect(navigate).toHaveBeenCalledWith("/work");
    pageCommitted("/work");
    await tick();
    env.transitions[0].finish();
    await done;
    off();
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(env.props.size).toBe(0);
    expect(isPageSettled()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it("holds the update step until the new page is committed", async () => {
    const env = fakeEnvironment();
    const done = changePage(vi.fn(), "/work");
    let updated = false;
    void env.transitions[0].callbackDone.then(() => (updated = true));
    await tick();
    expect(updated).toBe(false);
    pageCommitted("/work");
    await tick();
    expect(updated).toBe(true);
    env.transitions[0].finish();
    await done;
  });

  it("still resolves, and settles, when the transition is rejected", async () => {
    const env = fakeEnvironment({ finishedRejects: true });
    const done = changePage(vi.fn(), "/work");
    await tick();
    pageCommitted("/work");
    await tick();
    env.transitions[0].finish();
    await expect(done).resolves.toBeUndefined();
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
  });

  it("skips the first change when a second starts, and both resolve", async () => {
    const env = fakeEnvironment();
    const first = changePage(vi.fn(), "/work");
    await tick();
    const second = changePage(vi.fn(), "/timeline", { kind: "linear-left" });
    expect(env.transitions[0].skipped).toBe(true);
    await first;
    // the second change still holds the marks and the busy state
    expect(env.html.dataset.changeKind).toBe("linear-left");
    expect(isPageSettled()).toBe(false);
    await tick();
    pageCommitted("/timeline");
    await tick();
    env.transitions[1].finish();
    await second;
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
  });

  it("just navigates, and resolves, where View Transitions are not supported", async () => {
    const env = fakeEnvironment({ supported: false });
    const navigate = vi.fn();
    await changePage(navigate, "/work");
    expect(navigate).toHaveBeenCalledWith("/work");
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(isPageSettled()).toBe(true);
  });
});

describe("afterSettled", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs after the quiet time when nothing is changing, and not before", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const fn = vi.fn();
    afterSettled(1500, fn);
    vi.advanceTimersByTime(1499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const fn = vi.fn();
    const cancel = afterSettled(100, fn);
    cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it("starts the quiet time when the change is over, not when it began", async () => {
    const env = fakeEnvironment();
    const done = changePage(vi.fn(), "/work");
    const fn = vi.fn();
    afterSettled(40, fn);
    await sleep(80); // longer than the quiet time, but the change is still running
    expect(fn).not.toHaveBeenCalled();
    await tick();
    pageCommitted("/work");
    await tick();
    env.transitions[0].finish();
    await done;
    expect(fn).not.toHaveBeenCalled();
    await sleep(80);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
