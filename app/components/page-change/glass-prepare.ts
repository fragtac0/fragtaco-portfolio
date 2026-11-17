/**
 * Makes the glass front's pictures, in idle time, once per page load (follow-ups spec 4; the tiles are explained in glass-field.ts):
 * sheets of tiles for the new page's mask, the glow and the shade, the bend's tiles (data addresses; each SVG filter of
 * glass-filter.tsx has one map picture whose source glass-run.ts swaps to the tile for the front, R56; R58: a tile holds the push's
 * strength only), and the vignette (glass-vignette.ts: the hero's noise gradient, fixed on the screen, damped towards the screen's edges;
 * made again when the screen changes size, a few rows at a time as it costs more than the tiles do: R129). Then `warmGlass` runs the bend's
 * filters once where nobody sees them, so the first change after a load does no first-time work (R56, spec 4).
 *
 * The work is done a tile at a time with a gap between (so none is a long task) and it stops while a change runs (the marks on
 * <html> say so), so it can never land inside the 2.25 s of a reveal; most important first: the glow and shade gradients (only
 * strings, injected at once), the mask's sheet, the glow's, the shade's, then the bend. A change that starts before they are ready,
 * or after a step failed, draws what it can: plain gradients for the edge, the glow and the shade, and no bend if its tiles or the
 * vignette for this screen's size are missing. Nothing at all is made when the browser has no View Transitions (the page just
 * changes) or the visitor prefers reduced motion (the change is a 120 ms fade).
 */
import { glowGradient, glowTilePixels, maskTilePixels, shadeGradient, shadeTilePixels } from "./glass-edge";
import { GLASS_IDS, mapId, vignetteId } from "./glass-filter";
import { BEND_TILES, sheetLayout, tileCell, TILES } from "./glass-field";
import { bendPxFor, isChromium } from "./glass-math";
import { bendTilePixels } from "./glass-texture";
import { calm, mark, ready, SHEET_COLS } from "./glass-state";
import { maxPush, vignetteRows, vignetteSize } from "./glass-vignette";
import { warmGlass } from "./glass-warm";

// the same names, as before the split (glass-run.ts reads them from here)
export { ready, SHEET_COLS, warmGlass };

/** Each tile's size in pixels: the mask's and the shade's soft edge needs little, the glow's narrow glint more. */
const MASK_N = 128;
const GLOW_N = 192;
const SHADE_N = 128;
const BEND_N = 128;
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
  return img;
};
/** Pictures kept for the page's life, so the browser keeps them decoded. */
const kept: HTMLImageElement[] = [];

