/**
 * Runs the glass front on a change's view transition, from the transition's `ready` (the pseudo-elements exist then).
 *
 * The reveal needs nothing from scripts while the front is small: glass.css animates `--glass-p` (the eased progress) with a
 * CSS animation on the pseudo-elements that use it and draws a circle with a soft edge from that one number. This module moves
 * the pictures that glass-prepare.ts has made with the front, once per frame (the tile nearest the front, scaled onto it; a few CSS
 * declarations and SVG attributes written, no React state), and it checks that the CSS animation really runs (`judgeGlass`, frame
 * by frame: the animation is listed, advances and has progress). If anything fails, or the check does not see it run (a browser
 * that does not animate a registered custom property on these pseudo-elements, one without `CSS.registerProperty`),
 * `data-glass-fallback` goes on <html> and glass.css gives the plain UA crossfade instead, so a change never hangs on a hidden
 * new page.
 */
import type { ChangePlan } from "../../lib/page-change";
import { GLASS_IDS, pushId, tileId, type GlassFilterId } from "./glass-filter";
import { BEND_TILES, HALF, pickBendTile, pickTile, sheetLayout, tileCell, TILES } from "./glass-field";
import { bendPxFor, frontAt, judgeGlass, SPLIT } from "./glass-math";
import { ready, refreshVignette, SHEET_COLS } from "./glass-prepare";
import { BEND_MAX } from "./glass-texture";

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
  /** The CSS animation that runs `--glass-p`, once it has been found (asking the document for its animations forces a style update: not every frame). */
  let clock: Animation | undefined;
  const glassClock = () => (clock ??= findGlassAnimation());
  /** `data-glass-live` is written once, at the first frame a tile is placed. */
  let live = false;

  const clearBend = () => {
    for (const f of filters) {
      for (const p of f.pushes) p?.setAttribute("scale", "0");
      for (const tile of f.tiles) tile?.setAttribute("width", "0");
    }
  };
  const unmark = () => {
    delete html.dataset.glass;
    delete html.dataset.glassLive;
    live = false;
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
      const anim = glassClock();
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
    const anim = glassClock();
    const now = typeof anim?.currentTime === "number" ? anim.currentTime : performance.now() - t0;
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
      for (const rule of [sheets.glow, sheets.shade]) {
        rule.setProperty("background-size", size);
        rule.setProperty("background-position", position);
      }
      if (!live) {
        live = true;
        html.dataset.glassLive = "";
      }
    }
    if (filters.length) {
      const peak = bendPxFor(plan.vh) * f.bend;
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
      // the bend needs its tiles and a vignette made for this screen's size (a screen that was resized since: no bend this time, and a new vignette)
      const bend = ready.bend && ready.vignette?.w === plan.vw && ready.vignette.h === plan.vh;
      if (ready.bend && !bend) void refreshVignette();
      if (bend) {
        filters = [bendFilter(GLASS_IDS.old, 1), bendFilter(GLASS_IDS.new, -1)];
        html.dataset.glass = "bend";
      }
      if (ready.sheets || bend) {
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
