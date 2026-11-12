/**
 * Runs the glass front on a change's view transition, from the transition's `ready` (the pseudo-elements exist then).
 *
 * The reveal and the line need nothing from scripts: glass.css animates `--glass-p` (the eased progress) with a CSS
 * animation on the pseudo-elements that use it and draws everything from that one number. This module does three
 * things around it: it prepares the pictures (the soft wandering edge and the bend's maps, made on canvases once, in idle
 * time), it moves the SVG filter's map along with the front once per frame (an attribute write, no React state), and it
 * checks that the CSS animation really runs (`judgeGlass`, frame by frame: the animation is listed, advances and has progress). If anything fails, or the check does not see it run (a browser
 * that does not animate a registered custom property on these pseudo-elements, one without `CSS.registerProperty`),
 * `data-glass-fallback` goes on <html> and glass.css gives the plain UA crossfade instead, so a change never hangs
 * on a hidden new page.
 */
import type { ChangePlan } from "../../lib/page-change";
import { GLASS_IDS } from "./glass-filter";
import { ringLinePixels, ringMaskPixels, stripLinePixels, stripMaskPixels } from "./glass-edge";
import { frontAt, GLASS, isChromium, judgeGlass, REACH } from "./glass-math";
import { ringPixels, stripPixels } from "./glass-texture";

const BEND_RING_PX = 256;
const BEND_STRIP_PX: [number, number] = [256, 96];
const MASK_RING_PX = 256;
const LINE_RING_PX = 384;
const STRIP_PX: [number, number] = [256, 96];

let started = false;
/** Which pictures exist. Each is made by its own step, so one failing leaves the others usable. */
const ready = { edgeRadial: false, edgeLinear: false, bendRadial: false, bendLinear: false };

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
  const inject = (rules: string) => {
    const style = document.createElement("style");
    style.dataset.glassPictures = "";
    style.textContent = rules;
    document.head.appendChild(style);
  };
  const bend = (id: string, pixels: () => [Uint8ClampedArray<ArrayBuffer>, number, number]) => {
    const el = document.getElementById(id);
    if (!el) throw new Error("the bend's filter is not in the page");
    const [px, w, h] = pixels();
    const url = toUrl(px, w, h);
    el.setAttribute("href", url);
    warm(url);
  };
  const chromium = isChromium(navigator.userAgent);
  const steps: Array<() => void> = [
    () => {
      const ringMask = toUrl(ringMaskPixels(MASK_RING_PX), MASK_RING_PX, MASK_RING_PX);
      const ringLine = toUrl(ringLinePixels(LINE_RING_PX), LINE_RING_PX, LINE_RING_PX);
      inject(radialRules(ringMask, ringLine));
      warm(ringMask);
      warm(ringLine);
      ready.edgeRadial = true;
    },
    () => {
      const strips: Record<string, string> = {};
      for (const mirror of [false, true]) {
        const side = mirror ? "L" : "R";
        strips[`mask${side}`] = toUrl(stripMaskPixels(...STRIP_PX, mirror), ...STRIP_PX);
        strips[`line${side}`] = toUrl(stripLinePixels(...STRIP_PX, mirror), ...STRIP_PX);
      }
      inject(linearRules(strips));
      Object.values(strips).forEach(warm);
      ready.edgeLinear = true;
    },
    ...(chromium
      ? [
          () => {
            bend(GLASS_IDS.radial.image, () => [ringPixels(BEND_RING_PX), BEND_RING_PX, BEND_RING_PX]);
            ready.bendRadial = true;
          },
          () => {
            bend(GLASS_IDS.linear.image, () => [stripPixels(...BEND_STRIP_PX), ...BEND_STRIP_PX]);
            ready.bendLinear = true;
          },
        ]
      : []),
  ];
  // one step at a time with a gap between; a step that throws leaves its own pictures out and the others go on
  const next = () => {
    const step = steps.shift();
    if (!step) return;
    try {
      step();
    } catch {
      /* this one has no pictures; the change uses the gradient reveal or no bend for it */
    }
    window.setTimeout(next, 30);
  };
  next();
}

