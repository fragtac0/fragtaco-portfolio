/**
 * Runs the glass front on a change's view transition, from the transition's `ready` (the pseudo-elements exist then).
 *
 * The reveal and the line need nothing from scripts: glass.css animates `--glass-p` (the eased progress) with a CSS
 * animation on the pseudo-elements that use it and draws everything from that one number. This module does three
 * things around it: it prepares the pictures (the soft wandering edge and the bend's maps, made on canvases once, in idle
 * time), it moves the SVG filter's map along with the front once per frame (an attribute write, no React state), and it
 * checks that the CSS animation really runs. If anything fails, or the check does not see `--glass-p` move (a browser
 * that does not animate a registered custom property on these pseudo-elements, one without `CSS.registerProperty`),
 * `data-glass-fallback` goes on <html> and glass.css gives the plain UA crossfade instead, so a change never hangs
 * on a hidden new page.
 */
import type { ChangePlan } from "../../lib/page-change";
import { GLASS_IDS } from "./glass-filter";
import { ringLinePixels, ringMaskPixels, stripLinePixels, stripMaskPixels } from "./glass-edge";
import { frontAt, GLASS, isChromium, REACH } from "./glass-math";
import { ringPixels, stripPixels } from "./glass-texture";

const BEND_RING_PX = 256;
const BEND_STRIP_PX: [number, number] = [256, 96];
const MASK_RING_PX = 256;
const LINE_RING_PX = 384;
const STRIP_PX: [number, number] = [256, 96];
/** How long into a change the check waits before it reads `--glass-p`. */
const VERIFY_MS = 90;

let started = false;
let edgeReady = false;
let bendReady = false;

function toUrl(pixels: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

const warm = (url: string) => {
  const img = new Image();
  img.src = url;
  void img.decode().catch(() => undefined);
};

/**
 * Makes the pictures, one at a time with a gap between (each is a few milliseconds, at most about 25; together they must not
 * be one long task): the edge's masks and lines for every kind (all browsers), then the bend's two maps (Chromium only).
 * A change that starts before they are ready, or after a step failed, uses the plain gradient reveal and no bend.
 */
export function prepareGlass(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const pictures: Record<string, string> = {};
  const steps: Array<() => void> = [
    () => {
      pictures.ringMask = toUrl(ringMaskPixels(MASK_RING_PX), MASK_RING_PX, MASK_RING_PX);
      pictures.ringLine = toUrl(ringLinePixels(LINE_RING_PX), LINE_RING_PX, LINE_RING_PX);
    },
    () => {
      for (const mirror of [false, true]) {
        const side = mirror ? "L" : "R";
        pictures[`stripMask${side}`] = toUrl(stripMaskPixels(...STRIP_PX, mirror), ...STRIP_PX);
        pictures[`stripLine${side}`] = toUrl(stripLinePixels(...STRIP_PX, mirror), ...STRIP_PX);
      }
      const style = document.createElement("style");
      style.dataset.glassPictures = "";
      style.textContent = pictureRules(pictures);
      document.head.appendChild(style);
      Object.values(pictures).forEach(warm);
      edgeReady = true;
    },
    () => {
      if (!isChromium(navigator.userAgent)) return;
      const ring = document.getElementById(GLASS_IDS.radial.image);
      const strip = document.getElementById(GLASS_IDS.linear.image);
      if (!ring || !strip) throw new Error("the bend's filters are not in the page");
      const ringUrl = toUrl(ringPixels(BEND_RING_PX), BEND_RING_PX, BEND_RING_PX);
      ring.setAttribute("href", ringUrl);
      warm(ringUrl);
      const stripUrl = toUrl(stripPixels(...BEND_STRIP_PX), ...BEND_STRIP_PX);
      strip.setAttribute("href", stripUrl);
      warm(stripUrl);
      bendReady = true;
    },
  ];
  const next = () => {
    const step = steps.shift();
    if (!step) return;
    try {
      step();
    } catch {
      return; // what is ready stays; what is not has no pictures
    }
    window.setTimeout(next, 30);
  };
  next();
}

/** The rules that give the reveal and the line their pictures (the rest of their styling is in glass.css). */
function pictureRules(p: Record<string, string>): string {
  const on = 'html[data-glass-edge]:not([data-glass-fallback])';
  const kind = (k: string) => `${on}[data-change-kind="${k}"]`;
  const url = (name: string) => `url("${p[name]}")`;
  return [
    `${kind("radial")}::view-transition-new(root){mask-image:${url("ringMask")}}`,
    `${kind("radial")}::view-transition-group(glass-line){background-image:${url("ringLine")}}`,
    `${kind("linear-right")}::view-transition-new(root){mask-image:${url("stripMaskR")},linear-gradient(#000,#000)}`,
    `${kind("linear-right")}::view-transition-group(glass-line){background-image:${url("stripLineR")}}`,
    `${kind("linear-left")}::view-transition-new(root){mask-image:${url("stripMaskL")},linear-gradient(#000,#000)}`,
    `${kind("linear-left")}::view-transition-group(glass-line){background-image:${url("stripLineL")}}`,
  ].join("\n");
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

const setAttrs = (el: Element, attrs: Record<string, number>) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v.toFixed(2));
};

