// The map's side of the entrance (round 7 second look, spec 8): which share of the trail and of the way ahead is drawn at a
// moment, which milestone beads are in, and when the radar begins. The page tells it when the reveal ends (`start`), or that the
// visitor pressed something (`finish`); the engine asks it for the numbers of each frame (`step`). The beads are the page's buttons:
// it only puts attributes on them (`data-wait` hides one, `data-enter` gives its fade and growth their 260 ms, `data-instant` shows
// one with no transition at all), and the stylesheet does the rest. The clock is the engine's host's, the same as `performance.now`
// that use-entrance.ts counts from.
import { ENTRANCE, TRACE_END_MS, aheadShare, beadDelay, traceShare } from "./entrance";
import { clamp } from "./map-math";

/** The bits of a bead's button the driver writes. */
export type BeadEl = { setAttribute(name: string, value: string): void; removeAttribute(name: string): void };

/** What to draw at a moment: the share of the first trail and of the way ahead, their strength, and when the radar began (null: not yet). */
export type EntranceView = { share: number; ahead: number; alpha: number; radar: number | null };

export type Entrance = {
  /** The reveal ends at host time `at`: the trace begins then, or at the first frame after it. Ignored once the entrance is over or running. */
  start(at: number): void;
  /** Show everything now (a press, or a visitor who is already past it). */
  finish(now: number): void;
  /** The numbers for the frame at `now`; opens the beads that are due (and settles, below). */
  step(now: number): EntranceView;
  /** Takes the beads' no-transition mark off once its time has passed (a cheap check, made by every frame: a frame that draws nothing else, as under reduced motion, still makes it). */
  settle(now: number): void;
  /** Does the entrance change what the frame at `now` shows (it is running, or is about to begin)? */
  wakes(now: number): boolean;
  /** Is there still something to wait for or to draw (the loop must keep running, also under reduced motion, until the last bead's `data-instant` is off)? */
  live(): boolean;
};

/** How long a bead shown at once (a press) is kept without a transition, in milliseconds. */
export const INSTANT_MS = 100;

const FULL: EntranceView = { share: 1, ahead: 1, alpha: 1, radar: 0 };

/**
 * `waiting`: the entrance has not played yet (the beads start hidden, nothing of the trail is drawn); false: the map is as it
 * is after the entrance (a map made again, a screen where it does not play). `shares` are the milestones' places on the trail.
 * `onEnd` is told once when the entrance has drawn its last frame by itself (not when `finish` cut it short): the page's clock for "done" is this, not a guess.
 */
export function createEntrance(beads: readonly BeadEl[], shares: readonly number[], reduced: () => boolean, waiting: boolean, onEnd?: () => void): Entrance {
  let mode: "off" | "wait" | "run" = waiting ? "wait" : "off";
  let at: number | null = null;
  let t0 = 0;
  let radar: number | null = waiting ? null : 0;
  /** After a finish: when `data-instant` comes off again (a frame or two later, so the change to full strength has no transition and the hover transitions are the beads' own after). */
  let instantUntil: number | null = null;
  const opened = beads.map(() => !waiting);

  if (waiting) beads.forEach((b) => b.setAttribute("data-wait", ""));

  const open = (i: number) => {
    opened[i] = true;
    beads[i].removeAttribute("data-wait");
    beads[i].setAttribute("data-enter", "");
  };
  const over = () => {
    mode = "off";
    beads.forEach((b) => b.removeAttribute("data-enter"));
    onEnd?.();
  };

  const settle = (now: number) => {
    if (instantUntil === null || now < instantUntil) return;
    instantUntil = null;
    beads.forEach((b) => b.removeAttribute("data-instant"));
  };

  return {
    start(time) {
      if (mode === "wait" && at === null) at = time;
    },
    finish(now) {
      if (mode === "off") return;
      mode = "off";
      at ??= now;
      radar ??= now;
      instantUntil = now + INSTANT_MS;
      beads.forEach((b, i) => {
        opened[i] = true;
        b.removeAttribute("data-wait");
        b.removeAttribute("data-enter");
        b.setAttribute("data-instant", "");
      });
    },
    settle,
    step(now) {
      settle(now);
      if (mode === "wait" && at !== null && now >= at) {
        mode = "run";
        t0 = now;
      }
      if (mode === "off") return { ...FULL, radar: radar ?? 0 };
      if (mode === "wait") return { share: 0, ahead: 0, alpha: 0, radar: null };

      const ms = now - t0;

      if (reduced()) {
        // no drawing: everything fades in together when the reveal ends
        beads.forEach((_, i) => opened[i] || open(i));
        if (ms >= ENTRANCE.reducedMs) radar ??= t0 + ENTRANCE.reducedMs;
        if (ms >= ENTRANCE.reducedMs + 300) over();

        return { share: 1, ahead: 1, alpha: clamp(ms / ENTRANCE.reducedMs), radar };
      }
      beads.forEach((_, i) => {
        if (!opened[i] && ms >= beadDelay(shares[i] ?? 1)) open(i);
      });
      if (ms >= ENTRANCE.traceMs) radar ??= t0 + ENTRANCE.traceMs;
      if (ms >= TRACE_END_MS) over();

      return { share: traceShare(ms), ahead: aheadShare(ms), alpha: 1, radar };
    },
    wakes(now) {
      return mode === "run" || (mode === "wait" && at !== null && now >= at);
    },
    live() {
      return instantUntil !== null || mode === "run" || (mode === "wait" && at !== null);
    },
  };
}
