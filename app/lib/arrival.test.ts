import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endArrival, holdFor, raceAll, resetArrival, whenArrivalReady } from "./arrival";

const never = () => new Promise<void>(() => {});
/** A promise and the way to settle it, so a test decides when (no timer, no real wait). */
function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("raceAll", () => {
  it("resolves at once with nothing late when every item is ready before the cap (it never waits on the cap)", async () => {
    const cap = deferred(); // the cap is a sleep that is never allowed to end: the result can only come from the items
    const slow = deferred();
    const result = raceAll(
      [
        { label: "painting", ready: Promise.resolve() },
        { label: "ground", ready: slow.promise },
      ],
      500,
      () => cap.promise,
    );
    slow.resolve();
    expect(await result).toEqual({ late: [] });
  });

  it("resolves at the cap with the labels of what never settled", async () => {
    const cap = deferred();
    const result = raceAll(
      [
        { label: "a", ready: Promise.resolve() },
        { label: "wall", ready: never() },
        { label: "ground", ready: never() },
      ],
      500,
      () => cap.promise,
    );
    cap.resolve();
    expect(await result).toEqual({ late: ["wall", "ground"] });
  });

  it("passes the cap to the sleep it is given", async () => {
    const seen: number[] = [];
    await raceAll([{ label: "x", ready: never() }], 500, (ms) => (seen.push(ms), Promise.resolve()));
    expect(seen).toEqual([500]);
  });

  it("counts a rejected promise as settled", async () => {
    const result = await raceAll([{ label: "picture", ready: Promise.reject(new Error("blocked")) }], 500, never);
    expect(result).toEqual({ late: [] });
  });

  it("is done at once for no items", async () => {
    expect(await raceAll([], 500, never)).toEqual({ late: [] });
  });
});

describe("the registry", () => {
  // fake timers: the cap is a timer, and a test moves the clock by hand (no real waits, no margins to flake on)
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    endArrival();
    vi.useRealTimers();
  });
  const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it("records nothing outside a change", () => {
    expect(holdFor("painting", never())).toBeNull();
  });

  it("resetArrival drops the old list: only what is given after it is waited for", async () => {
    resetArrival();
    holdFor("old", never());
    resetArrival();
    holdFor("new", Promise.resolve());
    expect(await whenArrivalReady(50)).toEqual({ late: [] });
  });

  it("waits for what was given, and reports what is still pending at the cap", async () => {
    resetArrival();
    holdFor("done", Promise.resolve());
    holdFor("stuck", never());
    let result: { late: string[] } | null = null;
    void whenArrivalReady(40).then((r) => (result = r));
    await adv(39);
    expect(result).toBeNull();
    await adv(1);
    expect(result).toEqual({ late: ["stuck"] });
  });

  it("resolves as soon as everything is ready, not at the cap", async () => {
    resetArrival();
    const a = deferred();
    holdFor("a", a.promise);
    let result: { late: string[] } | null = null;
    void whenArrivalReady(500).then((r) => (result = r));
    await adv(10);
    expect(result).toBeNull();
    a.resolve();
    await adv(0);
    expect(result).toEqual({ late: [] }); // at 10 ms, with 490 ms of the cap to spare
  });

  it("waits for things given while it waits, inside the same cap", async () => {
    resetArrival();
    const first = deferred();
    const second = deferred();
    holdFor("first", first.promise);
    let result: { late: string[] } | null = null;
    void whenArrivalReady(500).then((r) => (result = r));
    await adv(1);
    holdFor("second", second.promise);
    first.resolve();
    await adv(20);
    expect(result).toBeNull(); // the second is not ready: it is waited for
    second.resolve();
    await adv(0);
    expect(result).toEqual({ late: [] });
  });

  it("an abort resolves it at once with nothing reported late, and holds nothing", async () => {
    resetArrival();
    holdFor("stuck", never());
    const ctl = new AbortController();
    const waiting = whenArrivalReady(500, ctl.signal);
    ctl.abort();
    expect(await waiting).toEqual({ late: [] });
    endArrival();
    expect(holdFor("later", never())).toBeNull();
  });

  it("marks the reveal as begun: nothing more is recorded after it", async () => {
    resetArrival();
    expect(holdFor("before", Promise.resolve())).not.toBeNull();
    await whenArrivalReady(10);
    expect(holdFor("too late to hold", never())).toBeNull();
    endArrival();
    expect(holdFor("after the end", never())).toBeNull();
  });
});

describe("a hold knows whether it missed the reveal, per part, however long after", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    endArrival();
    vi.useRealTimers();
  });
  const adv = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it("is not late when it settles before the reveal", async () => {
    resetArrival();
    const hold = holdFor("a", Promise.resolve());
    await whenArrivalReady(500);
    expect(hold?.late).toBe(false);
  });

  it("is late when it is still pending as the reveal begins at the cap, and stays late when the part comes after the change is over", async () => {
    resetArrival();
    const part = deferred();
    const hold = holdFor("map", part.promise);
    const waited = whenArrivalReady(500);
    await adv(500);
    expect(await waited).toEqual({ late: ["map"] });
    expect(hold?.late).toBe(true);
    endArrival(); // the change is over (2.5 s on) and the picture has still not come
    await adv(2500);
    expect(hold?.late).toBe(true); // endArrival does not clear it
    let fades = 0;
    void part.promise.then(() => hold?.late && fades++); // what a page does when its part comes
    part.resolve();
    await adv(0);
    expect(fades).toBe(1);
  });

  it("decides each hold on its own: one that came in time is not late, one that did not is", async () => {
    resetArrival();
    const quick = deferred();
    const slow = deferred();
    const a = holdFor("quick", quick.promise);
    const b = holdFor("slow", slow.promise);
    const waited = whenArrivalReady(500);
    quick.resolve();
    await adv(500);
    await waited;
    expect([a?.late, b?.late]).toEqual([false, true]);
  });

  it("a press that ends the wait marks what was pending as late (the reveal went ahead without it)", async () => {
    resetArrival();
    const hold = holdFor("wall", never());
    const ctl = new AbortController();
    const waiting = whenArrivalReady(500, ctl.signal);
    ctl.abort();
    await waiting;
    expect(hold?.late).toBe(true);
  });

  it("the next change does not inherit the last one's lateness or its list", async () => {
    resetArrival();
    const old = holdFor("old", never());
    await adv(0);
    resetArrival(); // a newer change
    const fresh = holdFor("fresh", Promise.resolve());
    expect(await whenArrivalReady(500)).toEqual({ late: [] });
    expect(fresh?.late).toBe(false);
    expect(old?.late).toBe(false); // the first change's wait never ran: it was replaced, and its hold was not marked by the second
  });
});
