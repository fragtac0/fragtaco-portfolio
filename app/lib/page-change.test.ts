import type { NavigateFunction } from "@remix-run/react";
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
  const transitions: { skipped: boolean; finish: () => void; updated: boolean }[] = [];
  const doc: Record<string, unknown> = { documentElement: html };
  if (opts.supported !== false) {
    doc.startViewTransition = (update: () => Promise<void> | void) => {
      let finish = () => {};
      const t = { skipped: false, finish: () => finish(), updated: false };
      const updateDone = Promise.resolve().then(update).then(() => void (t.updated = true));
      const finished = new Promise<void>((resolve, reject) => {
        finish = () => (opts.finishedRejects ? reject(new Error("aborted")) : resolve());
      });
      transitions.push(t);
      return {
        ready: Promise.resolve(),
        updateCallbackDone: updateDone,
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
  /** What the router does with `viewTransition`: once its data is loaded it starts the transition, whose update commits the page. */
  const router = (path: string) => {
    const calls: unknown[][] = [];
    const navigate = vi.fn((to: unknown, options?: { viewTransition?: boolean }) => {
      calls.push([to, options]);
      return Promise.resolve();
    }) as unknown as NavigateFunction;
    const dataArrives = () => {
      (doc.startViewTransition as (u: () => void) => unknown)(() => pageCommitted(path));
    };
    return { navigate, dataArrives, calls };
  };
  return { html, props, transitions, doc, router };
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

  it("asks the router for the view transition, and leaves the old page live while the data loads", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const original = env.doc.startViewTransition;
    void changePage(r.navigate, "/work");
    await tick();
    expect(r.calls).toEqual([["/work", { viewTransition: true }]]);
    // nothing has started a transition yet: rendering is not held while the data loads
    expect(env.transitions).toHaveLength(0);
    expect(isPageSettled()).toBe(false);
    // the router's own call is let through, and the document is put back as it was
    r.dataArrives();
    expect(env.transitions).toHaveLength(1);
    expect(env.doc.startViewTransition).toBe(original);
    env.transitions[0].finish();
    await tick();
    expect(isPageSettled()).toBe(true);
  });

  it("marks the page while the change runs, clears it when it is over, and is unsettled in between", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const seen: boolean[] = [];
    const off = subscribeSettled(() => seen.push(isPageSettled()));
    const done = changePage(r.navigate, "/work", { origin: { x: 10, y: 20 } });
    expect(env.html.dataset.changeKind).toBe("radial");
    expect(env.props.get("--change-x")).toBe("10px");
    expect(env.props.get("--change-y")).toBe("20px");
    expect(isPageSettled()).toBe(false);
    r.dataArrives();
    await tick();
    env.transitions[0].finish();
    await done;
    off();
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(env.props.size).toBe(0);
    expect(isPageSettled()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it("still resolves, and settles, when the transition is rejected", async () => {
    const env = fakeEnvironment({ finishedRejects: true });
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    r.dataArrives();
    await tick();
    env.transitions[0].finish();
    await expect(done).resolves.toBeUndefined();
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
  });

  it("ends the change when the router commits without a transition", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    pageCommitted("/work"); // a redirect or the same place: no transition was started
    await done;
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
  });

  it("skips the first change when a second starts, and both resolve", async () => {
    const env = fakeEnvironment();
    const r1 = env.router("/work");
    const first = changePage(r1.navigate, "/work");
    r1.dataArrives();
    await tick();
    const r2 = env.router("/timeline");
    const second = changePage(r2.navigate, "/timeline", { kind: "linear-left" });
    expect(env.transitions[0].skipped).toBe(true);
    await first;
    // the second change still holds the marks and the busy state
    expect(env.html.dataset.changeKind).toBe("linear-left");
    expect(isPageSettled()).toBe(false);
    r2.dataArrives();
    await tick();
    env.transitions[1].finish();
    await second;
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
  });

  it("frees the first change even if its transition never started", async () => {
    const env = fakeEnvironment();
    const original = env.doc.startViewTransition;
    const first = changePage(env.router("/work").navigate, "/work"); // its data never arrives
    const r2 = env.router("/timeline");
    const second = changePage(r2.navigate, "/timeline");
    await first;
    r2.dataArrives();
    expect(env.transitions).toHaveLength(1); // only the second one's transition
    env.transitions[0].finish();
    await second;
    expect(env.doc.startViewTransition).toBe(original);
    expect(isPageSettled()).toBe(true);
  });

  it("just navigates, and resolves, where View Transitions are not supported", async () => {
    const env = fakeEnvironment({ supported: false });
    const navigate = vi.fn() as unknown as NavigateFunction;
    await changePage(navigate, "/work");
    expect(navigate).toHaveBeenCalledWith("/work", { viewTransition: false });
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
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    const fn = vi.fn();
    afterSettled(40, fn);
    await sleep(80); // longer than the quiet time, but the change is still running
    expect(fn).not.toHaveBeenCalled();
    r.dataArrives();
    await tick();
    env.transitions[0].finish();
    await done;
    expect(fn).not.toHaveBeenCalled();
    await sleep(80);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
