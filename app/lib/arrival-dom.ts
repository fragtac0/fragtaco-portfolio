/**
 * The page's side of the arrival hold (arrival.ts): what a page that mounts during a change says it is waiting for
 * when that is pictures, and how a picture that comes after the cap fades in. Browser only (it reads images and
 * the screen); call it from a layout effect, never while rendering.
 */
import { holdFor, LATE_FADE_MS, type Hold } from "./arrival";
import { EASE_IN_MS, easeInRate } from "./ease-in";

/**
 * Resolves when the picture is in and decoded (so it paints with no work left), or when it has failed (a picture that did
 * not come must not hold the page: the page shows what it shows for a failed one). Never rejects.
 */
export function imageReady(img: HTMLImageElement): Promise<void> {
  const decoded = () => img.decode().then(
    () => undefined,
    () => undefined,
  );
  if (img.complete) return img.naturalWidth > 0 ? decoded() : Promise.resolve();
  return new Promise<void>((resolve) => {
    img.addEventListener("load", () => void decoded().then(resolve), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
}

const FADE_FRAMES = [{ opacity: 0 }, { opacity: 1 }];
const FADE_TIMING = { duration: LATE_FADE_MS, easing: "ease-out" } as const;

/**
 * Fades an element in over `LATE_FADE_MS`, with nothing else moving (opacity only). For a part that came after the cap. This is the only fade a
 * late part has: `data-late` switches off an opacity transition the part's own CSS has (the rings' and the wall's pictures fade in on `data-ready`), so
 * the two never run together and the element never dips back when this one ends. With a `veil` (see `veilPicture`) it plays that one, which has held
 * the picture at opacity 0 since before it came, so the picture is never painted whole in the frames before its fade starts.
 */
export function fadeLate(el: Element, veil?: Animation | null): void {
  if (typeof el.animate !== "function") return;
  (el as HTMLElement).dataset.late = "";
  if (veil) {
    veil.onfinish = () => veil.cancel(); // the element is at its own opacity again (1)
    veil.play();
  } else el.animate(FADE_FRAMES, FADE_TIMING);
}

/**
 * Holds a picture that is still on its way at opacity 0 (a paused animation at its first frame) until `fadeLate` plays it or the page cancels it (the picture
 * came in time). A picture that comes after the reveal is painted by the browser as soon as it is decoded, which can be a frame or two before the page hears of
 * it; without this it would show whole for those frames and then fade from 0.
 */
export function veilPicture(img: HTMLImageElement): Animation | null {
  if (typeof img.animate !== "function") return null;
  const veil = img.animate(FADE_FRAMES, { ...FADE_TIMING, fill: "both" });
  veil.pause();
  return veil;
}

/** Whether any of the element's box is inside the window (the part of the page the reveal shows). */
export function inWindow(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
}

/**
 * Holds the reveal for these pictures (arrival.ts `holdFor`), and fades in each that comes after the reveal began (`fadeLate`):
 * the hold says whether it missed the reveal (`Hold.late`), so one that comes after the change has ended fades too. Does nothing
 * when no change is waiting for this page. Returns the hold.
 */
export function holdImages(label: string, images: Iterable<HTMLImageElement>): Hold | null {
  const list = [...images];
  const ready = list.map(imageReady);
  const hold = holdFor(label, Promise.all(ready));
  if (!hold) return null;
  list.forEach((img, i) => {
    const veil = img.complete ? null : veilPicture(img); // still on its way: held at opacity 0 until it is known whether it is late
    void ready[i].then(() => (hold.late ? fadeLate(img, veil) : veil?.cancel()));
  });
  return hold;
}

/**
 * Runs these CSS animations from standstill up to their own speed over `ms` (their playback rate follows `easeInRate`), a few
 * writes a frame for about a second. Call it in the commit that starts them, before they have painted. Returns what stops it.
 */
export function easeInPlayback(animations: Animation[], ms: number = EASE_IN_MS): () => void {
  if (animations.length === 0) return () => undefined;
  for (const a of animations) a.updatePlaybackRate(0);
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const rate = easeInRate(now - start, ms);
    for (const a of animations) a.updatePlaybackRate(rate);
    if (rate < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    for (const a of animations) a.updatePlaybackRate(1);
  };
}

/** Resolves `n` animation frames from now (the page's own effects have run and painted by then). */
export function afterFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => (n-- <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}
