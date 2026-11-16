import { afterEach, describe, expect, it } from "vitest";
import { arrivalLate, endArrival, holdFor, raceAll, resetArrival, whenArrivalReady } from "./arrival";

const never = () => new Promise<void>(() => {});
const tick = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));

describe("raceAll", () => {
  it("resolves at once with nothing late when every item is ready before the cap", async () => {
    let capped = false;
    const sleep = () => new Promise<void>((r) => setTimeout(() => ((capped = true), r()), 50));
    const t0 = Date.now();
    const result = await raceAll(
      [
        { label: "painting", ready: Promise.resolve() },
        { label: "ground", ready: tick(5) },
      ],
      500,
      sleep,
    );
    expect(result).toEqual({ late: [] });
    expect(Date.now() - t0).toBeLessThan(40); // did not wait for the cap
    expect(capped).toBe(false);
  });

  it("resolves at the cap with the labels of what never settled", async () => {
    const result = await raceAll(
      [
        { label: "a", ready: Promise.resolve() },
        { label: "wall", ready: never() },
        { label: "ground", ready: never() },
      ],
      500,
      () => tick(10),
    );
    expect(result).toEqual({ late: ["wall", "ground"] });
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
  afterEach(() => endArrival());

  it("records nothing outside a change", () => {
    expect(holdFor("painting", never())).toBe(false);
    expect(arrivalLate()).toBe(false);
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
    const t0 = Date.now();
    expect(await whenArrivalReady(40)).toEqual({ late: ["stuck"] });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(35);
  });

  it("resolves as soon as everything is ready, not at the cap", async () => {
    resetArrival();
    holdFor("a", tick(5));
    const t0 = Date.now();
    expect(await whenArrivalReady(500)).toEqual({ late: [] });
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it("waits for things given while it waits, inside the same cap", async () => {
    resetArrival();
    holdFor("first", tick(5));
    const waiting = whenArrivalReady(500);
    await tick(1);
    holdFor("second", tick(20));
    const t0 = Date.now();
    expect(await waiting).toEqual({ late: [] });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(10);
  });

  it("an abort resolves it at once with nothing late, and holds nothing", async () => {
    resetArrival();
    holdFor("stuck", never());
    const ctl = new AbortController();
    const waiting = whenArrivalReady(500, ctl.signal);
    ctl.abort();
    expect(await waiting).toEqual({ late: [] });
    endArrival();
    expect(holdFor("later", never())).toBe(false);
  });

  it("marks the reveal as begun: a part that settles after it is late, and nothing more is recorded", async () => {
    resetArrival();
    expect(arrivalLate()).toBe(false);
    await whenArrivalReady(10);
    expect(arrivalLate()).toBe(true);
    expect(holdFor("too late to hold", never())).toBe(false);
    endArrival();
    expect(arrivalLate()).toBe(false);
  });
});
