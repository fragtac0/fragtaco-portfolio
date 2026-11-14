import type { SiteVideo } from "~/types";
import { createSlicer } from "../../../utils/idle";
import { watchContextLost } from "../context-lost";
import { createFrameBox, windowSize, type FrameOptions } from "../layer/frame-box";
import { drawDue, type Frame } from "../layer/frame-math";
import { dockCanvas, fitBuffer, placeAt, readCanvas } from "./wall-canvas";
import { drawTiles } from "./wall-draw";
import { createWallGl, type WallGl } from "./wall-gl";
import { createChoiceHold, createChoiceLayout, picturesSettled } from "./wall-choice";
import { createCamera } from "./wall-camera";
import { createChip, createProbe } from "./wall-hud";
import { reportFrame } from "./wall-probes";
import { focusOf } from "./wall-focus";
import { attachWallInput, createWallInput } from "./wall-input";
import { blockPlan, loadOrder } from "./wall-block";
import { atlasLayout, cellUv, layoutTiles, type Atlas } from "./wall-math";
import { applyView, createMotion } from "./wall-motion";
import { createPose } from "./wall-pose";
import { fitBlock } from "./wall-reshape";
import { createThumbs, type Thumbs } from "./wall-thumbs";
import {
  createWallState,
  type Tile,
  type WallCtx,
  type WallEls,
  type WallEngine,
} from "./wall-types";

