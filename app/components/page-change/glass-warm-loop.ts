/**
 * The warm-up's loop (R56, spec 4), without the page: `warmLoop` asks for one warm-up at a time until one has run for the vignette that is
 * in the filters when it ends. The pieces it needs from the page are given in `env` (glass-warm.ts), so the loop is a pure function that a test
 * can drive.
 */

/** The screen size a vignette was made for. A remake makes a NEW object, so the loop compares objects, not numbers. */
export interface WarmSize {
  w: number;
  h: number;
}

export interface WarmEnv {
  /** A pause between pieces of work, and for as long as a change runs. */
  calm(): Promise<void>;
  hidden(): boolean;
  /** Resolves when the tab shows again. */
  untilVisible(): Promise<void>;
  /** The vignette in the filters now (the size it was made for), or null. */
  vignette(): WarmSize | null;
  /** The screen's size now. */
  screen(): WarmSize;
  /** One warm-up for a vignette of this size: true when it ran all its frames and no change started during it. */
  warmOnce(size: WarmSize): Promise<boolean>;
  isWarm(): boolean;
  /** Called when a warm-up has run for the vignette that is in the filters now. */
  markWarm(): void;
}

/**
 * Runs warm-ups until one is done for the vignette that is in the filters when it ends. A screen that is resized during a warm-up gets a
 * new vignette (glass-prepare.ts `refreshVignette`, which also puts `ready.warm` back to false) while the warm-up of the old size is still
 * running; when that one ends it has warmed the wrong size, so it is not counted and the loop goes round again for the new one. A screen
 * that was resized and has no new vignette yet ends the loop (the remake calls `warmGlass` when it is made). Returns whether it marked.
 */
export async function warmLoop(env: WarmEnv, attempts = 20): Promise<boolean> {
  for (let attempt = 0; attempt < attempts && !env.isWarm(); attempt++) {
    await env.calm();
    if (env.hidden()) {
      await env.untilVisible();
      continue;
    }
    const size = env.vignette();
    const screen = env.screen();
    if (!size || size.w !== screen.w || size.h !== screen.h) return false; // resized meanwhile: the remake warms
    if (!(await env.warmOnce(size))) continue;
    if (env.vignette() !== size) continue; // the vignette was made again while it ran: that size is not warm
    env.markWarm();
    return true;
  }
  return false;
}
