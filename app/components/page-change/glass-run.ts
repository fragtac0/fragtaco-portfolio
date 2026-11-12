/**
 * Drives the glass front from the view transition's `ready` (the pseudo-elements exist then).
 *
 * glass.css draws the reveal and the thin line from one number, `--glass-p` (the eased progress),
 * and this animates it, on the transition's root group and on the line element, with the Web
 * Animations API: that is all the reveal and line need, with no work in JavaScript per frame. The bend
 * is the one thing CSS cannot do: it moves the SVG filter's map along with the front, once per frame
 * (an attribute write per frame, no React state), reading the time from the same animation.
 */
import type { ChangePlan } from "../../lib/page-change";
import { GLASS_IDS } from "./glass-filter";
import { frontAt, GLASS, GLASS_EASING, isChromium, REACH } from "./glass-math";
import { ringPixels, stripPixels } from "./glass-texture";

const RING_PX = 256;
const STRIP_PX: [number, number] = [256, 96];

let prepared = false;
let textures = false;

function toUrl(pixels: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Builds the two maps once, into the filters' pictures. Cheap but not free (about 25 ms), so it runs when
 * the browser is idle after the first page is up. A change that starts before then, or a browser that is not
 * Chromium, simply has no bend.
 */
export function prepareGlass(): void {
  if (prepared || typeof document === "undefined") return;
  prepared = true;
  if (!isChromium(navigator.userAgent)) return;
  try {
    const ring = document.getElementById(GLASS_IDS.radial.image);
    const strip = document.getElementById(GLASS_IDS.linear.image);
    if (!ring || !strip) return;
    const ringUrl = toUrl(ringPixels(RING_PX), RING_PX, RING_PX);
    const stripUrl = toUrl(stripPixels(...STRIP_PX), ...STRIP_PX);
    ring.setAttribute("href", ringUrl);
    strip.setAttribute("href", stripUrl);
    // decode them now, so the first change does not
    for (const url of [ringUrl, stripUrl]) {
      const warm = new Image();
      warm.src = url;
      void warm.decode().catch(() => undefined);
    }
    textures = true;
  } catch {
    textures = false;
  }
}

/** Runs the callback after the first page is up and the browser has nothing better to do. Returns the cancel. */
export function prepareGlassWhenIdle(): () => void {
  const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) {
    const id = idle.call(window, prepareGlass, { timeout: 3000 });
    return () => (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(prepareGlass, 1500);
  return () => window.clearTimeout(id);
}

const setAttrs = (el: Element | null, attrs: Record<string, number>) => {
  if (!el) return;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v.toFixed(2));
};

/**
 * Starts the glass front on a change's view transition: the reveal and line from `ready`, the bend if it
 * is on. Returns the function that stops it (called when the change is over, however it ends).
 */
export function startGlass(t: { ready: Promise<void> }, plan: ChangePlan): () => void {
  if (plan.kind !== "radial" && plan.kind !== "linear-left" && plan.kind !== "linear-right") return () => undefined;
  const html = document.documentElement;
  let stopped = false;
  let frame = 0;
  const running: Animation[] = [];
  const radial = plan.kind === "radial";
  const ids = radial ? GLASS_IDS.radial : GLASS_IDS.linear;
  let push: HTMLElement | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    for (const a of running) {
      try {
        a.cancel();
      } catch {
        /* already gone */
      }
    }
    delete html.dataset.glass;
    push?.setAttribute("scale", "0");
  };

  const begin = () => {
    if (stopped) return;
    const timing = { duration: plan.ms, easing: GLASS_EASING, fill: "forwards" as const };
    const frames = { "--glass-p": ["0", "1"] };
    let clock: Animation;
    try {
      clock = html.animate(frames, { ...timing, pseudoElement: "::view-transition-group(root)" });
    } catch {
      return; // no pseudo-element animations: the change is the plain fade, which needs nothing from us
    }
    running.push(clock);
    const line = document.querySelector("[data-glass-line]");
    if (line) running.push(line.animate(frames, timing));
    const image = document.getElementById(ids.image);
    push = document.getElementById(ids.push);
    if (!textures || !image || !push) return;
    const bend = push;
    html.dataset.glass = "bend";
    const wide = window.innerWidth;
    const tall = window.innerHeight;
    const tick = () => {
      if (stopped) return;
      const now = typeof clock.currentTime === "number" ? clock.currentTime : 0;
      const f = frontAt(Math.min(1, now / plan.ms), plan);
      if (f.radius !== undefined) {
        const reach = f.radius * (1 + REACH * GLASS.band);
        setAttrs(image, { x: plan.origin.x - reach, y: plan.origin.y - reach, width: 2 * reach, height: 2 * reach });
      } else if (f.pos !== undefined) {
        const reach = REACH * GLASS.band * wide;
        const at = plan.kind === "linear-right" ? f.pos : wide - f.pos;
        setAttrs(image, { x: at - reach, y: 0, width: 2 * reach, height: tall });
      }
      bend.setAttribute("scale", (2 * GLASS.bendPx * f.bend).toFixed(2));
      frame = requestAnimationFrame(tick);
    };
    tick();
  };
  t.ready.then(begin, () => undefined);
  return stop;
}
