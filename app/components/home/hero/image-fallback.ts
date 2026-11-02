import type { PaintEngine, PaintMeta } from "./paint-engine";

/**
 * Stand-in for the paint engine when WebGL is unavailable: the painting is a plain
 * <img> and a change is a CSS crossfade (see `.paint-host img` in home.css). It has the
 * engine's shape so the hero's loader and cycle do not care which one they drive.
 */
export function createImageFallback(host: HTMLElement): PaintEngine {
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

  const show = (img: HTMLImageElement, meta: PaintMeta, ms: number, done?: () => void) => {
    if (disposed) return;
    const next = imgs[1 - cur];
    next.src = img.src;
    next.style.objectPosition = `${meta.focal[0] * 100}% ${meta.focal[1] * 100}%`;
    next.style.transitionDuration = `${ms}ms`;
    imgs[cur].style.transitionDuration = `${ms}ms`;
    next.classList.add("on");
    imgs[cur].classList.remove("on");
    cur = 1 - cur;
    busy = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      busy = false;
      done?.();
    }, ms);
  };

  return {
    black() {},
    reveal: show,
    swap: show,
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
