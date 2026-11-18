import { describe, expect, it } from "vitest";
import { createNearGate } from "./use-near";

/** A scheduler that holds callbacks until the test runs them. */
function manualSchedule() {
  const queue: Array<{ run: () => void; cancelled: boolean }> = [];
  const schedule = (run: () => void) => {
    const job = { run, cancelled: false };
    queue.push(job);
    return () => {
      job.cancelled = true;
    };
  };
  const flush = () => {
    for (const job of queue.splice(0)) if (!job.cancelled) job.run();
  };
  return { schedule, flush, size: () => queue.length };
}

describe("createNearGate", () => {
  it("fires once per kind, however many times it is hit before the callback runs", () => {
    const { schedule, flush, size } = manualSchedule();
    const fired: string[] = [];
    const gate = createNearGate(schedule, (kind) => fired.push(kind));
    gate.hit("reading");
    gate.hit("reading");
    gate.hit("reading");
    expect(size()).toBe(1);
    flush();
    expect(fired).toEqual(["reading"]);
  });

  it("does not fire a kind again after it has fired", () => {
    const { schedule, flush } = manualSchedule();
    const fired: string[] = [];
    const gate = createNearGate(schedule, (kind) => fired.push(kind));
    gate.hit("watching");
    flush();
    gate.hit("watching");
    flush();
    expect(fired).toEqual(["watching"]);
  });

  it("keeps the kinds apart", () => {
    const { schedule, flush } = manualSchedule();
    const fired: string[] = [];
    const gate = createNearGate(schedule, (kind) => fired.push(kind));
    gate.hit("reading");
    gate.hit("watching");
    flush();
    expect(fired).toEqual(["reading", "watching"]);
  });

  it("fires nothing after cancel", () => {
    const { schedule, flush } = manualSchedule();
    const fired: string[] = [];
    const gate = createNearGate(schedule, (kind) => fired.push(kind));
    gate.hit("reading");
    gate.cancel();
    flush();
    expect(fired).toEqual([]);
  });
});
