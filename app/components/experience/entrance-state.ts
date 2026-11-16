// When My experience's entrance plays (round 7 second look, spec 8), as a pure reducer: the page is waiting for its time, playing (counted from
// `t0`, the start of the reveal, for a reveal `ms` long), or done (everything shown). Nothing here reads the clock or the page: use-entrance.ts
// feeds it events.
import { GLASS } from "../page-change/glass-math";
import type { Reveal } from "../../lib/change-state";
import { entranceEnd } from "./entrance";

export type EntranceState =
  | { phase: "wait" }
  /** `t0` is `performance.now()` when the reveal began (or the picture was shown), `ms` the reveal's length, `lag` how late the page learnt of it. */
  | { phase: "play"; t0: number; ms: number; lag: number }
  | { phase: "done" };

export type EntranceEvent =
  /** The running change's reveal changed (a page that was made by a change). `now` is `performance.now()`. */
  | { type: "reveal"; reveal: Reveal; now: number }
  /**
   * The picture is shown (loaded, or it failed), on a page that was not made by a change: the same entrance, counted from `at` (when the picture came,
   * `performance.now()`; `now` when it is not known), so a script that was slow to wake does not push the words back by its wait.
   */
  | { type: "picture"; now: number; at?: number; reduced: boolean }
  /** A pointer press or a key press on the page. */
  | { type: "press" }
  /** The entrance has run its length. */
  | { type: "end" };

export const WAITING: EntranceState = { phase: "wait" };

/** The reveal's length when no change ran: the radial reveal's (`GLASS.ms`), or none under reduced motion (everything fades in at once). */
export const quietLength = (reduced: boolean): number => (reduced ? 0 : GLASS.ms);

export function nextEntrance(state: EntranceState, event: EntranceEvent): EntranceState {
  if (state.phase === "done") return state;

  switch (event.type) {
    case "press":
    case "end":
      return event.type === "end" && state.phase === "wait" ? state : { phase: "done" };
    case "picture":
      return state.phase === "wait" ? { phase: "play", t0: Math.min(event.at ?? event.now, event.now), ms: quietLength(event.reduced), lag: Math.max(0, event.now - (event.at ?? event.now)) } : state;
    case "reveal": {
      const { reveal, now } = event;

      // a change cut short (a press, Back, a newer link) or one that never revealed: the page shows itself at once
      if (reveal.phase === "over" && reveal.skipped) return { phase: "done" };
      if (state.phase === "play") return state;
      if ((reveal.phase === "run" || reveal.phase === "over") && reveal.at !== null) return { phase: "play", t0: reveal.at, ms: reveal.ms, lag: Math.max(0, now - reveal.at) };

      return state;
    }
  }
}

/** The page's own clock for "done" is a failsafe where the map draws the trace: it waits this long past the entrance's nominal end, since the map says when it is over (a trace that began late must not be cut short). */
export const ENGINE_GRACE_MS = 3000;
/** Where there is no map (it draws no trace), the page calls the entrance over this long after its nominal end, so the last words' frames are not cut. */
export const END_SLACK_MS = 150;

/** How long from `now` (the page's clock, `performance.now()`) until the page calls a playing entrance over by itself: `engine` is whether a map is there to say it ended first. */
export function endDelay(play: { t0: number; ms: number }, now: number, engine: boolean): number {
  return Math.max(0, play.t0 + entranceEnd(play.ms) + (engine ? ENGINE_GRACE_MS : END_SLACK_MS) - now);
}

/** A picture that came longer ago than this is not "just shown": a page made by a client navigation with no change (the picture came with a visit minutes ago) counts from now. */
export const PICTURE_MAX_AGE_MS = 5000;

/**
 * When a picture that is already complete when the page wakes was shown, on the page's clock: when its resource finished arriving (the browser's timing
 * entries for its address, the last one), never later than `now`; `now` when there is no entry (a cache that keeps none, a browser without the timeline)
 * or the entry is older than `PICTURE_MAX_AGE_MS`.
 */
export function shownAtOf(entries: ReadonlyArray<{ responseEnd: number }>, now: number): number {
  const end = entries.length > 0 ? entries[entries.length - 1].responseEnd : 0;

  return end > 0 && now - end <= PICTURE_MAX_AGE_MS ? Math.min(end, now) : now;
}
