import { seriesFaces, type SeriesDesign } from "./spine-series";

/**
 * Waiting for the spine faces (round 7 plan, Review Focus 5). The six display faces arrive in a
 * second stylesheet that does not block the page (app/components/spine-fonts.tsx: linked with
 * media="print", switched to "all" once it has loaded), so a face can be late. A spine is painted
 * after `spineFontsReady`, which gives up after 2.5 s; `watchSpineFonts` tells the caller when a
 * face arrives after that (or after a paint) so the spines are painted again and never stay in a
 * fallback face. Client only.
 */

/** The longest the first paint waits for the faces while nothing waits for the shelf (the idle path). */
export const FONT_WAIT_MS = 2500;
/** The longest it waits once the layer is open and waiting for the shelf (R89): the layer gives up on 3D at 1.5 s. */
export const OPEN_FONT_WAIT_MS = 1000;

/** The distinct faces the designs name (each as a CSS font shorthand). Pure. */
export function facesOf(designs: readonly SeriesDesign[]): string[] {
  return [...new Set(designs.flatMap(seriesFaces))];
}

/** The family a face shorthand names (`600 17px "Bodoni Moda"` is `Bodoni Moda`). Pure. */
export function familyOfFace(face: string): string {
  return /"([^"]+)"/.exec(face)?.[1] ?? "";
}

const link = (): HTMLLinkElement | null =>
  typeof document === "undefined" ? null : document.querySelector<HTMLLinkElement>("link[data-spine-fonts]");

/** True once the spine faces' stylesheet is in force (or when the page has none to wait for). */
export function stylesheetApplied(): boolean {
  const l = link();
  return !l || l.media === "all" || l.media === "" || l.media === "screen";
}

/**
 * True when `face` can be drawn for `text` now: the stylesheet is in force and the face has loaded.
 * (`document.fonts.check` alone says true for a family it has never heard of, as while the
 * stylesheet is still `media="print"`.) With no font set to ask, true.
 */
export function faceLoaded(face: string, text: string): boolean {
  if (typeof document === "undefined" || typeof document.fonts?.check !== "function") return true;
  return stylesheetApplied() && document.fonts.check(face, text);
}

/** The faces of `design` that cannot be drawn for `text` yet; a spine painted now is in a fallback for these. */
export const missingFaces = (design: SeriesDesign, text: string): string[] =>
  seriesFaces(design).filter((f) => !faceLoaded(f, text));

/** Runs `fn` once the stylesheet is in force (at once when it already is); returns a stop. */
function whenApplied(fn: () => void): () => void {
  const l = link();
  if (stylesheetApplied() || !l || typeof MutationObserver === "undefined") {
    fn();
    return () => undefined;
  }
  const mo = new MutationObserver(() => {
    if (!stylesheetApplied()) return;
    mo.disconnect();
    fn();
  });
  mo.observe(l, { attributes: true, attributeFilter: ["media"] });
  return () => mo.disconnect();
}

/** Starts loading every face for `text` (the letters the spines show, so the right subsets come). */
function loadFaces(faces: string[], text: string): Promise<unknown> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all(faces.map((f) => document.fonts.load(f, text).catch(() => undefined)));
}

/**
 * Resolves when the stylesheet is in force and every face the designs name has loaded for `text`,
 * or after `FONT_WAIT_MS`, whichever comes first (a failure only costs the fallback faces). Never
 * rejects.
 */
export function spineFontsReady(designs: readonly SeriesDesign[], text = "", waitMs = FONT_WAIT_MS): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const faces = facesOf(designs);
  return new Promise<void>((resolve) => {
    let stop: () => void = () => undefined;
    const timer = setTimeout(() => {
      stop();
      resolve();
    }, waitMs);
    stop = whenApplied(() => {
      void loadFaces(faces, text).then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  });
}

/**
 * Calls `onLate` when a spine face finishes loading (the engine paints the spines again), and starts
 * the loads itself when the stylesheet is applied late. Calls are coalesced into one a moment later.
 * Returns the stop. Start it before waiting on `spineFontsReady`, so a face that arrives in between
 * is not missed.
 */
export function watchSpineFonts(designs: readonly SeriesDesign[], text: string, onLate: () => void): () => void {
  if (typeof document === "undefined" || !document.fonts) return () => undefined;
  const faces = facesOf(designs);
  const ours = new Set(faces.map(familyOfFace));
  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(onLate, 60);
  };
  const done = (e: Event) => {
    const list = (e as Event & { fontfaces?: FontFace[] }).fontfaces ?? [];
    if (list.some((f) => ours.has(f.family.replace(/^["']|["']$/g, "")))) later();
  };
  document.fonts.addEventListener("loadingdone", done);
  const stop = whenApplied(() => {
    void loadFaces(faces, text);
  });
  return () => {
    clearTimeout(timer);
    document.fonts.removeEventListener("loadingdone", done);
    stop();
  };
}
