import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { usePageSettled } from "../lib/use-page-settled";

// A layout effect where there is a DOM (React warns about it on the server)
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface DockRow {
  /** Whether the second row is open: true when no page change is running. */
  open: boolean;
  glassRef: RefObject<HTMLDivElement>;
  rowRef: RefObject<HTMLDivElement>;
  navRef: RefObject<HTMLElement>;
}

/**
 * The dock's second row. It is open whenever no page change is running (`usePageSettled`):
 * - A page that mounts during a change mounts closed and opens when the change is over (the CSS adds
 *   the 140 ms wait and runs the 260 ms opening).
 * - A hard load or deep link has no change before it, so it mounts open and nothing animates.
 * - When a change starts it closes at once, so the old picture has the one-row dock and the row is in
 *   neither picture. Focus inside the row moves to the dock's current tab first, or the closing would
 *   drop it to the page.
 * - The glass's closed and open widths are measured on mount and on resize and handed to the CSS
 *   (`--dock-w-closed`, `--dock-w-open`), so the glass grows in width with the row's height, on one
 *   curve, instead of snapping when the row's width starts to count.
 */
export function useDockRow(enabled: boolean): DockRow {
  const open = usePageSettled();
  const glassRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(open);

  useIsoLayoutEffect(() => {
    if (wasOpen.current && !open && rowRef.current?.contains(document.activeElement)) {
      const tabs = navRef.current;
      tabs?.querySelector<HTMLElement>("[aria-current]")?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!enabled) return;
    const measure = () => {
      const glass = glassRef.current;
      const row = rowRef.current;
      if (!glass || !row) return;
      // Natural widths with the row counting (open) and not counting (closed). Nothing paints in between.
      glass.style.width = "auto";
      row.style.contain = "none";
      const wide = glass.getBoundingClientRect().width;
      row.style.contain = "inline-size";
      const narrow = glass.getBoundingClientRect().width;
      row.style.contain = "";
      glass.style.width = "";
      glass.style.setProperty("--dock-w-open", `${wide}px`);
      glass.style.setProperty("--dock-w-closed", `${narrow}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [enabled]);

  return { open, glassRef, rowRef, navRef };
}
