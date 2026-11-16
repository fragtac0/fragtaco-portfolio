import type { NavigateFunction } from "@remix-run/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endChange, finishChange, isChangeRunning, isChangeShowing, isPageSettled, isRadialChange, pageCommitted, planChange, subscribeSettled, changePage } from "./page-change";
import { fakeEnvironment, tick } from "./page-change-fake";

const screen = { vw: 1440, vh: 900 };
const scr = { supported: true, reduced: false, ...screen };
const PAGES = ["/", "/work", "/work/long-form", "/work/short-form", "/experience"];

describe("planChange", () => {
  it("gives none without View Transitions support", () => {
    const plan = planChange("/", "/work", { ...scr, supported: false });
    expect(plan.kind).toBe("none");
    expect(plan.ms).toBe(0);
  });

  it("is the same radial 2250 ms reveal from the centre for every pair of pages, the two walls included", () => {
    for (const from of PAGES) {
      for (const to of PAGES) {
        expect(planChange(from, to, scr)).toEqual({
          kind: "radial",
          ms: 2250,
          origin: { x: 720, y: 450 },
          radius: Math.hypot(720, 450),
          vw: 1440,
          vh: 900,
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
    expect(Object.keys(planChange("/work/long-form", "/work/short-form", scr)).sort()).toEqual(["kind", "ms", "origin", "radius", "vh", "vw"]);
  });
});

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
    expect(isRadialChange()).toBe(true);
    // the centre of the screen, whatever was clicked
    expect(env.props.get("--change-x")).toBe("720px");
    expect(env.props.get("--change-y")).toBe("450px");
    expect(env.props.get("--change-ms")).toBe("2250ms");
    expect(env.props.has("--change-w")).toBe(false);
    // the glass numbers glass.css reads, from glass-math.ts
    expect(env.props.get("--change-band")).toBe("0.15");
    expect(env.props.get("--change-ease")).toBe("cubic-bezier(0.65, 0, 0.35, 1)");
    expect(isPageSettled()).toBe(false);
    r.dataArrives();
    await tick();
    env.transitions[0].finish();
    await done;
    off();
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(isRadialChange()).toBe(false);
    expect(env.props.size).toBe(0);
    expect(isPageSettled()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it("is not a radial change under reduced motion (the 120 ms fade), and not when nothing is changing", async () => {
    const env = fakeEnvironment();
    vi.stubGlobal("window", { ...(globalThis as { window: object }).window, matchMedia: () => ({ matches: true }) });
    expect(isRadialChange()).toBe(false);
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    expect(env.html.dataset.changeKind).toBe("fade");
    expect(isRadialChange()).toBe(false);
    r.dataArrives();
    await tick();
    env.transitions[0].finish();
    await done;
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

  it("finishes once, structurally: after the first call the change no longer counts as showing, so a second press cannot finish it again", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    r.dataArrives();
    await tick();
    expect(isChangeShowing()).toBe(true);
    finishChange();
    // the transition has been skipped but has not reported `finished` yet: the window a second press could land in
    expect(isChangeShowing()).toBe(false);
    env.transitions[0].skipped = false;
    finishChange();
    expect(env.transitions[0].skipped).toBe(false); // not skipped a second time
    await done;
  });
});

describe("endChange", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing, and says so, when no change is running", () => {
    fakeEnvironment();
    expect(isChangeRunning()).toBe(false);
    expect(endChange()).toBe(false);
  });

  it("ends a change that is still loading its data: marks off, settled", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    expect(isChangeRunning()).toBe(true);
    expect(endChange()).toBe(true);
    await done;
    expect(isChangeRunning()).toBe(false);
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(env.props.size).toBe(0);
  });

  it("ends a change that is showing its pictures: the transition is skipped, marks off, settled", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    r.dataArrives();
    await tick();
    expect(endChange()).toBe(true);
    expect(env.transitions[0].skipped).toBe(true);
    await done;
    expect(isPageSettled()).toBe(true);
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(env.props.size).toBe(0);
  });
});
