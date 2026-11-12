import { useEffect, useState, type ReactNode } from "react";

interface StagedProps {
  /** False while the page change that brought the page is running. */
  arrived: boolean;
  /** Which turn this is: it mounts this many steps after the page has arrived. */
  order: number;
  /** The wait between one turn and the next, in ms. */
  step?: number;
  children: ReactNode;
}

/**
 * Mounts its children after the page has arrived, one turn at a time, so the first commit of a page
 * that comes in through a page change stays small and the rest does not land in one task. On a first
 * load (the page arrived from the start) it renders everything at once, which keeps the server's HTML
 * and the hydration the same. The children are elements already made by the parent; nothing of them
 * renders until their turn.
 */
export default function Staged({ arrived, order, step = 40, children }: StagedProps) {
  const [on, setOn] = useState(arrived);
  useEffect(() => {
    if (on || !arrived) return;
    const timer = window.setTimeout(() => setOn(true), order * step);
    return () => window.clearTimeout(timer);
  }, [on, arrived, order, step]);
  return on ? <>{children}</> : null;
}
