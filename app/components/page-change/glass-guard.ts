/**
 * The bend's guard (R56, spec 4): if four frames in a row take longer than 25 ms during a change, the bend is switched off for the
 * rest of that change (glass-run.ts takes `data-glass` off <html> and the pushes to 0; the edge, wander, glow and shade carry on). A tab
 * where that happens in two changes runs the later ones without the bend (`ft-glass-bend` = `off` in sessionStorage; a reload of the tab
 * clears it). Pure: the caller gives it each frame's gap and the storage.
 */

export interface GlassGuard {
  /** One frame's gap in ms since the one before. `drop` from the frame that makes `strikes` slow ones in a row, and for every frame after. */
  frame(gapMs: number): "ok" | "drop";
  tripped(): boolean;
}

/** A frame is slow when it takes longer than `budgetMs` (25 by default); `strikes` slow frames in a row (4) trip the guard. */
export function createGuard(opts: { budgetMs?: number; strikes?: number } = {}): GlassGuard {
  const budget = opts.budgetMs ?? 25;
  const strikes = opts.strikes ?? 4;
  let run = 0;
  let dropped = false;
  return {
    frame(gapMs) {
      if (dropped) return "drop";
      run = gapMs > budget ? run + 1 : 0;
      if (run >= strikes) dropped = true;
      return dropped ? "drop" : "ok";
    },
    tripped: () => dropped,
  };
}

/** The sessionStorage key that holds `off` once the bend has been dropped in two changes of the tab. */
export const BEND_KEY = "ft-glass-bend";
/** How many changes that tripped the guard switch the bend off for the tab. */
export const TRIPS_FOR_OFF = 2;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The tab's rule about the bend. `trip()` is called when a change's guard dropped the bend; the second time (in this page load), and
 * `off()` from then on, says the bend stays off, and the same is kept in sessionStorage (`BEND_KEY`) so the tab's later pages know. Trips are
 * counted per page load, in memory: one trip, then a hard navigation (a new page load), then one more do not add up (the count starts again; the
 * spec's "two changes of a tab" is read as two in one load, as an SPA's changes are), and `off` already in the storage is kept across loads. With
 * `reloaded` (the page was reloaded) an earlier `off` is cleared: the spec switches it off until the tab is reloaded. Storage that
 * throws, or none, never breaks it: the rule then lives in memory.
 */
export function createSession(storage: Store | null, opts: { reloaded?: boolean } = {}) {
  let trips = 0;
  let memoryOff = false;
  try {
    if (opts.reloaded) storage?.removeItem(BEND_KEY);
  } catch {
    /* blocked */
  }
  return {
    off(): boolean {
      if (memoryOff) return true;
      try {
        return storage?.getItem(BEND_KEY) === "off";
      } catch {
        return false;
      }
    },
    trip(): void {
      trips++;
      if (trips < TRIPS_FOR_OFF) return;
      memoryOff = true;
      try {
        storage?.setItem(BEND_KEY, "off");
      } catch {
        /* blocked: memory only */
      }
    },
  };
}
