/** Once-per-session loader: the rules, and the inline head script that applies them before first paint. */

declare global {
  interface Window {
    /** performance.now() when the head script started the loader; undefined when it is skipped. */
    __introT0?: number;
  }
}

export const INTRO_KEY = "ft:intro-seen";

/** A deep link means the visitor wants that place now, so the loader is skipped. */
export const DEEP_LINKS = ["#about", "#reading", "#watching"];

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
 * Plain ES5, runs inline in <head> before any bundle. Same rules as introMode;
 * blocked storage (getItem throws) counts as "not seen", so the loader plays.
 * Free variables: document, sessionStorage, location, matchMedia, setTimeout, performance, window.
 * When the loader will play it also records `window.__introT0` (performance.now()): the moment the
 * name's CSS animation starts, which the hero's JavaScript reads to join the timeline in progress.
 * Failsafe: the class locks scrolling, and only the hero removes it, so a bundle that
 * never loads would leave the page locked. A 15 s timer removes it regardless.
 */
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
  "setTimeout(function(){document.documentElement.classList.remove('intro');},15000);",
  "}",
  "}catch(e){}",
].join("");
