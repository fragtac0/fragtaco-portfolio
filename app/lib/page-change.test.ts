import type { NavigateFunction } from "@remix-run/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchHistory, type RouterLike } from "./history-change";
import { afterSettled, changePage, finishChange, isChangeShowing, isPageSettled, pageCommitted, planChange, subscribeSettled } from "./page-change";

const screen = { vw: 1440, vh: 900 };
const scr = { supported: true, reduced: false, ...screen };
const PAGES = ["/", "/work", "/work/long-form", "/work/short-form", "/experience"];

describe("planChange", () => {
  it("gives none without View Transitions support", () => {
    const plan = planChange("/", "/work", { ...scr, supported: false });
    expect(plan.kind).toBe("none");
    expect(plan.ms).toBe(0);
  });

  it("is the same radial 3500 ms reveal from the centre for every pair of pages, the two walls included", () => {
    for (const from of PAGES) {
      for (const to of PAGES) {
        expect(planChange(from, to, scr)).toEqual({
          kind: "radial",
          ms: 3500,
          origin: { x: 720, y: 450 },
          radius: Math.hypot(720, 450),
        });
      }
    }
  });

  it("gives the 120 ms fade under reduced motion, for every pair", () => {
    for (const from of PAGES) {
      for (const to of PAGES) expect(planChange(from, to, { ...scr, reduced: true })).toMatchObject({ kind: "fade", ms: 120, origin: { x: 720, y: 450 } });
    }
  });

  it("puts the origin at the centre of whatever screen it is, and the radius at the farthest corner from it", () => {
    expect(planChange("/", "/work", { ...scr, vw: 390, vh: 844 })).toMatchObject({ origin: { x: 195, y: 422 }, radius: Math.hypot(195, 422) });
    expect(planChange("/", "/work", { ...scr, vw: 1920, vh: 1080 }).origin).toEqual({ x: 960, y: 540 });
  });

  it("has no linear kinds", () => {
    expect(Object.keys(planChange("/work/long-form", "/work/short-form", scr)).sort()).toEqual(["kind", "ms", "origin", "radius"]);
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
  // querySelector, activeElement and body are read by dock-focus.ts when a change starts
  const doc: Record<string, unknown> = { documentElement: html, querySelector: () => null, activeElement: null, body: {} };
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
    const done = changePage(r.navigate, "/work");
    expect(env.html.dataset.changeKind).toBe("radial");
    // the centre of the screen, whatever was clicked
    expect(env.props.get("--change-x")).toBe("720px");
    expect(env.props.get("--change-y")).toBe("450px");
    expect(env.props.get("--change-ms")).toBe("3500ms");
    expect(env.props.has("--change-w")).toBe(false);
    // the glass numbers glass.css reads, from glass-math.ts
    expect(env.props.get("--change-band")).toBe("0.07");
    expect(env.props.get("--change-ease")).toBe("cubic-bezier(0.65, 0, 0.35, 1)");
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
    const second = changePage(r2.navigate, "/timeline");
    expect(env.transitions[0].skipped).toBe(true);
    await first;
    // the second change still holds the marks and the busy state
    expect(env.html.dataset.changeKind).toBe("radial");
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

  it("ends the change when the navigation is rejected", async () => {
    const env = fakeEnvironment();
    const navigate = vi.fn(() => Promise.reject(new Error("no"))) as unknown as NavigateFunction;
    await changePage(navigate, "/work");
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
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

describe("finishChange", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing when no change is running", () => {
    fakeEnvironment();
    expect(isChangeShowing()).toBe(false);
    expect(() => finishChange()).not.toThrow();
    expect(isPageSettled()).toBe(true);
  });

  it("does nothing while the data loads (the old page is live, no pictures yet)", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    expect(isChangeShowing()).toBe(false);
    finishChange();
    expect(isPageSettled()).toBe(false);
    expect(env.html.dataset.changeKind).toBe("radial");
    r.dataArrives();
    await tick();
    env.transitions[0].finish();
    await done;
  });

  it("skips the transition to its end, and leaves the state settled and the marks off", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    r.dataArrives();
    await tick();
    expect(isChangeShowing()).toBe(true);
    expect(isPageSettled()).toBe(false);
    finishChange();
    expect(env.transitions[0].skipped).toBe(true);
    await done;
    expect(isChangeShowing()).toBe(false);
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(env.props.size).toBe(0);
  });

  it("is harmless when called twice", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    r.dataArrives();
    await tick();
    finishChange();
    finishChange();
    await done;
    finishChange();
    expect(isPageSettled()).toBe(true);
  });
});

