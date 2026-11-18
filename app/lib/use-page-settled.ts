import { useEffect, useState, useSyncExternalStore } from "react";
import { isPageSettled, subscribeSettled } from "./page-change";

/**
 * False from the start of a page change until it is over (finished, skipped, interrupted or failed),
 * true otherwise. On a first load nothing is changing, so it is true from the start, in the server's
 * HTML and while hydrating (the server never runs the work it gates).
 */
export function usePageSettled(): boolean {
  return useSyncExternalStore(subscribeSettled, isPageSettled, () => true);
}

/**
 * For the page that is arriving: false if it mounted during a page change, true from the moment that
 * change is over, and then true for good. Heavy arrival work (starting WebGL, decoding pictures,
 * starting motion) waits for it. Unlike `usePageSettled` it does not go false again when the next
 * change begins, so the page that is about to be replaced keeps what it has for the old picture, and
 * it costs no re-render on later changes. `afterFrames` holds it that many animation frames longer, to
 * spread several heavy steps over different frames.
 */
export function usePageArrived(afterFrames = 0): boolean {
  const [arrived, setArrived] = useState(isPageSettled);
  useEffect(() => {
    if (arrived) return;
    let frame = 0;
    const arrive = () => {
      // heavy steps ask to wait a few frames more, so no two of them share one task
      let left = afterFrames;
      const tick = () => (left-- > 0 ? (frame = requestAnimationFrame(tick)) : setArrived(true));
      tick();
    };
    const check = () => {
      if (isPageSettled()) {
        off();
        arrive();
      }
    };
    const off = subscribeSettled(check);
    check(); // the change may have ended between the render and this effect
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, [arrived, afterFrames]);
  return arrived;
}
