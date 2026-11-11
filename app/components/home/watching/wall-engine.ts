import type { SiteVideo } from "~/types";
import { createWallGl, type WallGl } from "./wall-gl";
import {
  attachWallInput,
  createWallInput,
  createWallState,
  type Tile,
  type WallCtx,
} from "./wall-input";
import {
  atlasLayout,
  cellUv,
  columnOffset,
  focusWeight,
  hitTile,
  layoutTiles,
  tileSize,
  tileTransform,
  type Atlas,
} from "./wall-math";
import { createThumbs, type Thumbs } from "./wall-thumbs";

/**
 * The video wall: every thumbnail on one large, slowly drifting surface, drawn with raw WebGL1.
 * Ported from the `Wall` module of docs/redesign/mockups/home-v4.html. Each tile is its own quad,
 * so the focus effect moves and scales whole tiles instead of bending pixels: the focused video
 * grows a little, its neighbours make room, everything else softens a touch (a biased mipmap
 * lookup, so the faint blur is always on).
 *
 * The engine owns its canvas. `prepare()` creates the GL context, program and atlas texture and
 * starts loading thumbnails, so the wall is warm when the layer opens. `mount()` puts the canvas
 * into the layer and wires the pointer, wheel and keyboard, `unmount()` takes it out again but
 * keeps the GL objects for an instant re-open, and `dispose()` (when the home page goes away)
 * frees everything and loses the context.
 *
 * This file keeps the state, the frame and the lifecycle. The GL context and shaders are
 * wall-gl.ts, the thumbnails wall-thumbs.ts, the listeners and picking (keyboard, spec 8.10)
 * wall-input.ts and the maths wall-math.ts.
 */

export type WallEls = {
  /** The canvas goes in here. */
  host: HTMLElement;
  /** The chip under the focused tile: a `b` (title) and a `span` (channel). */
  chip: HTMLElement;
  hint: HTMLElement;
};

/** The part of the wall the detail view drives; the no-WebGL grid supplies its own. */
export type WallControl = Pick<WallEngine, "freeze" | "thaw" | "hold" | "rectOf">;

export type WallEngine = {
  prepare(): void;
  /** True once `prepare()` has run and the wall could not start (no WebGL, a failed shader). */
  hasFailed(): boolean;
  mount(els: WallEls): void;
  start(): void;
  stop(): void;
  unmount(): void;
  /** While a video is open the wall stops, keeps that tile in focus, and takes no input. */
  freeze(key?: string): void;
  thaw(): void;
  /** Stops drawing altogether, under the cover of the detail view. */
  hold(v: boolean): void;
  /** The tile's current rectangle in viewport coordinates, or null when it is not in view. */
  rectOf(key: string): DOMRect | null;
  /** Move the keyboard focus one tile: (1, 0) right, (0, 1) down. */
  focusNext(dx: number, dy: number): void;
  openFocused(): void;
  dispose(): void;
};

/** Pixels the whole wall pans sideways per second. */
const DRIFT = 3;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const HINT_FINE =
  "Drag or scroll to look around. Hover a video to bring it forward, click to open it.";
const HINT_TOUCH = "Drag to look around. Tap a video to open it.";
const HINT_NO_GL = "The wall could not start in this browser.";
const STAGE_LABEL = "Video wall. Use the arrow keys to move, Enter to open.";