describe("watchHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The environment plus a popstate handler and a router stub that can report its state. */
  function setup() {
    const env = fakeEnvironment();
    const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
    let onPop: () => void = () => {};
    const location = { pathname: "/work" };
    win.location = location;
    win.addEventListener = (_: string, fn: () => void) => void (onPop = fn);
    let subscriber: Parameters<RouterLike["subscribe"]>[0] = () => {};
    win.__remixRouter = {
      subscribe: (fn: typeof subscriber) => {
        subscriber = fn;
        return () => {};
      },
    };
    pageCommitted("/work");
    const stop = watchHistory();
    return {
      ...env,
      stop,
      /** The browser goes Back to `path`. */
      pop(path: string) {
        location.pathname = path;
        onPop();
      },
      /** The router has the data for `path`; `opts` is what it passes when it will start the transition itself. */
      dataArrives(path: string, opts?: unknown, navigation = "idle") {
        subscriber({ navigation: { state: navigation }, location: { pathname: path } }, { viewTransitionOpts: opts });
      },
      routerStartsTransition() {
        // looked up now: the module may have put its capture in front of the document's own
        (env.doc.startViewTransition as (u: () => void) => unknown)(() => pageCommitted("/"));
      },
    };
  }

  it("takes the router's own transition on a POP it will animate, and starts none of its own", async () => {
    const w = setup();
    w.pop("/");
    // opened at the popstate: marked, unsettled, and rendering is not held (no transition yet)
    expect(w.html.dataset.changeKind).toBe("radial");
    expect(isPageSettled()).toBe(false);
    expect(w.transitions).toHaveLength(0);
    w.dataArrives("/", { currentLocation: {}, nextLocation: {} });
    expect(w.transitions).toHaveLength(0); // still none: the router makes it
    w.routerStartsTransition();
    expect(w.transitions).toHaveLength(1);
    await tick();
    // the commit inside the router's transition does not end the change; its finish does
    expect(isPageSettled()).toBe(false);
    expect(w.html.dataset.changeKind).toBe("radial");
    w.transitions[0].finish();
    await tick();
    expect(isPageSettled()).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.stop();
  });

  it("starts its own transition on a POP the router will not animate", async () => {
    const w = setup();
    w.pop("/");
    w.dataArrives("/"); // no viewTransitionOpts
    expect(w.transitions).toHaveLength(1);
    pageCommitted("/");
    await tick();
    w.transitions[0].finish();
    await tick();
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("ignores a state at another address", () => {
    const w = setup();
    w.pop("/work"); // same path as the committed page
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.pop("/");
    w.dataArrives("/work"); // a different address: not this navigation
    expect(w.transitions).toHaveLength(0);
    pageCommitted("/"); // a commit with no transition at all ends the change
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("waits while the router is still loading (a navigation pending)", () => {
    const w = setup();
    w.pop("/");
    w.dataArrives("/", { currentLocation: {} }, "loading");
    expect(w.transitions).toHaveLength(0);
    expect(w.html.dataset.changeKind).toBe("radial");
    w.dataArrives("/", undefined, "idle");
    expect(w.transitions).toHaveLength(1);
    w.transitions[0].finish();
    pageCommitted("/");
    w.stop();
  });

  it("ends the change when a second popstate lands back on the committed page before the data arrives", () => {
    const w = setup();
    w.pop("/"); // Back: opens the change
    expect(isPageSettled()).toBe(false);
    w.pop("/work"); // Forward again, before the router has the data for "/"
    expect(isPageSettled()).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.stop();
  });

  it("takes and skips a transition the router starts for a move inside one page", () => {
    const w = setup();
    const original = w.doc.startViewTransition;
    w.pop("/work"); // same page: a hash or a view
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.routerStartsTransition();
    expect(w.transitions).toHaveLength(1);
    expect(w.transitions[0].skipped).toBe(true);
    expect(w.doc.startViewTransition).toBe(original);
    expect(isPageSettled()).toBe(true);
    w.stop();
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
