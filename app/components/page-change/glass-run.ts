/**
 * Runs the glass front on a change's view transition, from the transition's `ready` (the pseudo-elements exist then).
 *
 * The reveal needs nothing from scripts while the front is small: glass.css animates `--glass-p` (the eased progress) with a
 * CSS animation on the pseudo-elements that use it and draws a circle with a soft edge from that one number. This module does
 * three things around it: it prepares the pictures (sheets of tiles for the wandering edge and its glow, and the bend's tiles,
 * made on canvases once, in idle time; see glass-field.ts), it moves them with the front once per frame (the tile nearest the
 * front, scaled onto it; a few CSS declarations and SVG attributes written, no React state), and it checks that the CSS
 * animation really runs (`judgeGlass`, frame by frame: the animation is listed, advances and has progress). If anything fails,
 * or the check does not see it run (a browser that does not animate a registered custom property on these pseudo-elements, one
 * without `CSS.registerProperty`), `data-glass-fallback` goes on <html> and glass.css gives the plain UA crossfade instead, so a
 * change never hangs on a hidden new page.
 */
import type { ChangePlan } from "../../lib/page-change";
import { lineGradient, lineTilePixels, maskTilePixels } from "./glass-edge";
import { GLASS_IDS, pushId, tileId, type GlassFilterId } from "./glass-filter";
import { BEND_TILES, HALF, pickBendTile, pickTile, sheetLayout, tileCell, TILES } from "./glass-field";
import { frontAt, bendPxFor, isChromium, judgeGlass, SPLIT } from "./glass-math";
import { BEND_MAX, bendTilePixels } from "./glass-texture";

/** Tiles per row on the sheets, and each tile's size in pixels: the mask's soft edge needs little, the glow's narrow glint more. */
const SHEET_COLS = 7;
const MASK_N = 128;
const LINE_N = 192;
const BEND_N = 128;
/** How long to wait between the chunks of work that make the pictures, so none is a long task. */
const GAP_MS = 20;

let started = false;
/** What exists: the sheets' rules (the CSS declarations the tick writes), and whether the bend's tiles are in the filters. */
const ready: { sheets: { mask: CSSStyleDeclaration; line: CSSStyleDeclaration } | null; bend: boolean } = { sheets: null, bend: false };

const gap = () => new Promise<void>((resolve) => window.setTimeout(resolve, GAP_MS));

const canvasOf = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  return { canvas, ctx };
};
const toBlobUrl = (canvas: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("no picture"))), "image/png"),
  );

const warm = (url: string) => {
  const img = new Image();
  img.src = url;
  void img.decode().catch(() => undefined);
};

/** Draws a tile for each front radius on one sheet, `perChunk` tiles at a time with a gap between; returns the sheet's address. */
async function makeSheet(radii: readonly number[], n: number, tile: (n: number, front: number) => Uint8ClampedArray<ArrayBuffer>, perChunk: number) {
  const { cols, rows } = sheetLayout(radii.length, SHEET_COLS);
  const { canvas, ctx } = canvasOf(cols * n, rows * n);
  for (let i = 0; i < radii.length; i++) {
    const { col, row } = tileCell(i, cols);
    ctx.putImageData(new ImageData(tile(n, radii[i]), n, n), col * n, row * n);
    if ((i + 1) % perChunk === 0 && i + 1 < radii.length) await gap();
  }
  const url = await toBlobUrl(canvas);
  warm(url);
  return url;
}

const inject = (name: string, rules: string): CSSStyleSheet | null => {
  const style = document.createElement("style");
  style.dataset[name] = "";
  style.textContent = rules;
  document.head.appendChild(style);
  return style.sheet;
};

