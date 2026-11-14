/**
 * The gallery engine: one canvas, one full-screen shader, a finite fitted grid of pictures.
 *
 * Ported from the ObsidianUI Art Gallery (vendor/obsidianui/art-gallery.jsx, webgl-surface.jsx),
 * Copyright (c) 2026 ObsidianUI, MIT License (vendor/obsidianui/LICENSE). Kept: three.js with an
 * orthographic camera and a ShaderMaterial on a 2 by 2 plane (gallery-scene.ts), the animation loop and the cleanup
 * of textures, geometry, material and renderer. Changed (spec 6.5, round 7 spec 7): React and the text atlas are gone
 * (this is a plain module the wall page drives), the grid is the largest that fits and is finite, there is no warp,
 * drag no longer scrolls or zooms (it nudges and settles back), the grid drifts on a 50 s loop, the tile under the
 * pointer grows 4%, a ring marks the focused tile, pictures stream into an atlas a few per frame, and the wall
 * arrives: nothing is drawn until the first pictures are in (or 1.2 s), then the tiles come in from the middle.
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
import { createAtlas, type Atlas } from "./gallery-atlas";
import { attachGalleryInput } from "./gallery-input";
import {
  GAP_PX,
  HOVER_GROW,
  NUDGE_HOLD_MS,
  NUDGE_MAX_PX,
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
import { createScene } from "./gallery-scene";
import type { Gallery, GalleryOptions } from "./gallery-types";
import { createTileState, type TileState } from "./gallery-state";
import { arrivalOrder, canStart } from "./wall-arrival";

export type { Gallery, GalleryOptions } from "./gallery-types";

const IDLE_FRAME_MS = 66;
const MAX_DPR = 2;

/** Everything `assemble` makes that needs freeing if it throws half way. */
type Parts = {
  atlas?: Atlas;
  state?: TileState;
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material;
  /** Set once the gallery object exists: its destroy undoes everything, listeners included. */
  api?: Gallery;
};

/** Resolves to null (never rejects) when three, WebGL or the scene cannot start. */
export async function createGallery(canvas: HTMLCanvasElement, opts: GalleryOptions): Promise<Gallery | null> {
  if (opts.items.length === 0) return null;
  let T: typeof THREE;
  let renderer: THREE.WebGLRenderer;
  try {
    T = await import("three");
    renderer = new T.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false });
  } catch (err) {
    console.warn("The video wall could not start WebGL.", err);
    return null;
  }
  const parts: Parts = {};
  try {
    return assemble(T, renderer, canvas, opts, parts);
  } catch (err) {
    console.warn("The video wall could not start.", err);
    if (parts.api) {
      parts.api.destroy(); // unsubscribes, detaches listeners and observers, frees everything
    } else {
      parts.atlas?.dispose();
      parts.state?.dispose();
      parts.geometry?.dispose();
      parts.material?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
    return null;
  }
}

function assemble(
  T: typeof THREE,
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  opts: GalleryOptions,
  parts: Parts,
): Gallery {
  const count = opts.items.length;
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
  const state = (parts.state = createTileState(T, count, reduced));
  let wake = () => {};
  const atlas = (parts.atlas = createAtlas(
    T,
    renderer,
    {
      srcs: opts.items.map((it) => it.src),
      arts: opts.items.map((it) => it.art),
      aspect: opts.aspect,
      cellLong,
      order: arrivalOrder(grid.cols, grid.rows, count), // the pictures come in the order the tiles arrive
    },
    () => wake(),
  ));
  const view = createScene(T, atlas, state, vw, vh);
  parts.geometry = view.geometry;
  parts.material = view.material;

  function applyGrid() {
    view.applyGrid(grid, vw, vh);
    state.setLayout(grid.cols, grid.rows, grid.lastRowOffset / (grid.tileW + grid.gap));
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
  let stepBusy = true;
  // nothing is drawn until the atlas has its first pictures or 1.2 s have passed (wall-arrival.ts); then the tiles arrive
  let started = false;
  let drawnTold = false;

  const active = () => !destroyed && !lost && !hidden && onScreen;
  const offsetAt = (now: number): Pt => {
    const d = reduced ? { x: 0, y: 0 } : driftAt((now - t0) / 1000);
    const n = rubberBand(pull, NUDGE_MAX_PX);
    return { x: d.x + n.x, y: d.y + n.y };
  };

  function updateHover(off: Pt) {
    const grown = hover === null ? null : { i: hover, grow: HOVER_GROW * state.amount(hover) };
    const i = pointer && started ? tileAt(pointer.x, pointer.y, grid, off, grown) : null;
    if (i === hover) return;
    hover = i;
    dirty = true;
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
    const uploaded = atlas.pump();
    if (!started) {
      const facts = {
        pictures: atlas.uploaded(),
        count,
        settled: atlas.settled(),
        artReady: atlas.artReady(),
        elapsedMs: now - t0,
      };
      if (!canStart(facts)) {
        raf = requestAnimationFrame(frame);
        return;
      }
      started = true;
      view.compile(renderer); // the shader links before the arrival's clock starts, not inside its first frame
      state.start(performance.now(), typeof opts.instant === "function" ? opts.instant() : opts.instant === true); // pictures that are in by now show whole; the rest fade in over their art
      canvas.dataset.startMs = String(Math.round(now - t0)); // for the audit: when the first frame was drawn, and with how many pictures
      canvas.dataset.startPictures = String(facts.pictures);
      dirty = true;
    }
    if (pointer) updateHover(off);
    // the easing only runs while something eases, was asked for or arrived
    if (uploaded > 0 || dirty || stepBusy) stepBusy = state.step(dt, now, atlas.loadedAt);
    if (!stepBusy && !("arrived" in canvas.dataset)) canvas.dataset.arrived = ""; // the arrival is over and no picture is still fading in
    const busy = stepBusy || atlas.waiting() || pull.x !== 0 || pull.y !== 0;
    if (dirty || busy || now - lastDraw >= IDLE_FRAME_MS) {
      view.render(renderer, off);
      lastDraw = now;
      dirty = false;
      if (!drawnTold) {
        drawnTold = true; // the first frame is on the canvas: the links may go
        opts.onDrawn?.();
      }
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

  const listeners = new AbortController();
  let io: IntersectionObserver | null = null;
  let ro: ResizeObserver | null = null;
  let unsubLost = () => {};

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
      dirty = true;
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
      unsubLost(); // our own context loss below is not a GPU loss
      canvas.style.cursor = "";
      atlas.dispose();
      state.dispose();
      view.geometry.dispose();
      view.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  // ---- listeners
  parts.api = api;
  attachGalleryInput(
    canvas,
    {
      setPointer: (x, y) => api.setPointer(x, y),
      clearPointer: () => api.clearPointer(),
      nudge: (dx, dy) => api.nudge(dx, dy),
      pick: (x, y) => (started ? tileAt(x, y, grid, offsetAt(performance.now()), hover === null ? null : { i: hover, grow: HOVER_GROW * state.amount(hover) }) : null),
    },
    (i) => opts.onActivate?.(i),
    listeners.signal,
  );
  function onVisibility() {
    hidden = document.hidden;
    if (hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      dirty = true;
      wake();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  io =
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
  ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resize());
  ro?.observe(canvas);
  unsubLost = watchContextLost(canvas).subscribe(() => {
    if (destroyed) return;
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
