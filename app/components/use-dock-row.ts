import { useEffect, useState } from "react";
import { usePageSettled } from "../lib/use-page-settled";

/**
 * Whether the dock's second row is open. It mounts closed and opens once the page change is over
 * (the CSS adds the 140 ms wait and runs the 260 ms opening). It closes the moment a change starts,
 * so the old picture of the dock is the one-row dock and the row is in neither picture. On a first
 * load, or a change with no transition, it opens one frame after mounting, so it still arrives by
 * the same opening.
 */
export function useDockRowOpen(): boolean {
  const settled = usePageSettled();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // one frame closed first, so the opening has a closed state to start from
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return settled && mounted;
}
