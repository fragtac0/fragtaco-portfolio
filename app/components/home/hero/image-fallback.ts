import { REDUCED_REVEAL_MS, REDUCED_SWAP_MS, type PaintEngine, type PaintMeta } from "./paint-engine";

/**
 * Stand-in for the paint engine when WebGL is unavailable: the painting is a plain
 * <img> and a change is a CSS crossfade (see `.paint-host img` in home.css). It has the
 * engine's shape so the hero's loader and cycle do not care which one they drive.
 *
 * The new painting fades in on top of the old one, which stays fully opaque until the fade has
 * finished, so the middle of a change never dips toward the black behind. Under reduced motion
 * the first reveal is a 0.4 s fade and a change a 0.8 s crossfade. There is no blur (the card
 * scrim is a plain tint) and no slow zoom.
 */
export function createImageFallback(
  host: HTMLElement,
  opts: { reducedMotion: boolean } = { reducedMotion: false },
): PaintEngine {
  const imgs = [document.createElement("img"), document.createElement("img")];
  for (const el of imgs) {
    el.alt = "";
    el.setAttribute("aria-hidden", "true");
    host.appendChild(el);
  }
  let cur = 0;
  let busy = false;
  let timer = 0;
  let disposed = false;

  const fade = (el: HTMLElement, ms: number) => el.style.setProperty("--fade", `${ms}ms`);

  const show = (
    img: HTMLImageElement,
    meta: PaintMeta,
    rawMs: number,
    reducedMs: number,
    done?: () => void,
  ) => {
    if (disposed) return;
    const ms = opts.reducedMotion ? reducedMs : rawMs;
    const prev = imgs[cur];
    const next = imgs[1 - cur];
    window.clearTimeout(timer);
    // a change that interrupts an unfinished one settles the old picture first
    fade(prev, 0);
    next.src = img.src;
    next.style.objectPosition = `${meta.focal[0] * 100}% ${meta.focal[1] * 100}%`;
    next.classList.remove("on");
    fade(next, 0);
    void next.offsetWidth; // commit the hidden start so the fade runs from it
    prev.style.zIndex = "1";
    next.style.zIndex = "2";
    fade(next, ms);
    next.classList.add("on");
    cur = 1 - cur;
    busy = true;
    timer = window.setTimeout(() => {
      busy = false;
      fade(prev, 0);
      prev.classList.remove("on");
      done?.();
    }, ms);
  };

  return {
    black() {},
    reveal: (img, meta, ms, done) => show(img, meta, ms, REDUCED_REVEAL_MS, done),
    swap: (img, meta, ms, done) => show(img, meta, ms, REDUCED_SWAP_MS, done),
    setBlur() {},
    busy: () => busy,
    moving: () => false,
    pause() {},
    resume() {},
    draw() {},
    dispose() {
      disposed = true;
      window.clearTimeout(timer);
      for (const el of imgs) el.remove();
    },
  };
}
