/**
 * Runs the glass front on a change's view transition, from the transition's `ready` (the pseudo-elements exist then).
 *
 * The reveal needs nothing from scripts while the front is small: glass.css animates `--glass-p` (the eased progress) with a
 * CSS animation on the pseudo-elements that use it and draws a circle with a soft edge from that one number. This module moves
 * the pictures that glass-prepare.ts has made with the front, once per frame (the tile nearest the front, scaled onto it; a few CSS
 * declarations and SVG attributes written, no React state: one map picture and three pushes in each bend filter, R56), and it checks that the CSS animation really runs (`judgeGlass`, frame
 * by frame: the animation is listed, advances and has progress). If anything fails, or the check does not see it run (a browser
 * that does not animate a registered custom property on these pseudo-elements, one without `CSS.registerProperty`),
 * `data-glass-fallback` goes on <html> and glass.css gives the plain UA crossfade instead, so a change never hangs on a hidden
 * new page.
 */
import type { ChangePlan } from "../../lib/page-change";
import { GLASS_IDS, mapId, pushId, type GlassFilterId } from "./glass-filter";
import { HALF, pickBendTile, pickTile, sheetLayout, tileCell, TILES } from "./glass-field";
import { createGuard, createSession } from "./glass-guard";
import { BEND_NEW, BEND_OLD, bendPxFor, frontAt, judgeGlass, pushScale, SPLIT } from "./glass-math";
import { ready, refreshVignette, SHEET_COLS } from "./glass-prepare";
import { BEND_RANGE } from "./glass-texture";

/** Sets an attribute only when it changes (a write to an SVG filter's attribute makes the filter be walked again). */
const setAttr = (el: Element | null, name: string, value: string) => {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
};

/** The tab's rule about the bend (glass-guard.ts): made once, on the first change; a reload of the tab clears an earlier `off`. */
let session: ReturnType<typeof createSession> | undefined;
const bendSession = () => {
  if (session) return session;
  let storage: Storage | null = null;
  let reloaded = false;
  try {
    storage = window.sessionStorage;
    reloaded = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload";
  } catch {
    /* no storage */
  }
  return (session = createSession(storage, { reloaded }));
};

/** The CSS animation that runs `--glass-p`, if the browser lists it (its clock is the best one for the pictures and the bend). */
function findGlassAnimation(): Animation | undefined {
  try {
    return document.getAnimations().find((a) => (a as CSSAnimation).animationName === "glass-p");
  } catch {
    return undefined;
  }
}

/** The pieces of one bend filter the tick moves: its map picture and its three pushes (red, green, blue). */
interface BendFilter {
  map: Element | null;
  pushes: Array<Element | null>;
  /** The push's direction: +1 for the old page, -1 for the new. */
  sign: 1 | -1;
  /** The filter's share of the push: `BEND_OLD` for the old page, `BEND_NEW` for the new (R58: both whole). */
  share: number;
}
const bendFilter = (id: GlassFilterId, sign: 1 | -1, share: number): BendFilter => ({
  map: document.getElementById(mapId(id)),
  pushes: (["r", "g", "b"] as const).map((c) => document.getElementById(pushId(id, c))),
  sign,
  share,
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
      f.map?.setAttribute("width", "0");
    }
  };
  /** The guard's drop (four slow frames in a row): the bend is off for the rest of this change; the edge, glow and shade carry on. */
  const dropBend = () => {
    delete html.dataset.glass;
    clearBend();
    filters = [];
    bendSession().trip();
  };
  const guard = createGuard();
  let lastTs = 0;
  /** The index of the bend tile that is the map's source now (-1: none yet). */
  let tileShown = -1;
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
  const tick = (ts: number = performance.now()) => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    if (filters.length) {
      if (lastTs && guard.frame(ts - lastTs) === "drop") dropBend();
      lastTs = ts;
    }
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
      // the one map picture of each filter: the tile for the front (its source swapped when the front moves on to the next tile) laid over
      // the screen (a tile reaches past the farthest corner), and the three pushes
      const peak = 2 * BEND_RANGE * bendPxFor(plan.vh) * f.bend;
      const bp = pickBendTile(f.radius / far);
      const side = 2 * HALF * far * bp.scale;
      const geometry = {
        x: (plan.origin.x - side / 2).toFixed(1),
        y: (plan.origin.y - side / 2).toFixed(1),
        width: side.toFixed(1),
        height: side.toFixed(1),
      };
      const swap = bp.index !== tileShown;
      tileShown = bp.index;
      for (const filter of filters) {
        if (swap) filter.map?.setAttribute("href", ready.bendTiles[bp.index]);
        for (const [name, value] of Object.entries(geometry)) setAttr(filter.map, name, value);
        filter.pushes.forEach((p, c) => setAttr(p, "scale", pushScale(filter.sign, filter.share, peak, SPLITS[c]).toFixed(2)));
      }
    }
  };
  let t0 = 0;

  const begin = () => {
    if (stopped) return;
    try {
      if (typeof CSS === "undefined" || !("registerProperty" in CSS)) return fallback();
      watch = requestAnimationFrame(look);
      // the bend needs its sheet, a vignette made for this screen's size and the warm-up done for it (a screen that was resized since, or a
      // change before the warm-up: no bend this time, and a new vignette), and a tab whose guard has not switched it off (two changes tripped it)
      const sized = ready.bend && ready.vignette?.w === plan.vw && ready.vignette.h === plan.vh;
      if (ready.bend && !sized) void refreshVignette();
      const bend = sized && ready.warm && !bendSession().off();
      if (bend) {
        filters = [bendFilter(GLASS_IDS.old, 1, BEND_OLD), bendFilter(GLASS_IDS.new, -1, BEND_NEW)];
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
