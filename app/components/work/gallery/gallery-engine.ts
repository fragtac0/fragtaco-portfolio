/**
 * The gallery engine: one canvas, one full-screen shader, a finite fitted grid of pictures.
 *
 * Ported from the ObsidianUI Art Gallery (vendor/obsidianui/art-gallery.jsx, webgl-surface.jsx),
 * Copyright (c) 2026 ObsidianUI, MIT License (vendor/obsidianui/LICENSE). Kept: three.js with an
 * orthographic camera and a ShaderMaterial on a 2 by 2 plane, the animation loop and the cleanup of
 * textures, geometry, material and renderer. Changed (spec 6.5): React and the text atlas are gone (this is a
 * plain module the wall page drives), the grid is fitted and finite, drag no longer scrolls or zooms
 * (it nudges and settles back), the grid drifts on a 50 s loop, the warp is 0.05, the tile under the pointer
 * grows 4%, a ring marks the focused tile, pictures stream into an atlas a few per frame.
 *
 * three.js is only ever loaded with `import("three")` inside `createGallery`, so it is its own chunk and the
 * server never sees it. The loop runs only while the tab is visible and the canvas is on screen; with
 * reduced motion there is no drift and it draws only when something changes; while only the drift moves it
 * draws at 15 frames a second (a sub-pixel step each), and at full rate while anything else eases.
 * `createGallery` resolves to null when WebGL or three cannot start. A lost context stops the loop for good
 * and calls `onLost`; `destroy` also loses the context on purpose, so a canvas is not reusable after it (the
 * page mounts a fresh canvas for a fresh gallery).
 */

import type * as THREE from "three";
import { watchContextLost } from "../../home/context-lost";
import { createAtlas } from "./gallery-atlas";
import { attachGalleryInput } from "./gallery-input";
import {
  GAP_PX,
  HOVER_GROW,
  NUDGE_HOLD_MS,
  NUDGE_MAX_PX,
  RADIUS_PX,
  WARP_K,
  driftAt,
  fitGrid,
  rubberBand,
  safeInsets,
  settleNudge,
  tileAt,
  type Grid,
  type Pt,
  type Safe,
} from "./gallery-math";
import { FRAGMENT, VERTEX } from "./gallery-shaders";
import { createTileState } from "./gallery-state";

export type GalleryOptions = {
  items: { src: string }[];
  /** Tile width over height: 16/9 for long form, 9/16 for short form. */
  aspect: number;
  reduced: boolean;
  onHover(i: number | null): void;
  /** The safe area (heading band, dock band, margin); a function is asked again at every `resize()`. Default: the 4% margin. */
  safe?: Safe | (() => Safe);
  /** A tap or click that did not drag landed on tile `i`. */
  onActivate?(i: number): void;
  /** The browser took the GL context away: the engine has stopped; show the plain grid. */
  onLost?(): void;
};

export type Gallery = {
  resize(): void;
  setPointer(x: number, y: number): void;
  clearPointer(): void;
  nudge(dx: number, dy: number): void;
  focus(i: number | null): void;
  destroy(): void;
};

const IDLE_FRAME_MS = 66;
const MAX_DPR = 2;

