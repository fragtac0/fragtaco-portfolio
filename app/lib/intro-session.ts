/** Once-per-session loader: the rules, and the inline head script that applies them before first paint. */

import { INTRO_LOCK_MS } from "../components/home/hero/loader-timeline";

declare global {
  interface Window {
    /** performance.now() when the head script started the loader; undefined when it is skipped. */
    __introT0?: number;
  }
}

export const INTRO_KEY = "ft:intro-seen";

/** A deep link means the visitor wants that place now, so the loader is skipped. */
export const DEEP_LINKS: readonly string[] = ["#about", "#reading", "#watching"];

export function introMode(s: {
  seen: boolean;
  hash: string;
  reducedMotion: boolean;
}): "play" | "skip" {
  if (s.seen || s.reducedMotion) return "skip";
  if (DEEP_LINKS.indexOf(s.hash) !== -1) return "skip";
  return "play";
}

/**
 * Plain ES5, runs inline in <head> before any bundle. Same rules as introMode (a parity test runs
 * both over every combination of the three inputs);
 * blocked storage (getItem throws) counts as "not seen", so the loader plays.
 * Free variables: document, sessionStorage, location, matchMedia, setTimeout, performance, window.
 * When the loader will play it also records `window.__introT0` (performance.now()): the moment the
 * name's CSS animation starts, which the hero's JavaScript reads to join the timeline in progress.
 * Failsafe: the class locks scrolling, and the hero removes it at `done`, so a slow or failed bundle
 * would leave the page locked. A timer at INTRO_LOCK_MS (6.3 s: the loader's end plus the longest
 * reveal wait) removes it regardless and adds `intro-timeout`, which loader.css uses to show a
 * finished hero (final lockup, blurred painting) until the hero's script takes over.
 */
// The only values interpolated into the script are JSON.stringify of constants (the storage key and
// the deep links), so there is nothing to escape. If one ever becomes user input, a "<" in it could
// close the <script> element: escape it as "\u003c" first.
export const INTRO_HEAD_SCRIPT = [
  "try{",
  "var seen=false;",
  "try{seen=!!sessionStorage.getItem(" + JSON.stringify(INTRO_KEY) + ");}catch(e){}",
  "var reduced=false;",
  "try{reduced=!!matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}",
  "var deep=" + JSON.stringify(DEEP_LINKS) + ".indexOf(location.hash)!==-1;",
  "if(!seen&&!reduced&&!deep){",
  "document.documentElement.classList.add('intro');",
  "window.__introT0=performance.now();",
  "setTimeout(function(){var c=document.documentElement.classList;" +
    "if(c.contains('intro')){c.remove('intro');c.add('intro-timeout');}}," +
    INTRO_LOCK_MS +
    ");",
  "}",
  "}catch(e){}",
].join("");

/**
 * How the hero's script meets the loader. `t0` is the head script's start time (undefined when it
 * never ran), `now` the same clock, `locked` whether html.intro is still present.
 * - skip: the intro is skipped (seen, reduced motion, deep link).
 * - late: the intro cannot play from its start: the head script never ran (a client navigation to
 *   "/", which is a page change that reveals the painting, not a loader that rises from black: R49.1),
 *   the lock bound has passed, or the failsafe already removed the class. Take the skipped form
 *   (final state, painting, mark seen) and never lock again.
 * - join: the head script ran and the page is still locked: pick the timeline up where it is.
 */
export function joinLoader(s: {
  mode: "play" | "skip";
  t0: number | undefined;
  now: number;
  locked: boolean;
}): "skip" | "late" | "join" {
  if (s.mode === "skip") return "skip";
  if (s.t0 === undefined) return "late";
  if (!s.locked || s.now - s.t0 >= INTRO_LOCK_MS) return "late";
  return "join";
}