/**
 * The video wall: every thumbnail on one finite block of small tiles in a fixed shuffled order, drawn flat with raw WebGL1 (spec
 * 7, 8.1; the `Wall` module of docs/redesign/mockups/home-v4.html). All tiles are one size and one brightness; the block floats
 * a few pixels at rest, is moved by the pointer and stops softly at its edges (wall-block.ts). Hover is proximity only
 * (wall-proximity.ts). The focused video's channel keeps a hairline edge, and thumbnails arrive with a fade. The wall is drawn to
 * a texture and shown through a fish-eye at its borders (wall-warp.ts, wall-warp-pass.ts); the pointer goes through the inverse.
 *
 * The engine owns its canvas. `prepare()` creates the GL context, program and atlas texture in steps (idle time, or short slices
 * once `setUrgent(true)`) and starts loading thumbnails, so the wall is warm when the layer opens. `setFrame()` draws the open
 * page's picture scaled to cover a smaller frame, `setDocked()` takes its input away and holds it to 30 draws a second
 * (layer/frame-math.ts, wall-canvas.ts). `mount()` puts the canvas into the layer and wires the input, `unmount()` takes it out
 * but keeps the GL objects, `dispose()` frees everything. The rest is in the wall-*.ts files beside it.
 */

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
  /** The still frame on the screen (see `frame`), or "" when the next frame must be drawn. */
  let drawnStill = "";
  /** The frame the picture is drawn into (layer/frame-box.ts), whether the wall is docked in it, and when the last frame was drawn. */
  const box = createFrameBox(canvas);
  lost.subscribe(() => box.abandon()); // a lost context draws no more: a waiter for a frame is let go
  let docked = false;
  let lastDrawn = 0;
  /** The docked pixel-ratio cap (`setDocked`), and that the buffer must be sized again for a new one. */
  let dprCap: number | undefined;
  let refit = false;

  // interaction and view state, shared with the input code through the context
  const st = createWallState();
  const { mouse } = st;
  let cursor = "";
  const pose = createPose(videos);
  const motion = createMotion(st, REDUCE);
  const camera = createCamera(st, REDUCE);
  const hold = createChoiceHold(st, pose, camera, () => running);
  const choiceOf = createChoiceLayout();
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
          const [ww, wh] = windowSize();
          const a = atlasLayout(videos.length, ww < 700);
          atlas = a;
          uvs = a.cells.map((_, i) => cellUv(i, a));
          thumbs = createThumbs(wgl.gl, a, videos, () => running, loadOrder(blockPlan(a.cells.length, ww, wh), a.cells.length));
        },
        () => {
          if (disposed || !wgl) return;
          // size the drawing buffer now: the layer is fixed to the viewport, so `start()` finds
          // this size and does not resize inside the frame that opens the layer
          fitBuffer(canvas, box, wgl, ...windowSize(), dprCap);
        },
      ])
      .catch((err: unknown) => {
        failed = true;
        console.warn("The wall could not start.", err);
      });
    return building;
  }

  function sizes() {
    readCanvas(canvas, st, box.frame());
    const had = st.plan.cols > 0;
    // a different grid keeps the chosen video, the keyboard's tile and the hover on their videos
    // (their keys name cells), so the pose's per-key easing starts over
    if (fitBlock(st, atlas?.cells.length ?? videos.length) && had) pose.reset();
    probe("block", `${st.plan.cols}x${st.plan.rows}:${Math.round(st.plan.width)}x${Math.round(st.plan.height)}`);
    applyView(st, !REDUCE);
    fitBuffer(canvas, box, wgl, st.vw, st.vh, dprCap);
    drawnStill = "";
  }

  const ctx: WallCtx = { canvas, st, running: () => running && !docked, live: () => running, count: () => atlas?.cells.length ?? videos.length };
  const input = createWallInput(ctx, opts.onPick, sizes);

  // ---- the frame

  function frame(now: number) {
    if (!running || !wgl || !atlas) return;
    raf = requestAnimationFrame(frame);
    // a new frame is applied here, in the frame that draws it; a docked wall draws at most 30 times a second (`dt` then spans
    // both), and only a new size (the picture must be drawn again) goes ahead of that, a move of the frame does not
    const due = drawDue(now, lastDrawn, docked);
    let framed = box.hasPending() ? box.commit() : "none";
    if (refit) framed = "resized";
    refit = false;
    if (framed === "resized") sizes();
    else if (framed === "moved") placeAt(st, box.frame());
    if (framed !== "resized" && !due) return;
    lastDrawn = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    hold.tick();
    const { vw, vh, size } = st;
    const { pitchX } = size;
    const choosing = st.choice !== null;
    const hovering = FINE && mouse.inside && !st.dragging && !choosing;
    motion.step(dt, hovering);
    camera.step(dt);
    const list = layoutTiles({
      viewX: st.view.x,
      viewY: st.view.y,
      vw,
      vh,
      plan: st.plan,
      count: atlas.cells.length,
      also: camera.views(),
    }) as Tile[];
    const { ft, point } = focusOf(st, list, hovering);
    const focusIdx = ft ? ft.idx : null;
    const choice = choiceOf(st);
    if (choice?.shift) camera.shiftInto(choice.shift);
    const ghosts = pose.apply(list, {
      dt,
      size,
      hoverKey: st.hoverKey,
      point,
      focusIdx,
      reduced: REDUCE,
      choice,
    });
    thumbs?.pumpFrame();

    // a still wall (a video open, nothing travelling, every picture up and settled) keeps the frame
    // that is already on the screen until something changes
    const calm = choice && !pose.moving() && picturesSettled(thumbs?.loadedAt, now, undefined, thumbs?.failedAt);
    const calmSig = calm ? `${choice.key}|${vw}x${vh}` : "";
    if (!calm || calmSig !== drawnStill) {
      const draw = ghosts.length ? [...ghosts, ...list] : list;
      if (!drawTiles(wgl, draw, { now, vw, vh, pitchX, reduced: REDUCE, uvs, loadedAt: thumbs?.loadedAt })) {
        // the GPU cannot render to the wall's target: the plain grid takes over, as for a lost context
        failed = true;
        stop();
        canvas.dispatchEvent(new Event("webglcontextlost"));
        return;
      }
      wgl.endFrame(vw, vh);
      drawnStill = calmSig;
      box.drawn();
    }
    st.tiles = list;
    if (onFirstFrame) {
      const cb = onFirstFrame;
      onFirstFrame = null;
      cb();
    }

    const echo = pose.echoFor(focusIdx);
    chip.place(els?.chip, list, echo.size);
    reportFrame(probe, canvas, st, list, choice, echo.size);
    const cur = st.dragging ? "grabbing" : st.hoverKey ? "pointer" : "grab";
    if (cur !== cursor) canvas.style.cursor = cursor = cur;
  }

  // ---- lifecycle

  function stop() {
    box.abandon(); // a waiter for a frame is let go: none will be drawn
    running = false;
    hold.cancel();
    runToken++;
    cancelAnimationFrame(raf);
    els?.chip.classList.remove("on");
    canvas.style.cursor = "";
    cursor = "";
    mouse.inside = false;
    st.choice = null;
    drawnStill = "";
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
      chip.reset();
      listeners = new AbortController();
      attachWallInput(canvas, input.handlers, listeners.signal);
    },

    async start(opts) {
      const my = ++runToken;
      box.resume();
      onFirstFrame = opts?.onFirstFrame ?? null;
      await prepare();
      if (my !== runToken) return;
      if (!els || !wgl || failed || lost.lost()) return box.abandon(); // the scene switches to its plain grid
      st.hoverKey = null;
      st.kbd = null;
      pose.reset();
      st.choice = null;
      drawnStill = "";
      box.commit();
      box.invalidate();
      refit = false;
      sizes();
      running = true;
      last = lastDrawn = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },

    stop,

    unmount,

    hasFailed: () => failed || lost.lost(),
    setUrgent: (on) => slicer.setUrgent(on),
    onLost: lost.subscribe,

    spreads: true,
    freeze: (key) => hold.freeze(key),
    release: () => hold.release(),
    thaw: (instant) => hold.thaw(instant),
    rectOf: input.rectOf,

    setFrame(frame: Frame | null, opts?: FrameOptions) {
      box.request(frame, opts);
      if (!running) box.commit(); // the loop applies it otherwise, in the frame it draws
    },
    setDocked(on, opts) {
      docked = on;
      lastDrawn = 0;
      dockCanvas(canvas, st, on);
      const cap = on ? opts?.maxDpr : undefined;
      if (cap !== dprCap) {
        dprCap = cap;
        refit = true;
      }
    },
    whenDrawn: () => box.whenDrawn(),

    focusNext: input.focusNext,
    openFocused: input.openFocused,

    dispose() {
      if (disposed) return;
      unmount();
      disposed = true;
      box.release();
      thumbs?.dispose();
      wgl?.dispose();
      wgl = null;
      thumbs = null;
      st.tiles = [];
    },
  };
}