export async function createGallery(canvas: HTMLCanvasElement, opts: GalleryOptions): Promise<Gallery | null> {
  const count = opts.items.length;
  if (count === 0) return null;
  let T: typeof THREE;
  let renderer: THREE.WebGLRenderer;
  try {
    T = await import("three");
    renderer = new T.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false });
  } catch (err) {
    console.warn("The video wall could not start WebGL.", err);
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const reduced = opts.reduced;

  // ---- sizing and the grid (all CSS px)
  let vw = canvas.clientWidth || 1280;
  let vh = canvas.clientHeight || 720;
  const safeNow = (): Safe =>
    typeof opts.safe === "function" ? opts.safe() : (opts.safe ?? safeInsets(vw, vh));
  let grid: Grid = fitGrid(count, vw, vh, opts.aspect, safeNow(), GAP_PX);
  const dpr = () => Math.min(window.devicePixelRatio || 1, MAX_DPR);

  // ---- the scene
  const cellLong = Math.min(512, Math.max(96, Math.ceil(Math.max(grid.tileW, grid.tileH) * dpr())));
  const state = createTileState(T, count, reduced);
  let wake = () => {};
  const atlas = createAtlas(T, renderer, opts.items.map((it) => it.src), opts.aspect, cellLong, () => wake());
  const L = atlas.layout;
  const uniforms = {
    uRes: { value: new T.Vector2(vw, vh) },
    uOffset: { value: new T.Vector2() },
    uGrid: { value: new T.Vector4() },
    uTile: { value: new T.Vector4() },
    uLastOff: { value: 0 },
    uK: { value: WARP_K },
    uRadius: { value: RADIUS_PX },
    uGrow: { value: HOVER_GROW },
    uAtlas: { value: new T.Vector4(L.cols, L.cellW, L.cellH, 0) },
    uAtlasSize: { value: new T.Vector2(L.width, L.height) },
    uPics: { value: atlas.texture },
    uState: { value: state.texture },
  };
  const geometry = new T.PlaneGeometry(2, 2);
  const material = new T.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  material.premultipliedAlpha = true;
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new T.Scene();
  scene.add(mesh);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);

  function applyGrid() {
    uniforms.uRes.value.set(vw, vh);
    uniforms.uGrid.value.set(grid.cols, grid.rows, grid.count, grid.gap);
    uniforms.uTile.value.set(grid.tileW, grid.tileH, grid.originX, grid.originY);
    uniforms.uLastOff.value = grid.lastRowOffset;
  }

  // ---- state
  const t0 = performance.now();
  let raf = 0;
  let last = t0;
  let lastDraw = 0;
  let dirty = true;
  let destroyed = false;
  let lost = false;
  let hidden = typeof document !== "undefined" && document.hidden;
  let onScreen = true;
  let pointer: Pt | null = null;
  let hover: number | null = null;
  let pull: Pt = { x: 0, y: 0 };
  let lastNudge = 0;

  const active = () => !destroyed && !lost && !hidden && onScreen;
  const offsetAt = (now: number): Pt => {
    const d = reduced ? { x: 0, y: 0 } : driftAt((now - t0) / 1000);
    const n = rubberBand(pull, NUDGE_MAX_PX);
    return { x: d.x + n.x, y: d.y + n.y };
  };

  function updateHover(off: Pt) {
    const i = pointer ? tileAt(pointer.x, pointer.y, grid, off, vw, vh) : null;
    if (i === hover) return;
    hover = i;
    state.setHover(i);
    canvas.style.cursor = i === null ? "" : "pointer";
    opts.onHover(i);
  }

  function frame(now: number) {
    raf = 0;
    if (!active()) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if ((pull.x !== 0 || pull.y !== 0) && now - lastNudge > NUDGE_HOLD_MS) pull = settleNudge(pull, dt);
    const off = offsetAt(now);
    atlas.pump();
    if (pointer) updateHover(off);
    const eased = state.step(dt, now, atlas.loadedAt);
    const busy = eased || atlas.waiting() || pull.x !== 0 || pull.y !== 0;
    if (dirty || busy || now - lastDraw >= IDLE_FRAME_MS) {
      uniforms.uOffset.value.set(off.x, off.y);
      renderer.render(scene, camera);
      lastDraw = now;
      dirty = false;
    }
    if (busy || !reduced) raf = requestAnimationFrame(frame);
  }

  wake = () => {
    if (raf || !active()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  function resize() {
    if (destroyed || lost) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    vw = w;
    vh = h;
    renderer.setPixelRatio(dpr());
    renderer.setSize(w, h, false);
    grid = fitGrid(count, vw, vh, opts.aspect, safeNow(), GAP_PX);
    applyGrid();
    dirty = true;
    if (pointer) updateHover(offsetAt(performance.now()));
    wake();
  }

  const api: Gallery = {
    resize,
    setPointer(x, y) {
      if (destroyed || lost) return;
      pointer = { x, y };
      updateHover(offsetAt(performance.now()));
      wake();
    },
    clearPointer() {
      if (destroyed) return;
      pointer = null;
      updateHover(offsetAt(performance.now()));
      wake();
    },
    nudge(dx, dy) {
      if (destroyed || lost || reduced) return;
      // the raw pull is capped well past the rubber band's reach, so a long drag does not wind up
      pull = { x: pull.x + dx, y: pull.y + dy };
      const m = Math.hypot(pull.x, pull.y);
      if (m > 4 * NUDGE_MAX_PX) pull = { x: (pull.x * 4 * NUDGE_MAX_PX) / m, y: (pull.y * 4 * NUDGE_MAX_PX) / m };
      lastNudge = performance.now();
      wake();
    },
    focus(i) {
      if (destroyed || lost) return;
      state.setFocus(i === null || i < 0 || i >= count ? null : i);
      wake();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      listeners.abort();
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.style.cursor = "";
      atlas.dispose();
      state.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  // ---- listeners
  const listeners = new AbortController();
  attachGalleryInput(
    canvas,
    {
      setPointer: (x, y) => api.setPointer(x, y),
      clearPointer: () => api.clearPointer(),
      nudge: (dx, dy) => api.nudge(dx, dy),
      pick: (x, y) => tileAt(x, y, grid, offsetAt(performance.now()), vw, vh),
    },
    (i) => opts.onActivate?.(i),
    listeners.signal,
  );
  const onVisibility = () => {
    hidden = document.hidden;
    if (hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      dirty = true;
      wake();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const io =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
          if (!onScreen) {
            cancelAnimationFrame(raf);
            raf = 0;
          } else {
            dirty = true;
            wake();
          }
        });
  io?.observe(canvas);
  const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resize());
  ro?.observe(canvas);
  watchContextLost(canvas).subscribe(() => {
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.style.cursor = "";
    opts.onLost?.();
  });

  resize();
  applyGrid();
  wake();
  return api;
}
