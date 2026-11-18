import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  let frame = 0;
  const onResize = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(onChange);
  };
  window.addEventListener("resize", onResize);
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
  };
}

// A string, so React sees an unchanged size as the same snapshot.
const read = () => `${window.innerWidth}x${window.innerHeight}`;
const readOnServer = () => null;

/**
 * The window's size, or null on the server and during hydration. The rings need it, so they appear
 * once the page is live (which is also when their enter animation should run). It changes only on
 * resize, never per frame.
 */
export function useStageSize(): { vw: number; vh: number } | null {
  const size = useSyncExternalStore(subscribe, read, readOnServer);
  if (size === null) return null;
  const [vw, vh] = size.split("x").map(Number);
  return { vw, vh };
}
