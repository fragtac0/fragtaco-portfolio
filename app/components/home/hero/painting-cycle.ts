/** Pure helpers for the hero's painting order, timing and image size. */

export const RECENT_KEY = "heroRecentPaintings";
export const RECENT_LIMIT = 3;

/** "50% 30%" becomes [0.5, 0.3]; anything unparseable is the centre. */
export function parseFocal(focal: string): [number, number] {
  const m = /^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(focal);
  if (!m) return [0.5, 0.5];
  return [parseFloat(m[1]) / 100, parseFloat(m[2]) / 100];
}

/** Permutation of 0..length-1 that starts with `first`; the rest are Fisher-Yates shuffled. */
export function makeOrder(length: number, first: number, random: () => number): number[] {
  const rest: number[] = [];
  for (let i = 0; i < length; i++) if (i !== first) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = rest[i];
    rest[i] = rest[j];
    rest[j] = t;
  }
  return [first, ...rest];
}

/** Ten seconds between painting changes (L-07). */
export function nextDelayMs(): number {
  return 10000;
}

/**
 * The position in `order` of the painting that follows `position`, skipping any whose id is in
 * `recent` (the last three shown). `order` holds indexes into `ids`. When every other painting is
 * recent it is simply the next one; with a single painting it stays put.
 */
export function pickNext(order: number[], position: number, recent: string[], ids: string[]): number {
  const n = order.length;
  for (let step = 1; step < n; step++) {
    const at = (position + step) % n;
    if (recent.indexOf(ids[order[at]]) === -1) return at;
  }
  return n > 0 ? (position + 1) % n : 0;
}

/** The WebP copy's name, or the manifest's own file name for the JPEG fallback. */
const copyName = (file: string, webp: boolean) => (webp ? file.replace(/\.[^./]+$/, ".webp") : file);

/**
 * 1600 px copy when the effective width is at most 1400, else the 2560 px copy. `webp` picks the
 * WebP file (same name, `.webp`); otherwise the JPEG fallback at the manifest's own file name.
 */
export function paintingSrc(file: string, viewportWidth: number, dpr: number, webp: boolean): string {
  const size = viewportWidth * Math.min(dpr, 1.5) <= 1400 ? 1600 : 2560;
  return `/paintings/${size}/${copyName(file, webp)}`;
}

/** The `sizes` of the head preload: the painting covers the viewport's width. */
export const PRELOAD_SIZES = "100vw";

/**
 * The first painting's file, chosen the way the browser chooses from the head preload's `srcset`
 * with `sizes="100vw"`: the 1600 copy (1400w) when `viewportWidth * dpr` is at most 1400, else the
 * 2560 copy. The runtime asks for this very URL (when the browser can show WebP), so a preload
 * that already fetched it is reused. It uses the full device pixel ratio, where `paintingSrc` (the
 * later paintings) caps it at 1.5: a srcset cannot express a cap.
 */
export function firstPaintingSrc(file: string, viewportWidth: number, dpr: number, webp: boolean): string {
  const size = viewportWidth * dpr <= 1400 ? 1600 : 2560;
  return `/paintings/${size}/${copyName(file, webp)}`;
}

/**
 * The `<link rel="preload">` the home route puts in `<head>` for the first painting. `type` makes
 * a browser that cannot show WebP skip it (it then fetches the JPEG once, at runtime).
 */
export function preloadImage(file: string) {
  const webp = copyName(file, true);
  return {
    rel: "preload",
    as: "image",
    type: "image/webp",
    href: `/paintings/1600/${webp}`,
    imageSrcSet: `/paintings/1600/${webp} 1400w, /paintings/2560/${webp} 2560w`,
    imageSizes: PRELOAD_SIZES,
    // lowercase: React 18 warns about the camelCase `fetchPriority` on a DOM element
    fetchpriority: "high",
  } as const;
}

/** The loader's reveal holds the page locked, so it tries the first painting and one more. */
export const REVEAL_TRIES = 2;

/**
 * Which position in the order the reveal tries next, given how many it has already tried;
 * null means give up (continue the timeline without a painting). `max` defaults to
 * REVEAL_TRIES; the skipped loader locks nothing, so it may pass a larger one.
 */
export function nextRevealTry(tried: number, count: number, max: number = REVEAL_TRIES): number | null {
  return tried < Math.min(max, count) ? tried : null;
}
