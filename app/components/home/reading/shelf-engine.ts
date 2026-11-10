import type { SiteBook } from "~/types";
import { createCoverQueue } from "./shelf-covers";
import { attachShelfInput, createShelfInput } from "./shelf-input";
import { createOpenPath, type ShelfCtx, type ShelfEls, type ShelfState } from "./shelf-open";
import { buildShelfScene, loadShelfFonts, type ShelfScene } from "./shelf-scene";
import {
  CAMERA,
  cameraAt,
  clamp,
  dropProgress,
  easeOut,
  fitCamera,
  introSeconds,
  openPhases,
  spring,
  WALLZ,
} from "./shelf-math";

/**
 * The reading shelf: 14 books on a walnut plank, drawn with three.js. Ported from the `Shelf`
 * module of docs/redesign/mockups/home-v4.html (v4: 3.05 framing, slow drop-in with fade, springs
 * for hover, open and fade, covers uploaded outside the entrance).
 *
 * three.js is only ever loaded with `import("three")`, inside `prepare()`, so it is its own chunk.
 * The engine owns its canvas: `prepare()` builds the whole scene while no layer is mounted, so the
 * layer opens onto a warm scene. `mount()` puts the canvas into the layer and wires the overlays,
 * `unmount()` takes it out again but keeps the GL scene for an instant re-open, and `dispose()`
 * (when the home page goes away) frees everything.
 *
 * Shadows are not a shadow map: each book has a soft contact shadow on the plank and a soft
 * shadow on the wall, animated with the book every frame. Opening a book copies the shelf once,
 * blurs that copy in CSS, and fades the live shelf into it, so the open book is the only thing
 * still being drawn.
 *
 * The open-book path is shelf-open.ts, the real covers shelf-covers.ts, the scene shelf-scene.ts and
 * the listeners (keyboard, spec 8.10) shelf-input.ts; this file keeps the state, the frame and the
 * lifecycle.
 */

export type { ShelfEls };

export type ShelfEngine = {
  prepare(): Promise<void>;
  mount(els: ShelfEls): void;
  start(): Promise<void>;
  stop(): void;
  unmount(): void;
  hasOpen(): boolean;
  /** True once `prepare()` has run and the scene could not be built (no WebGL2, a throw). */
  hasFailed(): boolean;
  closeBook(): void;
  focusNext(dir: 1 | -1): void;
  openFocused(): void;
  dispose(): void;
};

/** Thrown inside `build()` when the engine is disposed part-way through. */
class Aborted extends Error {}

const whenIdle = (cb: () => void) => {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(cb, { timeout: 1200 });
  } else {
    window.setTimeout(cb, 120);
  }
};
const nextIdle = () => new Promise<void>((r) => whenIdle(r));

const HINT_FINE = "Hover to pull a book out. Click to open it.";
const HINT_TOUCH = "Tap a book to open it. Drag to look along the shelf.";
const HINT_NO_GL = "The shelf could not start in this browser.";
const STAGE_LABEL = "Bookshelf. Use left and right arrows to browse, Enter to open.";

