/**
 * The numbers of the Eclipse ground (spec 5.1): the settings Aditya chose in preview 7, which page gets which
 * placement, how the clock runs and when the loop may run. Pure, so it is tested (eclipse-look.test.ts) and the
 * component does not pull the WebGL module in to read it.
 */

/** movement 2.2 (the preview's "Slow"), noise 1 ("Subtle"), grain 0.1 ("Barely"). */
export const ECLIPSE = { move: 2.2, noise: 1, grain: 0.1 } as const;

/**
 * 0 light on the right, shoulder from the lower left (portfolio). 1 the same, mirrored (long form). 2 light from
 * below behind a dark disc (the home section behind the two shelf blocks). 3 light from the upper right (short form).
 */
export type Placement = 0 | 1 | 2 | 3;

/** Placements of the work pages, which share one layer in the layout and so share one set of stills. */
export const WORK_PLACEMENTS: readonly Placement[] = [0, 1, 3];

/**
 * The placement for an address, or null where there is no Eclipse: `/experience` (the map is its ground) and
 * anything else. `/` is the home page, whose ground sits behind the two shelf blocks only.
 */
export function placementFor(pathname: string): Placement | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  switch (path) {
    case "/work":
      return 0;
    case "/work/long-form":
      return 1;
    case "/work/short-form":
      return 3;
    case "/":
      return 2;
    default:
      return null;
  }
}

/** About 30 frames a second is enough (the preview drew when more than 30 ms had gone by). */
export const FRAME_MS = 30;

/** The clock never jumps by more than this many seconds in one step (a pause, a slow frame), as in the preview. */
export const MAX_STEP_S = 0.1;

/** Where the clock starts, and so what the stills show: the preview began at 0. */
export const START_CLOCK = 0;

/** The clock after `dtMs` more of real time: it runs at `ECLIPSE.move` times real time, a step capped at MAX_STEP_S. */
export function advanceClock(clock: number, dtMs: number): number {
  return clock + Math.min(MAX_STEP_S, Math.max(0, dtMs) / 1000) * ECLIPSE.move;
}

/** Whether enough time has gone by for a new frame. */
export function frameDue(nowMs: number, lastMs: number): boolean {
  return nowMs - lastMs >= FRAME_MS;
}

/**
 * The canvas is one pixel per CSS pixel (a speck of grain is then two or three screen pixels on a sharp display):
 * the CSS size, rounded, never under 1.
 */
export function canvasSize(cssWidth: number, cssHeight: number): [number, number] {
  return [Math.max(1, Math.round(cssWidth)), Math.max(1, Math.round(cssHeight))];
}

/** The still picture of a placement for a landscape or a portrait screen (made by scripts/audit/make-eclipse-stills.mjs). */
export function stillUrl(placement: Placement, portrait: boolean): string {
  return `/grounds/eclipse-${placement}${portrait ? "-tall" : ""}.webp`;
}

/** What decides whether the loop runs. */
export interface RunGate {
  /** The tab is showing. */
  tab: boolean;
  /** The ground is on the screen (always, for the fixed one; the section's own for the home page). */
  inView: boolean;
  /** An open layer covers it. */
  covered: boolean;
  /** No page change is running (the pictures of a change are fixed). */
  settled: boolean;
}

/** The loop runs only when nothing hides the ground and no page change runs. */
export function runWanted(gate: RunGate): boolean {
  return gate.tab && gate.inView && !gate.covered && gate.settled;
}

/** The ground may start at all: not under reduced motion or save-data, and only where WebGL can be made. */
export function engineAllowed(env: { reduced: boolean; saveData: boolean; webgl: boolean }): boolean {
  return !env.reduced && !env.saveData && env.webgl;
}