/** Draws a tile for each front radius on one sheet, `perChunk` tiles at a time with a calm gap between; returns the sheet's address. */
async function makeSheet(radii: readonly number[], n: number, tile: (n: number, front: number) => Uint8ClampedArray<ArrayBuffer>, perChunk: number) {
  const { cols, rows } = sheetLayout(radii.length, SHEET_COLS);
  const { canvas, ctx } = canvasOf(cols * n, rows * n);
  await calm();
  for (let i = 0; i < radii.length; i++) {
    const { col, row } = tileCell(i, cols);
    ctx.putImageData(new ImageData(tile(n, radii[i]), n, n), col * n, row * n);
    if ((i + 1) % perChunk === 0 && i + 1 < radii.length) await calm();
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

const ON = 'html[data-change-kind="radial"]:not([data-glass-fallback])';
const MASK_AT = `${ON}::view-transition-new(root)`;
const GLOW_AT = `${ON}::view-transition-group(glass-glow)`;
const SHADE_AT = `${ON}::view-transition-group(glass-shade)`;
/** The same places, once the tick has put a front's tile there (`data-glass-live`). */
const live = (at: string) => `html[data-glass-live]${at.slice("html".length)}`;

let started = false;
let gradientsDone = false;

/** The glow and shade gradients (only strings): at once, so even a change in the first moments has them while the front is small. */
function injectGradients(): void {
  if (gradientsDone) return;
  gradientsDone = true;
  try {
    const origin = "var(--change-x) var(--change-y)";
    const front = "var(--glass-front)";
    const band = "var(--glass-band)";
    inject(
      "glassGlow",
      `${GLOW_AT}{background-image:${glowGradient(origin, front, band)}}\n${SHADE_AT}{background-image:${shadeGradient(origin, front, band)}}`,
    );
  } catch {
    /* no glow or shade while the front is small */
  }
}

/** The address of the vignette picture in the filters now (a blob address; revoked when a new one takes its place). */
let vignetteUrl: string | null = null;

/** How long the vignette's noise is made for at a time, in ms, before a calm gap (every row costs the same: no long task). */
const VIGNETTE_SLICE_MS = 6;

/** Makes the vignette for a screen `w` by `h` and gives it to both bend filters. Returns whether it is in. */
async function makeVignette(w: number, h: number): Promise<boolean> {
  const size = vignetteSize(w, h);
  const { canvas, ctx } = canvasOf(size.w, size.h);
  const pixels = new Uint8ClampedArray(size.w * size.h * 4);
  const push = maxPush(bendPxFor(h));
  for (let y = 0; y < size.h; ) {
    const until = performance.now() + VIGNETTE_SLICE_MS;
    while (y < size.h && performance.now() < until) {
      vignetteRows(pixels, w, h, push, y, y + 1);
      y++;
    }
    if (y < size.h) await calm();
  }
  ctx.putImageData(new ImageData(pixels, size.w, size.h), 0, 0);
  const url = await toBlobUrl(canvas);
  for (const f of [GLASS_IDS.old, GLASS_IDS.new]) {
    const el = document.getElementById(vignetteId(f));
    if (!el) {
      URL.revokeObjectURL(url);
      return false;
    }
    el.setAttribute("href", url);
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
  }
  warm(url);
  // a remake for a new screen size: the earlier picture's address is let go (no filter uses it any more)
  if (vignetteUrl) URL.revokeObjectURL(vignetteUrl);
  vignetteUrl = url;
  ready.vignette = { w, h };
  mark("glass-vignette-ready");
  return true;
}

let remaking = false;
/**
 * Makes the vignette again for this screen's size (a window that was resized, a phone turned): not while a change runs, and one at a
 * time. It takes a while now (the noise, a few rows at a time), so a screen that was resized meanwhile gets another round, a few at most.
 */
export async function refreshVignette(): Promise<void> {
  if (remaking || !ready.bend) return;
  remaking = true;
  try {
    for (let round = 0; round < 4; round++) {
      await calm();
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (ready.vignette?.w === w && ready.vignette.h === h) break;
      ready.warm = false; // a new size: the filters have first-time work to do again
      if (!(await makeVignette(w, h))) return;
    }
    remaking = false;
    void warmGlass();
  } catch {
    /* the bend stays off for this size */
  } finally {
    remaking = false;
  }
}

/**
 * Makes the pictures, a little at a time (see the top of the file). Called once the first page is up and the browser is idle.
 * Returns at once; the work goes on in the background.
 */
export function prepareGlass(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const chromium = isChromium(navigator.userAgent);
  void (async () => {
    try {
      const mask = await makeSheet(TILES, MASK_N, maskTilePixels, 1);
      const glow = await makeSheet(TILES, GLOW_N, glowTilePixels, 1);
      const shade = await makeSheet(TILES, SHADE_N, shadeTilePixels, 2);
      // the sheets' rules start with no size: nothing of the new page shows until the first tick sizes them (no flash at the start)
      const sheet = inject(
        "glassSheets",
        `${live(MASK_AT)}{mask-image:url("${mask}");mask-repeat:no-repeat;mask-size:0 0;mask-position:0 0}\n` +
          `${live(GLOW_AT)}{background-image:url("${glow}");background-size:0 0;background-position:0 0}\n` +
          `${live(SHADE_AT)}{background-image:url("${shade}");background-size:0 0;background-position:0 0}`,
      );
      const rules = Array.from(sheet?.cssRules ?? []).filter((r): r is CSSStyleRule => "style" in r);
      if (rules.length === 3) {
        ready.sheets = { mask: rules[0].style, glow: rules[1].style, shade: rules[2].style };
        ready.sheetUrls = { mask, glow, shade };
        mark("glass-sheets-ready");
      }
    } catch {
      /* the plain gradients draw the edge, the glow and the shade */
    }
    if (!chromium) return;
    try {
      await calm();
      if (!(await makeVignette(window.innerWidth, window.innerHeight))) throw new Error("the bend's filter is not in the page");
      // the bend's tiles, a picture each: each filter has one map picture whose source is the tile for the front (glass-run.ts). Data
      // addresses, so that swapping the source from one tile to the next is done in the frame that asks for it (a blob address is fetched
      // asynchronously, and a frame without its map would show the page pushed by half the scale), and kept (`kept`) so they stay in the cache.
      if (!document.getElementById(mapId(GLASS_IDS.old)) || !document.getElementById(mapId(GLASS_IDS.new))) throw new Error("the bend's filter is not in the page");
      const tiles: string[] = [];
      for (let i = 0; i < BEND_TILES.length; i++) {
        const { canvas, ctx } = canvasOf(BEND_N, BEND_N);
        ctx.putImageData(new ImageData(bendTilePixels(BEND_N, BEND_TILES[i]), BEND_N, BEND_N), 0, 0);
        tiles.push(canvas.toDataURL("image/png"));
        await calm(); // a gap after each tile, so none of them is a long task
      }
      for (const url of tiles) kept.push(warm(url));
      ready.bendTiles = tiles;
      ready.bend = true;
      mark("glass-bend-ready");
      let timer = 0;
      window.addEventListener("resize", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void refreshVignette(), 250);
      });
      await refreshVignette(); // a screen that changed size while the tiles were made (it warms the new size itself)
      await warmGlass();
    } catch {
      /* no bend */
    }
  })();
}

/**
 * Called once the first page is up. Under reduced motion, or without View Transitions, nothing is made; otherwise the gradients
 * are injected at once and the tiles are made when the browser has nothing better to do. Returns the cancel.
 */
export function prepareGlassWhenIdle(): () => void {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (reduced || !("startViewTransition" in document)) return () => undefined;
  injectGradients();
  const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) {
    const id = idle.call(window, prepareGlass, { timeout: 3000 });
    return () => (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(prepareGlass, 1500);
  return () => window.clearTimeout(id);
}