const ON = "html[data-change-kind=\"radial\"]:not([data-glass-fallback])";
const MASK_AT = `${ON}::view-transition-new(root)`;
const LINE_AT = `${ON}::view-transition-group(glass-line)`;
/** The same two places, once the tick has put a front's tile there (`data-glass-live`). */
const LIVE = "html[data-glass-live]";
const LIVE_MASK_AT = `${LIVE}${MASK_AT.slice("html".length)}`;
const LIVE_LINE_AT = `${LIVE}${LINE_AT.slice("html".length)}`;

/**
 * Makes the pictures, a little at a time with a gap between (so none is one long task), most important first: the glow's plain
 * gradient (at once, it is only a string), the mask's sheet of tiles, the glow's sheet, then the bend's tiles (Chromium only).
 * A change that starts before they are ready, or after a step failed, draws what it can: the plain gradients for the edge
 * and the glow, and no bend for the picture that is missing.
 */
export function prepareGlass(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const chromium = isChromium(navigator.userAgent);
  void (async () => {
    try {
      inject("glassGlow", `${LINE_AT}{background-image:${lineGradient("var(--change-x) var(--change-y)", "var(--glass-front)", "var(--glass-band)")}}`);
    } catch {
      /* no glow while the front is small */
    }
    try {
      const mask = await makeSheet(TILES, MASK_N, maskTilePixels, 4);
      await gap();
      const line = await makeSheet(TILES, LINE_N, lineTilePixels, 1);
      // the sheets' rules start with no size: nothing of the new page shows until the first tick sizes them (no flash at the start)
      const sheet = inject(
        "glassSheets",
        `${LIVE_MASK_AT}{mask-image:url("${mask}");mask-repeat:no-repeat;mask-size:0 0;mask-position:0 0}\n` +
          `${LIVE_LINE_AT}{background-image:url("${line}");background-size:0 0;background-position:0 0}`,
      );
      const rules = Array.from(sheet?.cssRules ?? []).filter((r): r is CSSStyleRule => "style" in r);
      if (rules.length === 2) ready.sheets = { mask: rules[0].style, line: rules[1].style };
    } catch {
      /* the plain gradients draw the edge */
    }
    if (!chromium) return;
    try {
      await gap();
      for (let k = 0; k < BEND_TILES.length; k += 3) {
        const last = Math.min(BEND_TILES.length, k + 3);
        for (let i = k; i < last; i++) {
          const { canvas, ctx } = canvasOf(BEND_N, BEND_N);
          ctx.putImageData(new ImageData(bendTilePixels(BEND_N, BEND_TILES[i]), BEND_N, BEND_N), 0, 0);
          const url = await toBlobUrl(canvas);
          for (const f of [GLASS_IDS.old, GLASS_IDS.new]) {
            const el = document.getElementById(tileId(f, i));
            if (!el) throw new Error("the bend's filter is not in the page");
            el.setAttribute("href", url);
          }
          warm(url);
        }
        await gap();
      }
      ready.bend = true;
    } catch {
      /* no bend */
    }
  })();
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

/** The CSS animation that runs `--glass-p`, if the browser lists it (its clock is the best one for the pictures and the bend). */
function findGlassAnimation(): Animation | undefined {
  try {
    return document.getAnimations().find((a) => (a as CSSAnimation).animationName === "glass-p");
  } catch {
    return undefined;
  }
}

/** The pieces of one bend filter the tick moves: its tile images and its three pushes (red, green, blue). */
interface BendFilter {
  tiles: Array<Element | null>;
  pushes: Array<Element | null>;
  /** The push's direction: +1 for the old page, -1 for the new. */
  sign: 1 | -1;
}
const bendFilter = (id: GlassFilterId, sign: 1 | -1): BendFilter => ({
  tiles: BEND_TILES.map((_, i) => document.getElementById(tileId(id, i))),
  pushes: (["r", "g", "b"] as const).map((c) => document.getElementById(pushId(id, c))),
  sign,
});
const SPLITS = [SPLIT.r, SPLIT.g, SPLIT.b] as const;

/**
 * Starts the glass front on a change's view transition. Returns the function that stops it (called when the change is
 * over, however it ends): it takes every mark off <html> and sets the bend to 0.
 */
export function startGlass(t: { ready: Promise<void> }, plan: ChangePlan): () => void {
  if (plan.kind !== "radial") return () => undefined;
  const html = document.documentElement;
  let stopped = false;
  let frame = 0;
  let watch = 0;
  let filters: BendFilter[] = [];

  const clearBend = () => {
    for (const f of filters) {
      for (const p of f.pushes) p?.setAttribute("scale", "0");
      for (const tile of f.tiles) tile?.setAttribute("width", "0");
    }
  };
  const unmark = () => {
    delete html.dataset.glass;
    delete html.dataset.glassLive;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    if (watch) cancelAnimationFrame(watch);
    unmark();
    delete html.dataset.glassFallback;
    clearBend();
  };

  /** The plain crossfade: no mask, the UA's own animation, no bend. */
  const fallback = () => {
    if (stopped) return;
    if (frame) cancelAnimationFrame(frame);
    if (watch) cancelAnimationFrame(watch);
    frame = 0;
    unmark();
    html.dataset.glassFallback = "";
    clearBend();
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

  /** One frame of the pictures and the bend: from the animation's own clock, the front, the tile nearest it, and where to put it. */
  const tick = () => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    const clock = findGlassAnimation();
    const now = typeof clock?.currentTime === "number" ? clock.currentTime : performance.now() - t0;
    const f = frontAt(Math.min(1, now / plan.ms), plan);
    const far = plan.radius;
    const sheets = ready.sheets;
    const pick = sheets ? pickTile(f.radius / far) : null;
    if (sheets && pick) {
      // the tile's world is 2 * HALF farthest-corner distances across, scaled onto the front; the sheet is `cols` by `rows` of them
      const { cols, rows } = sheetLayout(TILES.length, SHEET_COLS);
      const { col, row } = tileCell(pick.index, cols);
      const side = 2 * HALF * far * pick.scale;
      const size = `${(cols * side).toFixed(1)}px ${(rows * side).toFixed(1)}px`;
      const position = `${(plan.origin.x - side / 2 - col * side).toFixed(1)}px ${(plan.origin.y - side / 2 - row * side).toFixed(1)}px`;
      sheets.mask.setProperty("mask-size", size);
      sheets.mask.setProperty("mask-position", position);
      sheets.line.setProperty("background-size", size);
      sheets.line.setProperty("background-position", position);
      html.dataset.glassLive = "";
    }
    if (ready.bend && filters.length) {
      const peak = bendPxFor(plan.origin.y * 2) * f.bend;
      const bp = pickBendTile(f.radius / far);
      const side = 2 * HALF * far * bp.scale;
      for (const filter of filters) {
        filter.tiles.forEach((tile, i) => {
          if (!tile) return;
          if (i === bp.index) setAttrs(tile, { x: plan.origin.x - side / 2, y: plan.origin.y - side / 2, width: side, height: side });
          else if (tile.getAttribute("width") !== "0") tile.setAttribute("width", "0");
        });
        filter.pushes.forEach((p, c) => p?.setAttribute("scale", (filter.sign * 2 * BEND_MAX * peak * SPLITS[c]).toFixed(2)));
      }
    }
  };
  let t0 = 0;

  const begin = () => {
    if (stopped) return;
    try {
      if (typeof CSS === "undefined" || !("registerProperty" in CSS)) return fallback();
      watch = requestAnimationFrame(look);
      if (ready.bend) {
        filters = [bendFilter(GLASS_IDS.old, 1), bendFilter(GLASS_IDS.new, -1)];
        html.dataset.glass = "bend";
      }
      if (ready.sheets || ready.bend) {
        t0 = performance.now();
        tick();
      }
    } catch {
      fallback();
    }
  };
  t.ready.then(begin, () => undefined);
  return stop;
}
