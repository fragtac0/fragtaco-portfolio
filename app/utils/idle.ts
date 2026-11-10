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
