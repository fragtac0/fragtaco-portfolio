/**
 * Watches a canvas for `webglcontextlost`. The shelf and the wall both draw with a context that
 * the browser may take away (a GPU reset, too many contexts); the scene then switches to its plain
 * grid, so the person is never left with a frozen or blank stage. Once lost the watch stays lost:
 * the engine reports `hasFailed()` and the scene does not try to draw again.
 */
export type ContextWatch = {
  /** True once the context has been lost. */
  lost: () => boolean;
  /** Calls `cb` when the context is lost (once); returns the function that stops listening. */
  subscribe: (cb: () => void) => () => void;
};

export function watchContextLost(target: EventTarget): ContextWatch {
  let isLost = false;
  const subs = new Set<() => void>();
  target.addEventListener("webglcontextlost", () => {
    isLost = true;
    const calls = [...subs];
    subs.clear();
    for (const cb of calls) cb();
  });
  return {
    lost: () => isLost,
    subscribe: (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
