/** Once-per-session loader: the rules, and the inline head script that applies them before first paint. */

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
 * Free variables: document, sessionStorage, location, matchMedia.
 */
export const INTRO_HEAD_SCRIPT = [
  "try{",
  "var seen=false;",
  "try{seen=!!sessionStorage.getItem(" + JSON.stringify(INTRO_KEY) + ");}catch(e){}",
  "var reduced=false;",
  "try{reduced=!!matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}",
  "var deep=" + JSON.stringify(DEEP_LINKS) + ".indexOf(location.hash)!==-1;",
  "if(!seen&&!reduced&&!deep){document.documentElement.classList.add('intro');}",
  "}catch(e){}",
].join("");
