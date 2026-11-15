/**
 * The warm-up of the bend's filters (R56, spec 4): they are run once where nobody sees it, so the first change after a load does no
 * first-time work. See `warmGlass`.
 */
import { GLASS_IDS, mapId, pushId } from "./glass-filter";
import { HALF, sheetLayout, TILES, tileCell } from "./glass-field";
import { calm, changeRunning, mark, ready, SHEET_COLS } from "./glass-state";
import { warmLoop, type WarmSize } from "./glass-warm-loop";

/** The side of the square in the screen's corner the sheets are drawn in during the warm-up, in CSS px. */
const CORNER = 3;
/** How long to wait for one frame of the warm-up before giving up on it. */
const WARM_FRAME_TIMEOUT_MS = 400;
const nextFrame = () =>
  new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), WARM_FRAME_TIMEOUT_MS);
    requestAnimationFrame(() => {
      window.clearTimeout(timer);
      resolve(true);
    });
  });

let warming = false;
/**
 * Runs both bend filters once where nobody sees it (R56, spec 4), so the first change after a load does no first-time work (the shaders,
 * the bend's tiles' and the vignette's upload to the GPU, each tile's first use as the map): two full-screen elements with nothing in
 * them, each with a filter, nearly clear (opacity 0.01 so the browser does not skip them), the map put through every tile in turn
 * (a frame each) and the pushes set as in a change; and the three sheets (mask, glow, shade) drawn once the same way; then everything
 * put back. Called after `glass-bend-ready` and again after the vignette is remade for a new screen size; marks `glass-warm` and sets
 * `ready.warm`. Never while a change runs: it waits for the marks on <html> to go, and a change that starts in the middle of it (it
 * runs without the bend: `ready.warm` is still false) stops it and it starts again afterwards. A vignette that is remade while a
 * warm-up runs makes that warm-up not count (`warmLoop`). In a hidden tab it waits until the tab shows again (a hidden tab draws no
 * frames to warm).
 */
export async function warmGlass(): Promise<void> {
  if (warming || ready.warm || !ready.bend || !ready.vignette || typeof document === "undefined") return;
  warming = true;
  try {
    await warmLoop({
      calm,
      hidden: () => document.hidden,
      untilVisible: () => new Promise<void>((resolve) => document.addEventListener("visibilitychange", () => resolve(), { once: true })),
      vignette: () => ready.vignette,
      screen: () => ({ w: window.innerWidth, h: window.innerHeight }),
      warmOnce,
      isWarm: () => ready.warm,
      markWarm: () => {
        ready.warm = true;
        mark("glass-warm");
      },
    });
  } catch {
    /* the bend is not used without the warm-up: ready.warm stays false */
  } finally {
    warming = false;
  }
}

/** One warm-up: true when it ran its frames and no change started during it. */
async function warmOnce({ w, h }: WarmSize): Promise<boolean> {
  const side = 2 * HALF * Math.hypot(w / 2, h / 2);
  const filters = [GLASS_IDS.old, GLASS_IDS.new] as const;
  const hosts = filters.map((f) => {
    const el = document.createElement("div");
    el.dataset.glassWarm = "";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `position:fixed;inset:0;pointer-events:none;opacity:0.01;filter:url(#${f})`;
    document.body.appendChild(el);
    return el;
  });
  // the three sheets too (the mask, the glow, the shade): their first draw, with the tile in the middle of the ladder laid so that its middle
  // is under a 3 px square in the screen's corner (what is drawn is that square at 1% opacity: nobody can see it; the pictures are what is
  // warmed, and they are drawn whole)
  if (ready.sheetUrls) {
    const { cols, rows } = sheetLayout(TILES.length, SHEET_COLS);
    const mid = Math.floor(TILES.length / 2);
    const { col, row } = tileCell(mid, cols);
    const size = `${(cols * side).toFixed(1)}px ${(rows * side).toFixed(1)}px`;
    const position = `${(CORNER / 2 - side / 2 - col * side).toFixed(1)}px ${(CORNER / 2 - side / 2 - row * side).toFixed(1)}px`;
    const draw = (extra: string) => {
      const el = document.createElement("div");
      el.dataset.glassWarm = "";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = `position:fixed;left:0;top:0;width:${CORNER}px;height:${CORNER}px;pointer-events:none;opacity:0.01;background-repeat:no-repeat;${extra}`;
      document.body.appendChild(el);
      hosts.push(el);
    };
    const u = ready.sheetUrls;
    draw(`background-color:#000;mask-image:url("${u.mask}");mask-repeat:no-repeat;mask-size:${size};mask-position:${position}`);
    draw(`background-image:url("${u.glow}");background-size:${size};background-position:${position};mix-blend-mode:plus-lighter`);
    draw(`background-image:url("${u.shade}");background-size:${size};background-position:${position}`);
  }
  const undo = () => {
    for (const host of hosts) host.remove();
    for (const f of filters) {
      document.getElementById(mapId(f))?.setAttribute("width", "0");
      for (const c of ["r", "g", "b"] as const) document.getElementById(pushId(f, c))?.setAttribute("scale", "0");
    }
  };
  // a change that starts in the middle of it takes everything away in the same task (the mark on <html> is watched), not a frame later
  let aborted = false;
  const watch = new MutationObserver(() => {
    if (!changeRunning()) return;
    aborted = true;
    undo();
  });
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-change-kind"] });
  try {
    for (let i = 0; i < ready.bendTiles.length; i++) {
      for (const f of filters) {
        const map = document.getElementById(mapId(f));
        map?.setAttribute("href", ready.bendTiles[i]);
        map?.setAttribute("x", (w / 2 - side / 2).toFixed(1));
        map?.setAttribute("y", (h / 2 - side / 2).toFixed(1));
        map?.setAttribute("width", side.toFixed(1));
        map?.setAttribute("height", side.toFixed(1));
        for (const c of ["r", "g", "b"] as const) document.getElementById(pushId(f, c))?.setAttribute("scale", "12");
      }
      if (!(await nextFrame()) || aborted || changeRunning()) return false;
    }
    return !aborted && !changeRunning();
  } finally {
    watch.disconnect();
    undo();
  }
}