/** The CSS animation that runs `--glass-p`, if the browser lists it (its clock is the best one for the bend). */
function findGlassAnimation(): Animation | undefined {
  try {
    return document.getAnimations().find((a) => (a as CSSAnimation).animationName === "glass-p");
  } catch {
    return undefined;
  }
}

/**
 * Starts the glass front on a change's view transition. Returns the function that stops it (called when the change is
 * over, however it ends): it takes every mark off <html> and sets the bend to 0.
 */
export function startGlass(t: { ready: Promise<void> }, plan: ChangePlan): () => void {
  if (plan.kind !== "radial" && plan.kind !== "linear-left" && plan.kind !== "linear-right") return () => undefined;
  const html = document.documentElement;
  let stopped = false;
  let frame = 0;
  let check = 0;
  let push: Element | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    window.clearTimeout(check);
    delete html.dataset.glass;
    delete html.dataset.glassEdge;
    delete html.dataset.glassFallback;
    push?.setAttribute("scale", "0");
  };

  /** The plain crossfade: no mask, the UA's own animation, no bend. */
  const fallback = () => {
    if (stopped) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    delete html.dataset.glass;
    delete html.dataset.glassEdge;
    html.dataset.glassFallback = "";
    push?.setAttribute("scale", "0");
  };

  const verify = () => {
    if (stopped) return;
    try {
      const p = parseFloat(getComputedStyle(html, "::view-transition-new(root)").getPropertyValue("--glass-p"));
      if (!(p > 0)) fallback();
    } catch {
      fallback();
    }
  };

  const bend = (kind: ChangePlan["kind"]) => {
    const ids = kind === "radial" ? GLASS_IDS.radial : GLASS_IDS.linear;
    const image = document.getElementById(ids.image);
    push = document.getElementById(ids.push);
    if (!bendReady || !image || !push) return;
    const strength = push;
    html.dataset.glass = "bend";
    const wide = window.innerWidth;
    const tall = window.innerHeight;
    const t0 = performance.now();
    let clock: Animation | undefined;
    const tick = () => {
      if (stopped) return;
      clock ??= findGlassAnimation();
      const now = typeof clock?.currentTime === "number" ? clock.currentTime : performance.now() - t0;
      const f = frontAt(Math.min(1, now / plan.ms), plan);
      if (f.radius !== undefined) {
        const reach = f.radius * (1 + REACH * GLASS.band);
        setAttrs(image, { x: plan.origin.x - reach, y: plan.origin.y - reach, width: 2 * reach, height: 2 * reach });
      } else if (f.pos !== undefined) {
        const reach = REACH * GLASS.band * wide;
        const at = kind === "linear-right" ? f.pos : wide - f.pos;
        setAttrs(image, { x: at - reach, y: 0, width: 2 * reach, height: tall });
      }
      strength.setAttribute("scale", (2 * GLASS.bendPx * f.bend).toFixed(2));
      frame = requestAnimationFrame(tick);
    };
    tick();
  };

  const begin = () => {
    if (stopped) return;
    try {
      if (typeof CSS === "undefined" || !("registerProperty" in CSS)) return fallback();
      if (edgeReady) html.dataset.glassEdge = "";
      check = window.setTimeout(verify, VERIFY_MS);
      bend(plan.kind);
    } catch {
      fallback();
    }
  };
  t.ready.then(begin, () => undefined);
  return stop;
}