/** Client only: creates a canvas. The scene is built later, by `prepare()`. */
export function createShelf(
  books: SiteBook[],
  opts: { fine: boolean; reducedMotion: boolean },
): ShelfEngine {
  const reduced = opts.reducedMotion;
  const canvas = document.createElement("canvas");
  canvas.className = "shelf-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "group");
  canvas.setAttribute("aria-label", STAGE_LABEL);

  /** The whole drop-in; nothing falls when motion is reduced. */
  const intro = () => (reduced ? 0 : introSeconds(books.length));

  let gl: ShelfScene | null = null;
  let building: Promise<void> | null = null;
  let failed = false;
  let disposed = false;
  let els: ShelfEls | null = null;
  let listeners: AbortController | null = null;
  let running = false;
  let raf = 0;
  let last = 0;
  let runToken = 0;

  // Real covers: downloaded, decoded, painted and uploaded outside the entrance (shelf-covers.ts).
  const covers = createCoverQueue({
    disposed: () => disposed,
    ready: () => !!gl,
    running: () => running,
    calm: () => !running || (performance.now() - st.t0 > (intro() + 0.3) * 1000 && !st.opened),
    upload(t, c) {
      if (!gl) return;
      t.image = c;
      t.needsUpdate = true;
      gl.renderer.initTexture(t);
    },
  });

  // interaction state
  const st: ShelfState = {
    t0: 0,
    opened: null,
    hoverHit: null,
    down: null,
    inside: false,
    dirty: true,
    focusIdx: -1,
    camTarget: null,
    fitW: 0,
    fitH: 0,
  };
  const cam = { x: 0, xV: 0 };
  const fadeBag = { fade: 0, fadeV: 0 };

  /** A spring, or a snap to the target when motion is reduced. Returns whether it is still moving. */
  const animate = (o: Record<string, number>, key: string, to: number, w: number, dt: number) => {
    if (!reduced) return spring(o, key, to, w, dt);
    const moved = o[key] !== to;
    o[key] = to;
    o[key + "V"] = 0;
    return moved;
  };

  // the open-book path and the input handlers work on this state through the context
  const ctx: ShelfCtx = {
    canvas,
    st,
    cam,
    scene: () => gl,
    els: () => els,
    running: () => running,
    intro,
  };
  const openBookPath = createOpenPath(ctx);
  const { closeBook, setNote } = openBookPath;

  // ---- building (idle time, before the layer is ever opened)

  async function build(): Promise<ShelfScene> {
    const T = await import("three");
    await loadShelfFonts();
    if (disposed) throw new Aborted();
    // the scene yields between slices; a disposed engine ends the build at the next one
    const idle = async () => {
      await nextIdle();
      if (disposed) throw new Aborted();
    };
    return buildShelfScene(T, canvas, books, idle, (tex, d) => covers.load(tex, d));
  }

  // ---- sizing

  /** Sizes the renderer and camera to the canvas; nothing happens when the size is unchanged. */
  function fit() {
    if (!gl || !els) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === st.fitW && h === st.fitH) return;
    st.fitW = w;
    st.fitH = h;
    if (st.opened) closeBook(true);
    const { renderer: r, camera, span } = gl;
    r.setSize(w, h, false);
    camera.aspect = w / h;
    const f = fitCamera({ fovDeg: camera.fov, aspect: camera.aspect, span });
    gl.dist = f.dist;
    gl.maxX = f.maxX;
    camera.updateProjectionMatrix();
    st.dirty = true;
  }

  const { handlers, pick, focusNext, openFocused } = createShelfInput(ctx, openBookPath, fit);

  // ---- the frame

  function frame(now: number) {
    if (!running || !gl) return;
    raf = requestAnimationFrame(frame);
    const s = gl;
    const el = (now - st.t0) / 1000;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    const introS = intro();
    const camPose = cameraAt(reduced ? CAMERA.dollyS : el, s.dist);
    // the open book keeps breathing, unless motion is reduced
    let busy = el < introS + 0.3 || st.dirty || (!!st.opened && !reduced);

    if (st.camTarget !== null) {
      if (animate(cam, "x", st.camTarget, 7, dt)) busy = true;
      else st.camTarget = null;
    }
    s.camera.position.set(cam.x, camPose.y, camPose.distance);
    s.camera.lookAt(cam.x, camPose.lookY, 0);

    if (el > introS && !st.opened && covers.drain()) busy = true; // one late cover per frame

    const prev = st.hoverHit;
    st.hoverHit =
      !st.opened && el > introS - 0.4 && st.inside && !(st.down && st.down.moved)
        ? pick(s.books)
        : null;
    if (st.hoverHit !== prev) canvas.style.cursor = st.hoverHit ? "pointer" : "";
    if (animate(fadeBag, "fade", st.opened ? 1 : 0, 8, dt)) busy = true;
    const keep = 1 - clamp(fadeBag.fade);
    const focused = st.focusIdx >= 0 ? s.books[st.focusIdx] : null;
    const { tmpV: p, tmpQ: q } = s;

    for (const b of s.books) {
      const k = reduced ? 1 : dropProgress(el, b.order);
      const e = easeOut(k);
      const a = b.anim;
      if (animate(a, "hover", b === st.hoverHit || b === focused ? 1 : 0, 9, dt)) busy = true;
      if (animate(a, "open", b === st.opened ? 1 : 0, 5, dt)) busy = true;
      p.copy(b.base);
      p.y += a.hover * 0.12 + (1 - e) * 1.2;
      p.z += a.hover * 0.16;
      // two phases: slide straight out of the shelf (+z), clear of the neighbours, then travel and turn
      const { pull, present } = a.open > 0.001 ? openPhases(a.open) : { pull: 0, present: 0 };
      p.z += pull * (b.W + 0.12);
      if (present > 0) p.lerp(b.openPos, present);
      b.g.position.copy(p);
      q.copy(b.baseQ);
      if (k < 1) q.premultiply(s.tmpQ2.setFromAxisAngle(s.zAxis, (1 - e) * b.tilt));
      if (present > 0) {
        q.slerp(s.qOpen, present);
        if (!reduced) {
          q.premultiply(s.tmpQ2.setFromAxisAngle(s.yAxis, Math.sin(now / 1500) * 0.06 * present));
        }
      }
      b.g.quaternion.copy(q);
      const op = a.open > 0.01 ? 1 : keep * Math.min(1, k * 2.2);
      if (b.mats[0].opacity !== op) for (const m of b.mats) m.opacity = op;
      b.g.visible = op > 0.004;
      // shadows are their own animation: they stay behind on the plank and the wall while the book lifts away
      const lift = Math.min(1, Math.max(1 - e, a.hover * 0.45, a.open));
      b.contact.position.set(b.base.x + 0.015, 0.003, b.base.z + 0.03 + a.hover * 0.12);
      b.contact.scale.set((b.T + 0.16) * (1 + 0.5 * lift), (b.W + 0.3) * (1 + 0.25 * lift), 1);
      b.contact.material.opacity = 0.85 * (1 - lift) * keep;
      b.wallSh.position.set(p.x + 0.07 + a.hover * 0.05, p.y + 0.02, WALLZ);
      b.wallSh.scale.set(
        (b.T * 2.2 + 0.32) * (1 + 0.3 * a.hover),
        (b.H * 1.15 + 0.26) * (1 + 0.12 * a.hover),
        1,
      );
      b.wallSh.material.opacity = 0.8 * e * (1 - 0.5 * a.hover) * (1 - a.open) * keep;
      b.contact.visible = b.contact.material.opacity > 0.004;
      b.wallSh.visible = b.wallSh.material.opacity > 0.004;
    }
    s.plank.material.opacity = keep;
    s.plank.visible = keep > 0.004;
    s.band.material.opacity = 0.7 * keep;
    s.band.visible = keep > 0.004;
    if (busy) {
      s.renderer.render(s.scene, s.camera);
      st.dirty = false;
    }
  }

  // ---- the engine

  function prepare(): Promise<void> {
    building ??= build()
      .then((g) => {
        if (disposed) {
          g.dispose();
          return;
        }
        gl = g;
        covers.wake();
      })
      .catch((err: unknown) => {
        if (err instanceof Aborted) return;
        failed = true;
        console.warn("The shelf could not start.", err);
      });
    return building;
  }

  function stop() {
    running = false;
    runToken++;
    cancelAnimationFrame(raf);
    canvas.style.cursor = "";
    closeBook(false);
    covers.wake(); // covers that waited for the scene to be calm can go now
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
      next.hint.textContent = opts.fine ? HINT_FINE : HINT_TOUCH;
      setNote(false);
      const ac = new AbortController();
      listeners = ac;
      attachShelfInput(canvas, handlers, ac.signal);
      next.info
        .querySelector("button")
        ?.addEventListener("click", () => closeBook(true), { signal: ac.signal });
    },

    async start() {
      const my = ++runToken;
      await prepare();
      if (my !== runToken || !els) return;
      if (!gl) {
        if (failed) els.hint.textContent = HINT_NO_GL;
        return;
      }
      fit();
      st.t0 = performance.now();
      cam.x = cam.xV = 0;
      fadeBag.fade = fadeBag.fadeV = 0;
      for (const b of gl.books) b.anim = { hover: 0, hoverV: 0, open: 0, openV: 0 };
      st.opened = null;
      st.hoverHit = null;
      st.focusIdx = -1;
      st.camTarget = null;
      st.down = null;
      st.dirty = true;
      gl.renderer.clear();
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },

    stop,

    unmount,

    hasOpen: () => !!st.opened,
    hasFailed: () => failed,
    closeBook: () => closeBook(true),
    focusNext,
    openFocused,

    dispose() {
      if (disposed) return;
      unmount();
      disposed = true;
      covers.clear();
      gl?.dispose();
      gl = null;
    },
  };
}
