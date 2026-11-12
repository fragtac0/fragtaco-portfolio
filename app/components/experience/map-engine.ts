// The Mars map's canvas (spec 9.1, 9.2): one 2D canvas, tiles from the pyramid in `public/mars/`, the picture's
// own edge fade on top. It draws only when the view changes or a tile arrives (one `requestAnimationFrame` at a
// time, none while idle). The DOM layers (route, markers: Task 19) follow through `onView`, which the page turns
// into CSS variables, so no React state changes per frame.
import { GROUND, rgba } from "../../styles/tokens";
import { edgeBands, EDGE_STOPS, planDraw } from "./draw-plan";
import type { Manifest } from "./geo";
import { createTileCache } from "./tile-cache";
import { tilesFor, type Tile } from "./tiles";
import { clampView, exploreScale, FLY_MS, fitScale, fitView, flyTo, type View } from "./view";

export type MapOptions = {
  /** Reduced motion: every move is instant. */
  reduced: boolean;
  /** The view changed (once per frame while it moves, and once at the start). */
  onView(v: View): void;
  /** The first tile reached the canvas. */
  onPaint?(): void;
};

export type MapApi = {
  /** The view now (halfway along a move while one runs). */
  view(): View;
  /** The view the map is moving to, or its view now when it is still. */
  target(): View;
  /** Is a move between the overview and explore running? */
  flying(): boolean;
  /**
   * Go to a view (made legal first). With `animate` it flies there: `FLY_MS` when either end is the overview,
   * `STEP_MS` otherwise, or `ms`. Reduced motion, or no `animate`, is instant.
   */
  setView(v: View, animate?: boolean, ms?: number): void;
  /** Measure the canvas again (the page calls it when its box changes; the map also watches the canvas itself). */
  resize(): void;
  destroy(): void;
};

/** A move inside explore (a `+` press, a double tap). */
export const STEP_MS = 260;

const MAX_DPR = 2;
/** In the overview, this many of the tiles explore starts with (the ones nearest the centre) are fetched ahead of the first zoom. */
const AHEAD = 9;
const same = (a: View, b: View) => a.cx === b.cx && a.cy === b.cy && a.scale === b.scale;

export function createMap(canvas: HTMLCanvasElement, m: Manifest, o: MapOptions): MapApi {
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("no 2d canvas");

  let vw = 1;
  let vh = 1;
  let dpr = 1;
  let cur: View = { cx: m.size / 2, cy: m.size / 2, scale: 1 };
  let anim: { from: View; to: View; t0: number; ms: number } | null = null;
  let raf = 0;
  let dead = false;
  let painted = false;
  let sized = false;
  let wantKey = "";

  const cache = createTileCache(() => schedule());
  const baseTiles = [{ z: 0, x: 0, y: 0 }, ...[0, 1].flatMap((y) => [0, 1].map((x) => ({ z: 1, x, y })))];

  const atFit = (v: View) => v.scale <= fitScale(vw, vh, m) * 1.001;

  function schedule() {
    if (!raf && !dead) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (dead) return;
    if (anim) {
      const t = (performance.now() - anim.t0) / anim.ms;

      if (t >= 1) {
        cur = anim.to;
        anim = null;
      } else {
        cur = clampView(flyTo(anim.from, anim.to, t), vw, vh, m);
      }
    }
    draw();
    o.onView(cur);
    if (anim) schedule();
  }

  /** The tiles to fetch: the coarse levels first (they are what an unfinished frame is drawn from), then the view's, nearest the centre first, then, in the overview, a few of the tiles explore starts with. */
  function request(tiles: Tile[]) {
    const near = (t: Tile) => Math.hypot(t.left + t.size / 2 - vw / 2, t.top + t.size / 2 - vh / 2);
    const needed = [...tiles].sort((a, b) => near(a) - near(b));
    const ahead = atFit(cur) && !anim ? tilesFor({ ...cur, scale: exploreScale(vw, vh, m) }, vw, vh, m).sort((a, b) => near(a) - near(b)).slice(0, AHEAD) : [];
    const key = [...needed, ...ahead].map((t) => `${t.z}/${t.x}_${t.y}`).join();

    if (key === wantKey) return; // nothing new to ask for
    wantKey = key;
    cache.want([...baseTiles, ...needed, ...ahead]);
  }

  function draw() {
    const tiles = tilesFor(cur, vw, vh, m);

    request(tiles);
    const pieces = planDraw(tiles, m.tile, dpr, (z, x, y) => cache.get(z, x, y) !== undefined);

    // Nothing to draw yet: leave the canvas as it is (clear), so the page's first picture shows through.
    if (pieces.length === 0) return;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, vw, vh);
    ctx!.imageSmoothingEnabled = true;
    ctx!.imageSmoothingQuality = "high";
    for (const p of pieces) {
      const img = cache.get(p.z, p.x, p.y);

      if (img) ctx!.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
    }
    for (const b of edgeBands(cur, vw, vh, m)) {
      const g = ctx!.createLinearGradient(b.x0, b.y0, b.x1, b.y1);

      for (const [at, a] of EDGE_STOPS) g.addColorStop(at, rgba(GROUND, a));
      ctx!.fillStyle = g;
      ctx!.fillRect(b.x, b.y, b.w, b.h);
    }
    if (!painted) {
      painted = true;
      o.onPaint?.();
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width));
    const nh = Math.max(1, Math.round(r.height));
    const nd = Math.min(MAX_DPR, window.devicePixelRatio || 1);

    if (sized && nw === vw && nh === vh && nd === dpr) return;
    // the overview stays the overview when the screen changes shape (and is where the map starts)
    const wasFit = !sized || atFit(cur);

    sized = true;

    vw = nw;
    vh = nh;
    dpr = nd;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    cur = wasFit ? fitView(vw, vh, m) : clampView(cur, vw, vh, m);
    anim = null;
    wantKey = "";
    schedule();
  }

  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resize());

  observer?.observe(canvas);
  window.addEventListener("resize", resize);
  resize();
  cache.want(baseTiles);
  o.onView(cur);

  return {
    view: () => cur,
    target: () => (anim ? anim.to : cur),
    flying: () => anim !== null && anim.ms >= FLY_MS,
    setView(v, animate = false, ms) {
      const to = clampView(v, vw, vh, m);
      const from = cur;

      if (same(to, anim ? anim.to : cur)) return;
      if (!animate || o.reduced || ms === 0) {
        anim = null;
        cur = to;
      } else {
        anim = { from, to, t0: performance.now(), ms: ms ?? (atFit(from) || atFit(to) ? FLY_MS : STEP_MS) };
      }
      schedule();
    },
    resize,
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      cache.destroy();
    },
  };
}
