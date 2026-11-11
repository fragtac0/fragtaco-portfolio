/**
 * Runs `cb` when the main thread is idle, and returns a function that cancels it.
 * With `timeoutMs` the callback is forced after that long even if the thread stays busy; without
 * it the callback only ever runs in a quiet moment. Where `requestIdleCallback` is missing
 * (Safari) a 120 ms timer stands in.
 */
export function whenIdle(cb: () => void, timeoutMs?: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle =
      timeoutMs === undefined
        ? window.requestIdleCallback(cb)
        : window.requestIdleCallback(cb, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(cb, 120);
  return () => window.clearTimeout(timer);
}

/** An idle slice with no timeout and nothing to cancel: it runs when the thread has nothing better to do. */
export function idleSlice(cb: () => void): void {
  whenIdle(cb);
}

/** How long a relaxed step may wait for a quiet moment before it runs anyway. */
const RELAXED_TIMEOUT_MS = 1200;
/** The most work an urgent run does in one animation frame (it stops once this much has passed). */
const URGENT_FRAME_BUDGET_MS = 8;

export type Slicer = {
  /** Runs the steps in order, never more than one per idle callback (relaxed) or ~8 ms per frame (urgent). Rejects with a step's error. */
  run(steps: Array<() => void>): Promise<void>;
  /** Relaxed (the default) waits for idle time; urgent runs steps back to back inside animation frames. */
  setUrgent(on: boolean): void;
};

/**
 * Spreads sequential work over time. Relaxed: one step per idle callback (forced after 1200 ms).
 * Urgent: steps run back to back inside `requestAnimationFrame` callbacks, each frame stopping once
 * 8 ms of work has been done (at least one step per frame, so it always progresses). Switching mode
 * moves a wait that is already pending to the new kind, and a frame that is running stops at the
 * next step boundary when urgency ends.
 */
export function createSlicer(): Slicer {
  let urgent = false;
  const rewaits = new Set<() => void>();

  return {
    run(steps) {
      return new Promise<void>((resolve, reject) => {
        let i = 0;
        let cancel: (() => void) | null = null;
        let inStep = false;

        /** Runs the next step; false when it threw (the run is rejected and over). */
        const step = (): boolean => {
          inStep = true;
          try {
            steps[i++]();
            return true;
          } catch (err) {
            rewaits.delete(wait);
            reject(err instanceof Error ? err : new Error(String(err)));
            return false;
          } finally {
            inStep = false;
          }
        };
        const onIdle = () => {
          cancel = null;
          if (step()) wait();
        };
        const onFrame = () => {
          cancel = null;
          const t0 = performance.now();
          do {
            if (!step()) return;
          } while (urgent && i < steps.length && performance.now() - t0 < URGENT_FRAME_BUDGET_MS);
          wait();
        };
        /** Schedules the next step the way the current mode asks for, or finishes. */
        const wait = () => {
          if (inStep) return; // a step switched the mode: its caller schedules the next one
          cancel?.();
          cancel = null;
          if (i >= steps.length) {
            rewaits.delete(wait);
            resolve();
          } else if (urgent) {
            const id = window.requestAnimationFrame(onFrame);
            cancel = () => window.cancelAnimationFrame(id);
          } else {
            cancel = whenIdle(onIdle, RELAXED_TIMEOUT_MS);
          }
        };

        rewaits.add(wait);
        wait();
      });
    },

    setUrgent(on) {
      if (urgent === on) return;
      urgent = on;
      for (const wait of [...rewaits]) wait();
    },
  };
}
