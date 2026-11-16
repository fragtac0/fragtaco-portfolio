// When My experience's entrance plays (round 7 second look, spec 8), as a pure reducer: the page is waiting for its time, playing (counted from
// `t0`, the start of the reveal, for a reveal `ms` long), or done (everything shown). Nothing here reads the clock or the page: use-entrance.ts
// feeds it events.
import { GLASS } from "../page-change/glass-math";
import type { Reveal } from "../../lib/change-state";

export type EntranceState =
  | { phase: "wait" }
  /** `t0` is `performance.now()` when the reveal began (or the picture was shown), `ms` the reveal's length, `lag` how late the page learnt of it. */
  | { phase: "play"; t0: number; ms: number; lag: number }
  | { phase: "done" };

export type EntranceEvent =
  /** The running change's reveal changed (a page that was made by a change). `now` is `performance.now()`. */
  | { type: "reveal"; reveal: Reveal; now: number }
  /** The picture is shown (loaded, or it failed), on a page that was not made by a change: the same entrance, counted from now. */
  | { type: "picture"; now: number; reduced: boolean }
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
      return state.phase === "wait" ? { phase: "play", t0: event.now, ms: quietLength(event.reduced), lag: 0 } : state;
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