/** Client only: creates a canvas. The GL context is made later, by `prepare()`. */
export function createWall(
  videos: SiteVideo[],
  opts: {
    fine: boolean;
    reducedMotion: boolean;
    onPick: (index: number, rect: DOMRect, key: string) => void;
  },
): WallEngine {
  const FINE = opts.fine;
  const REDUCE = opts.reducedMotion;
  const canvas = document.createElement("canvas");
  canvas.className = "wall-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "group");
  canvas.setAttribute("aria-label", STAGE_LABEL);

  let wgl: WallGl | null = null;
  let thumbs: Thumbs | null = null;
  let atlas: Atlas | null = null;
  let uvs: Array<[number, number, number, number]> = [];

  let prepared = false;
  let failed = false;
  let disposed = false;
  let els: WallEls | null = null;
  let listeners: AbortController | null = null;
  let running = false;
  let raf = 0;
  let last = 0;

  // interaction and view state, shared with the input code through the context
  const st = createWallState();
  const { pan, vel, mouse } = st;
  const focus = { x: 0, y: 0 };
  let lens = 0;
  let speedMul = 1;
  let chipIdx = -1;
  let chipW = 0;
  let chipH = 0;
  let cursor = "";
  const fstate = new Map<string, number>();
  const seen = new Set<string>();

  // ---- building

  function prepare() {
    if (prepared || disposed) return;
    prepared = true;
    const w = createWallGl(canvas);
    if (!w) {
      failed = true;
      return;
    }
    const a = atlasLayout(videos.length, window.innerWidth < 700);
    atlas = a;
    uvs = a.cells.map((_, i) => cellUv(i, a));
    thumbs = createThumbs(w.gl, a, videos, () => running);
    wgl = w;
    // size the drawing buffer now, in idle time: the layer is fixed to the viewport, so `start()`
    // finds this size and does not resize inside the frame that opens the layer
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * d);
    canvas.height = Math.round(window.innerHeight * d);
  }

  function sizes() {
    st.vw = canvas.clientWidth;
    st.vh = canvas.clientHeight;
    const r = canvas.getBoundingClientRect();
    st.ox = r.left;
    st.oy = r.top;
    st.size = tileSize(st.vw);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(st.vw * dpr);
    const H = Math.round(st.vh * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
  }

  const ctx: WallCtx = { canvas, st, running: () => running };
  const input = createWallInput(ctx, opts.onPick, sizes);

  // ---- drawing

  /** Moves the chip under the focused tile and fills in its title and channel. */
  function placeChip(list: Tile[]) {
    const chip = els?.chip;
    const top = list[list.length - 1];
    if (chip && !st.frozen && top && top.key === st.hoverKey && top.f > 0.5) {
      // title and channel sit right under the video
      if (chipIdx !== top.idx) {
        const b = chip.querySelector("b");
        const s = chip.querySelector("span");
        if (b) b.textContent = videos[top.idx].title;
        if (s) s.textContent = videos[top.idx].channel;
        chipIdx = top.idx;
        chipW = chip.offsetWidth;
        chipH = chip.offsetHeight;
      }
      const x = clamp(top.cx - chipW / 2, 12, Math.max(12, st.vw - chipW - 12));
      let y = top.cy + top.h / 2 + 14;
      if (y + chipH > st.vh - 12) y = top.cy - top.h / 2 - 14 - chipH;
      chip.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      chip.classList.add("on");
    } else chip?.classList.remove("on");
  }

  function frame(now: number) {
    if (!running || !wgl || !atlas) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (st.held) return;
    const { gl: g, uniforms: U } = wgl;
    const { vw, vh, size } = st;
    const { cw, ch, pitchX, pitchY } = size;
    const hovering = FINE && mouse.inside && !st.dragging;
    // the wall settles while you look at something, then drifts on again
    speedMul +=
      ((hovering || st.kbd !== null || st.frozen ? 0 : 1) - speedMul) * Math.min(1, dt * 2.5);
    if (!REDUCE) st.t += dt * speedMul;
    if (!st.dragging && !st.frozen) {
      pan.x += vel.x * dt;
      pan.y += vel.y * dt;
      const k = Math.pow(0.05, dt);
      vel.x *= k;
      vel.y *= k;
    }
    if (!REDUCE) pan.x += DRIFT * dt * speedMul;
    if (st.kbd && !st.frozen) {
      // the keyboard focus pans the wall just far enough to keep its tile in view
      const k = Math.min(1, dt * 6);
      const xc = st.kbd.cx * pitchX - pan.x + cw / 2;
      const yc = st.kbd.cy * pitchY - pan.y - columnOffset(st.t, st.kbd.cx) + ch / 2;
      const mx = Math.min(pitchX * 0.75, vw / 2);
      const my = Math.min(Math.max(pitchY * 0.75, 120), vh / 2);
      pan.x += (xc < mx ? xc - mx : xc > vw - mx ? xc - (vw - mx) : 0) * k;
      pan.y += (yc < my ? yc - my : yc > vh - my ? yc - (vh - my) : 0) * k;
    }
    const list = layoutTiles({
      panX: pan.x,
      panY: pan.y,
      vw,
      vh,
      pitchX,
      pitchY,
      t: st.t,
      count: atlas.cells.length,
    }) as Tile[];
    if (!st.frozen) {
      // nearest tile, gaps included, so the focus never drops between two videos
      st.hoverKey = hovering ? hitTile(list, mouse.x, mouse.y, size) : null;
      if (st.hoverKey === null && st.kbd && !st.dragging) {
        st.hoverKey = `${st.kbd.cx},${st.kbd.cy}`;
      }
    }
    const ft = st.hoverKey === null ? null : (list.find((tl) => tl.key === st.hoverKey) ?? null);
    lens += ((ft ? 1 : 0) - lens) * Math.min(1, dt * 7);
    if (ft) {
      const fx = ft.x + cw / 2;
      const fy = ft.y + ch / 2;
      if (lens < 0.08) {
        focus.x = fx;
        focus.y = fy;
      } else {
        const k = Math.min(1, dt * 12);
        focus.x += (fx - focus.x) * k;
        focus.y += (fy - focus.y) * k;
      }
    }
    seen.clear();
    for (const tl of list) {
      let f = fstate.get(tl.key) || 0;
      f += ((tl.key === st.hoverKey ? 1 : 0) - f) * Math.min(1, dt * 9);
      if (f > 0.002) {
        fstate.set(tl.key, f);
        seen.add(tl.key);
      } else f = 0;
      const cx = tl.x + cw / 2;
      const cy = tl.y + ch / 2;
      const dx = cx - focus.x;
      const dy = cy - focus.y;
      const w = lens * focusWeight(dx, dy, pitchX);
      const tr = tileTransform({ cx, cy, dx, dy, f, weight: w, cw, ch });
      tl.f = f;
      tl.cx = tr.cx;
      tl.cy = tr.cy;
      tl.w = tr.w;
      tl.h = tr.h;
      tl.rad = tr.rad;
    }
    for (const k of fstate.keys()) if (!seen.has(k)) fstate.delete(k);
    list.sort((a, b) => a.f - b.f);

    if (!st.frozen) thumbs?.pumpFrame();

    g.viewport(0, 0, canvas.width, canvas.height);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.uniform2f(U.uRes, vw, vh);
    g.uniform1f(U.uTime, REDUCE ? 0 : now / 1000);
    const loaded = thumbs?.loaded;
    for (const tl of list) {
      const L = tl.cx - tl.w / 2;
      const T = tl.cy - tl.h / 2;
      if (tl.f > 0.01) {
        wgl.quad(L, T + 18 * tl.f, tl.w, tl.h, 2, 0.5 * tl.f, 70, tl.rad); // a soft shadow lifts it off the wall
        wgl.quad(L, T, tl.w, tl.h, 1, 0.5 * tl.f, 70, tl.rad); // and a faint orange glow
      }
      const i = tl.idx;
      const uv = uvs[i];
      g.uniform4f(U.uCell, uv[0], uv[1], uv[2], uv[3]);
      g.uniform1f(U.uBias, 1.35 * lens * (1 - tl.f));
      g.uniform1f(U.uDim, 1 - 0.16 * lens * (1 - tl.f));
      g.uniform1f(U.uLoaded, loaded?.[i] ?? 0);
      wgl.quad(L, T, tl.w, tl.h, 0, 1, 0, tl.rad);
    }
    st.tiles = list;

    placeChip(list);
    const cur = st.dragging ? "grabbing" : st.hoverKey ? "pointer" : "grab";
    if (cur !== cursor) canvas.style.cursor = cursor = cur;
  }

  // ---- lifecycle

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    els?.chip.classList.remove("on");
    canvas.style.cursor = "";
    cursor = "";
    mouse.inside = false;
    st.frozen = st.held = false;
    st.dragging = false;
    st.down = null;
    st.kbd = null;
    thumbs?.kick(); // thumbnails that arrive while the layer is closed still go up
  }

  function unmount() {
    stop();
    listeners?.abort();
    listeners = null;
    canvas.remove();
    els = null;
  }

  return {
    prepare,

    mount(next) {
      if (els) unmount();
      els = next;
      next.host.appendChild(canvas);
      next.hint.textContent = FINE ? HINT_FINE : HINT_TOUCH;
      chipIdx = -1;
      listeners = new AbortController();
      attachWallInput(canvas, input.handlers, listeners.signal);
    },

    start() {
      prepare();
      if (!wgl || !els) {
        if (failed && els) els.hint.textContent = HINT_NO_GL;
        return;
      }
      lens = 0;
      st.hoverKey = null;
      st.kbd = null;
      fstate.clear();
      st.frozen = st.held = false;
      sizes();
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },

    stop,

    unmount,

    hasFailed: () => failed,

    freeze(key) {
      st.frozen = true;
      if (key) st.hoverKey = key;
    },
    thaw() {
      st.frozen = false;
    },
    hold(v) {
      st.held = v;
    },
    rectOf: input.rectOf,

    focusNext: input.focusNext,
    openFocused: input.openFocused,

    dispose() {
      if (disposed) return;
      unmount();
      disposed = true;
      thumbs?.dispose();
      wgl?.dispose();
      wgl = null;
      thumbs = null;
      st.tiles = [];
    },
  };
}
