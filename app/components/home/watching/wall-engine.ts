import type { SiteVideo } from "~/types";
import { createSlicer } from "../../../utils/idle";
import { watchContextLost } from "../context-lost";
import { drawTiles } from "./wall-draw";
import { createWallGl, type WallGl } from "./wall-gl";
import { createChip, createProbe } from "./wall-hud";
import { attachWallInput, createWallInput } from "./wall-input";
import {
  atlasLayout,
  cellUv,
  columnOffset,
  hitTile,
  layoutTiles,
  tileSize,
  type Atlas,
} from "./wall-math";
import { createPose } from "./wall-pose";
import { createThumbs, type Thumbs } from "./wall-thumbs";
import {
  createWallState,
  type Tile,
  type WallCtx,
  type WallEls,
  type WallEngine,
} from "./wall-types";

/**
 * The video wall: every thumbnail on one large, slowly drifting, flat surface, drawn with raw
 * WebGL1 (spec 7). Ported from the `Wall` module of docs/redesign/mockups/home-v4.html. All tiles
 * are one size and one brightness; alternate columns drift the opposite way. Hover is proximity
 * only (wall-proximity.ts): tiles near the pointer grow a little and ease away from it, with a
 * faint orange glow under the focused one, no lift and no dimming. The focused video's channel
 * keeps a hairline edge, and thumbnails arrive with a fade. The wall is drawn to a texture and
 * shown through a fish-eye at its borders (wall-warp.ts, wall-warp-pass.ts); the pointer goes
 * through the inverse before anything is hit.
 *
 * The engine owns its canvas. `prepare()` creates the GL context, program and atlas texture in
 * steps (idle time, or short slices once `setUrgent(true)`) and starts loading thumbnails, so the
 * wall is warm when the layer opens; if it is not, WatchingScene shows a flat placeholder until
 * the first frame. `mount()` puts the canvas into the layer and wires the pointer, wheel and
 * keyboard, `unmount()` takes it out again but keeps the GL objects for an instant re-open, and
 * `dispose()` (when the home page goes away) frees everything and loses the context.
 *
 * This file keeps the state, the frame and the lifecycle. The types are wall-types.ts, the GL
 * context and shaders wall-gl.ts, the thumbnails wall-thumbs.ts, the listeners and picking
 * wall-input.ts, the tiles' pose wall-pose.ts, their drawing wall-draw.ts, the chip wall-hud.ts
 * and the maths wall-math.ts.
 */

/** Pixels the whole wall pans sideways per second. */
const DRIFT = 3;

const HINT_FINE = "Drag or scroll to look around. Hover a video to look closer, click to open it.";
const HINT_KEYS = " Arrow keys and Enter work too.";
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
  const lost = watchContextLost(canvas);

  let wgl: WallGl | null = null;
  let thumbs: Thumbs | null = null;
  let atlas: Atlas | null = null;
  let uvs: Array<[number, number, number, number]> = [];

  let building: Promise<void> | null = null;
  let built = false;
  let failed = false;
  let disposed = false;
  let els: WallEls | null = null;
  let listeners: AbortController | null = null;
  let running = false;
  let raf = 0;
  let last = 0;
  let runToken = 0;
  let onFirstFrame: (() => void) | null = null;
  const slicer = createSlicer();

  // interaction and view state, shared with the input code through the context
  const st = createWallState();
  const { pan, vel, mouse } = st;
  let speedMul = 1;
  /** Where the tiles' nearness comes from, in flat wall coordinates. */
  let point: { x: number; y: number } | null = null;
  let cursor = "";
  const pose = createPose(videos);
  const chip = createChip(videos, st);
  const probe = createProbe(canvas);

  // ---- building: three steps the slicer spreads out (idle time, or ~8 ms a frame when urgent)

  function prepare(): Promise<void> {
    if (disposed) return Promise.resolve();
    building ??= slicer
      .run([
        () => {
          if (disposed) return;
          wgl = createWallGl(canvas);
          if (!wgl) failed = true;
        },
        () => {
          if (disposed || !wgl) return;
          const a = atlasLayout(videos.length, window.innerWidth < 700);
          atlas = a;
          uvs = a.cells.map((_, i) => cellUv(i, a));
          thumbs = createThumbs(wgl.gl, a, videos, () => running);
        },
        () => {
          if (disposed || !wgl) return;
          // size the drawing buffer now: the layer is fixed to the viewport, so `start()` finds
          // this size and does not resize inside the frame that opens the layer
          const d = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.round(window.innerWidth * d);
          canvas.height = Math.round(window.innerHeight * d);
          built = true;
        },
      ])
      .catch((err: unknown) => {
        failed = true;
        console.warn("The wall could not start.", err);
      });
    return building;
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

  // ---- the frame

  function frame(now: number) {
    if (!running || !wgl || !atlas) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (st.held) return;
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
    // the pointer, or the keyboard's tile, is what the tiles near it answer to; it holds while a
    // video opens
    if (!st.frozen) {
      point = hovering
        ? { x: mouse.x, y: mouse.y }
        : st.kbd && ft
          ? { x: ft.x + cw / 2, y: ft.y + ch / 2 }
          : null;
    }
    const focusIdx = ft ? ft.idx : null;
    pose.apply(list, { dt, size, hoverKey: st.hoverKey, point, focusIdx, reduced: REDUCE });
    if (!st.frozen) thumbs?.pumpFrame();

    drawTiles(wgl, list, { now, vw, vh, pitchX, reduced: REDUCE, uvs, loadedAt: thumbs?.loadedAt });
    wgl.endFrame(vw, vh);
    st.tiles = list;
    if (onFirstFrame) {
      const cb = onFirstFrame;
      onFirstFrame = null;
      cb();
    }

    const echo = pose.echoFor(focusIdx);
    chip.place(els?.chip, list, echo.size);
    probe("echo", String(echo.size));
    const cur = st.dragging ? "grabbing" : st.hoverKey ? "pointer" : "grab";
    if (cur !== cursor) canvas.style.cursor = cursor = cur;
  }

  // ---- lifecycle

  function stop() {
    running = false;
    runToken++;
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
      next.hint.textContent = FINE ? HINT_FINE + HINT_KEYS : HINT_TOUCH;
      chip.reset();
      listeners = new AbortController();
      attachWallInput(canvas, input.handlers, listeners.signal);
    },

    async start(opts) {
      const my = ++runToken;
      onFirstFrame = opts?.onFirstFrame ?? null;
      await prepare();
      if (my !== runToken || !els) return;
      if (!wgl || failed || lost.lost()) {
        els.hint.textContent = HINT_NO_GL;
        return;
      }
      st.hoverKey = null;
      st.kbd = null;
      point = null;
      pose.reset();
      st.frozen = st.held = false;
      sizes();
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },

    stop,

    unmount,

    hasFailed: () => failed || lost.lost(),
    ready: () => built,
    setUrgent: (on) => slicer.setUrgent(on),
    onLost: lost.subscribe,

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
