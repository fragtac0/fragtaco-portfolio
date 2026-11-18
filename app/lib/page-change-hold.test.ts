import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdFor } from "./arrival";
import { afterSettled, changePage, finishChange, isChangeShowing, isPageSettled } from "./page-change";
import { fakeEnvironment, sleep, tick } from "./page-change-fake";

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

describe("the hold (the arriving page is finished before the reveal)", () => {
  const never = () => new Promise<void>(() => {});
  // fake timers (the cap is a timer): a test moves the clock by hand, so no assertion depends on how loaded the machine is
  const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("holds the reveal from the moment the pictures are up, and lets it go as soon as the page is ready", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    let ready = () => {};
    const hold = holdFor("rings", new Promise<void>((resolve) => (ready = resolve)));
    expect(env.html.dataset.changeHold).toBeUndefined(); // the old page is live while the data loads: nothing to hold yet
    r.dataArrives();
    expect(env.html.dataset.changeHold).toBe("");
    await adv(60);
    expect(env.html.dataset.changeHold).toBe(""); // not ready, not at the cap: the reveal has not started
    ready();
    await adv(0);
    expect(env.html.dataset.changeHold).toBeUndefined();
    expect(env.html.dataset.arrivalLate).toBeUndefined();
    expect(hold?.late).toBe(false); // it was ready when the reveal began: not late
    env.transitions[0].finish();
    await done;
  });

  it("starts the reveal at the cap with what is missing, which is named for the pages to fade in", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    const painting = holdFor("painting", never());
    holdFor("ground", Promise.resolve());
    r.dataArrives();
    await adv(499);
    expect(env.html.dataset.changeHold).toBe("");
    expect(painting?.late).toBe(false);
    await adv(1); // 500 ms after the pictures are up
    expect(env.html.dataset.changeHold).toBeUndefined();
    expect(env.html.dataset.arrivalLate).toBe("painting");
    expect(painting?.late).toBe(true); // and it stays late after the change is over: the page fades it in whenever it comes
    env.transitions[0].finish();
    await done;
    expect(env.html.dataset.arrivalLate).toBeUndefined();
    expect(painting?.late).toBe(true);
  });

  it("does not hold a change whose page gives nothing to wait for", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    r.dataArrives();
    await adv(0);
    expect(env.html.dataset.changeHold).toBeUndefined();
    env.transitions[0].finish();
    await done;
  });

  it("a press (finishChange) during the hold ends the change at once and leaves nothing held", async () => {
    const env = fakeEnvironment();
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    const wall = holdFor("wall", never());
    r.dataArrives();
    await adv(0);
    expect(env.html.dataset.changeHold).toBe("");
    expect(isChangeShowing()).toBe(true);
    finishChange();
    await done;
    expect(env.transitions[0].skipped).toBe(true);
    expect(env.html.dataset.changeHold).toBeUndefined();
    expect(env.html.dataset.changeKind).toBeUndefined();
    expect(isPageSettled()).toBe(true);
    await adv(0); // the aborted wait marks what it left pending
    expect(wall?.late).toBe(true); // the reveal went ahead without it: when it comes it fades
    expect(holdFor("anything", never())).toBeNull(); // nothing is recording, nothing can be held
    await adv(560); // the cap passes with no effect on the next change
    expect(env.html.dataset.arrivalLate).toBeUndefined();
  });

  it("a newer change takes over the hold: the first one's cap does not mark the second", async () => {
    const env = fakeEnvironment();
    const r1 = env.router("/work");
    const first = changePage(r1.navigate, "/work");
    holdFor("old page", never());
    r1.dataArrives();
    await adv(0);
    const r2 = env.router("/work/long-form");
    const second = changePage(r2.navigate, "/work/long-form");
    await first;
    expect(env.html.dataset.changeHold).toBeUndefined();
    const fresh = holdFor("new page", never()); // the first one's wait was aborted: it did not mark the second one's reveal as begun, so this is recorded
    expect(fresh).not.toBeNull();
    r2.dataArrives();
    await adv(100);
    expect(env.html.dataset.changeHold).toBe("");
    expect(fresh?.late).toBe(false);
    env.transitions[1].finish();
    await second;
  });

  it("the reduced-motion fade waits at most 300 ms", async () => {
    const env = fakeEnvironment();
    vi.stubGlobal("window", { ...(globalThis as { window: object }).window, matchMedia: () => ({ matches: true }) });
    const r = env.router("/work");
    const done = changePage(r.navigate, "/work");
    expect(env.html.dataset.changeKind).toBe("fade");
    holdFor("rings", never());
    r.dataArrives();
    await adv(299);
    expect(env.html.dataset.changeHold).toBe("");
    await adv(1);
    expect(env.html.dataset.changeHold).toBeUndefined();
    env.transitions[0].finish();
    await done;
  });
});
