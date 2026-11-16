import { whenIdle } from "./idle";

/** How long one turn takes steps before it gives the thread back, in milliseconds (the time is the wall's, so a slow or throttled machine takes fewer steps a turn). */
export const TURN_MS = 3;
/** The longest a turn waits for an idle moment before it runs anyway, in milliseconds. */
export const TURN_WAIT_MS = 200;

/** The clock and the wait a run is handed (the page's are `performance.now` and the idle callback; a test turns them by hand). */
export type TurnHost = { now(): number; wait(run: () => void, within: number): void };

const REAL: TurnHost = { now: () => performance.now(), wait: (run, within) => void whenIdle(run, within) };

/**
 * Runs the small `steps` in order, in turns: a turn takes steps until `budgetMs` has passed (at least one, so it always goes on), then waits for the
 * next idle moment (at most `TURN_WAIT_MS`). So work that is tens of milliseconds all told never holds a frame for more than a step and the budget.
 * Resolves when the last step has run; rejects with the error of a step that threw (the rest do not run).
 */
export function runInTurns(steps: ReadonlyArray<() => void>, budgetMs = TURN_MS, host: TurnHost = REAL): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let i = 0;
    const turn = () => {
      const start = host.now();

      try {
        do steps[i++]();
        while (i < steps.length && host.now() - start < budgetMs);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));

        return;
      }
      if (i < steps.length) host.wait(turn, TURN_WAIT_MS);
      else resolve();
    };

    if (steps.length === 0) resolve();
    else host.wait(turn, TURN_WAIT_MS);
  });
}