const ON = "html[data-glass-edge]:not([data-glass-fallback])";
const kindRule = (kind: string, pseudo: string, declaration: string) => `${ON}[data-change-kind="${kind}"]::${pseudo}{${declaration}}`;

/** The rules that give the radial reveal and its line their pictures (the rest of their styling is in glass.css). */
function radialRules(mask: string, line: string): string {
  return [
    kindRule("radial", "view-transition-new(root)", `mask-image:url("${mask}")`),
    kindRule("radial", "view-transition-group(glass-line)", `background-image:url("${line}")`),
  ].join("\n");
}

/** The same for the two linear kinds, from the strips `maskR`, `lineR`, `maskL` and `lineL`. */
function linearRules(p: Record<string, string>): string {
  return (["R", "L"] as const)
    .flatMap((side) => {
      const kind = side === "R" ? "linear-right" : "linear-left";
      return [
        kindRule(kind, "view-transition-new(root)", `mask-image:url("${p[`mask${side}`]}"),linear-gradient(#000,#000)`),
        kindRule(kind, "view-transition-group(glass-line)", `background-image:url("${p[`line${side}`]}")`),
      ];
    })
    .join("\n");
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
  let watch = 0;
  let push: Element | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    if (watch) cancelAnimationFrame(watch);
    delete html.dataset.glass;
    delete html.dataset.glassEdge;
    delete html.dataset.glassFallback;
    push?.setAttribute("scale", "0");
  };

  /** The plain crossfade: no mask, the UA's own animation, no bend. */
  const fallback = () => {
    if (stopped) return;
    if (frame) cancelAnimationFrame(frame);
    if (watch) cancelAnimationFrame(watch);
    frame = 0;
    delete html.dataset.glass;
    delete html.dataset.glassEdge;
    html.dataset.glassFallback = "";
    push?.setAttribute("scale", "0");
  };

  /**
   * Each animation frame until it is decided: is the `glass-p` CSS animation in the document's list, has it advanced, and does it
   * have progress (`judgeGlass`)? The computed value of `--glass-p` is only a second opinion (WebKit may not give one).
   */
  let frames = 0;
  const look = () => {
    if (stopped) return;
    frames++;
    let verdict: ReturnType<typeof judgeGlass>;
    try {
      const anim = findGlassAnimation();
      const timing = anim?.effect?.getComputedTiming();
      let computed: number | null = null;
      try {
        const v = parseFloat(getComputedStyle(html, "::view-transition-new(root)").getPropertyValue("--glass-p"));
        computed = Number.isFinite(v) ? v : null;
      } catch {
        /* no second opinion */
      }
      verdict = judgeGlass({
        frames,
        found: anim !== undefined,
        timeMs: typeof anim?.currentTime === "number" ? anim.currentTime : null,
        progress: typeof timing?.progress === "number" ? timing.progress : null,
        computed,
      });
    } catch {
      verdict = "fallback";
    }
    if (verdict === "fallback") fallback();
    else if (verdict === "wait") watch = requestAnimationFrame(look);
  };

  const bend = (kind: ChangePlan["kind"]) => {
    const ids = kind === "radial" ? GLASS_IDS.radial : GLASS_IDS.linear;
    const image = document.getElementById(ids.image);
    push = document.getElementById(ids.push);
    if (!(kind === "radial" ? ready.bendRadial : ready.bendLinear) || !image || !push) return;
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
      if (plan.kind === "radial" ? ready.edgeRadial : ready.edgeLinear) html.dataset.glassEdge = "";
      watch = requestAnimationFrame(look);
      bend(plan.kind);
    } catch {
      fallback();
    }
  };
  t.ready.then(begin, () => undefined);
  return stop;
}
