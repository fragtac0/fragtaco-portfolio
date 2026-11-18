import { describe, expect, it } from "vitest";
import { TURN_WAIT_MS, runInTurns, type TurnHost } from "./turns";

/** A clock that each step advances, and a wait that runs the turn at once and counts how often it was asked to wait. */
function host(stepMs: number) {
  const h = { t: 0, waits: [] as number[], turns: 0 };
  const api: TurnHost = {
    now: () => h.t,
    wait: (run, within) => {
      h.waits.push(within);
      queueMicrotask(() => {
        h.turns++;
        run();
      });
    },
  };

  return { h, api, step: () => void (h.t += stepMs) };
}

describe("runInTurns", () => {
  it("runs every step, in order, and resolves after the last", async () => {
    const { api, step } = host(1);
    const order: number[] = [];

    await runInTurns(Array.from({ length: 10 }, (_, i) => () => (step(), order.push(i))), 3, api);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("takes steps until the budget has passed, then waits for an idle moment (the budget is the clock's, not a count)", async () => {
    const { h, api, step } = host(1); // each step is 1 ms: a 3 ms turn is 3 steps

    await runInTurns(Array.from({ length: 10 }, () => step), 3, api);
    expect(h.turns).toBe(4); // 3 + 3 + 3 + 1
    expect(h.waits).toHaveLength(4);
    expect(h.waits.every((w) => w === TURN_WAIT_MS)).toBe(true);
  });

  it("takes fewer steps a turn when the machine is slow (each step takes longer), and always at least one", async () => {
    const slow = host(10);

    await runInTurns(Array.from({ length: 5 }, () => slow.step), 3, slow.api);
    expect(slow.h.turns).toBe(5);
  });

  it("resolves at once for no steps, and rejects with a step's error without running the rest", async () => {
    const { api } = host(1);
    const ran: number[] = [];

    await runInTurns([], 3, api);
    await expect(
      runInTurns([() => ran.push(1), () => { throw new Error("boom"); }, () => ran.push(3)], 3, api),
    ).rejects.toThrow("boom");
    expect(ran).toEqual([1]);
  });
});
