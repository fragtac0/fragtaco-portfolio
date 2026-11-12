import type { SiteBook } from "~/types";
import { createSlicer } from "../../../utils/idle";
import { watchContextLost } from "../context-lost";
import { createCoverQueue } from "./shelf-covers";
import { attachShelfInput, createShelfInput } from "./shelf-input";
import { createOpenPath, type ShelfCtx, type ShelfEls, type ShelfState } from "./shelf-open";
import type { ShelfEngine } from "./shelf-engine-types";
import { createAnimate, poseBooks } from "./shelf-pose";
import { createMarkerSync, hintText, HINT_NO_GL } from "./shelf-hud";
import { fitShelf, readCovers } from "./shelf-fit";
import { buildShelfScene, loadShelfFonts, newBag, type ShelfScene } from "./shelf-scene";
import { loadSpinePhotos, retintSpine, stepSpineFades } from "./shelf-spines";
import { spineColours } from "./spine-styles";
import { clamp, flick, initialCamX, introSeconds, NARROW_PX } from "./shelf-math";

/**
 * The reading shelf: 14 books in one row on a line, seen face on and drawn with three.js. Ported
 * from the `Shelf` module of docs/redesign/mockups/home-v4.html (slow drop-in with fade, springs for
 * hover, open and fade, covers uploaded outside the entrance); since R44.3 the camera is
 * orthographic and the row is unlit, so no side of a book shows and the colours are true.
 *
 * three.js is only ever loaded with `import("three")`, inside `prepare()`, so it is its own chunk.
 * The engine owns its canvas: `prepare()` builds the whole scene in idle time while no layer is
 * mounted, so the layer opens onto a warm scene; once the layer is open and waiting, `setUrgent()`
 * makes the same steps run back to back (about 8 ms a frame) while a flat placeholder stands in.
 * `mount()` puts the canvas into the layer and wires the overlays, `unmount()` takes it out again
 * but keeps the GL scene for an instant re-open, and `dispose()` (when the home page goes away)
 * frees everything. A lost graphics context makes `hasFailed()` true and calls `onLost` listeners.
 *
 * Shadows are not a shadow map: a lifted book has a soft shadow on the ground behind it, animated
 * with the book every frame. Opening a book lifts it straight up and turns it to its cover (620 ms)
 * while the row stays put and dims to 70%; the note shows beside it (shelf-open.ts, shelf-lift.ts).
 *
 * The per-frame book poses are shelf-pose.ts, the open-book path is shelf-open.ts, the real covers
 * shelf-covers.ts, the scene shelf-scene.ts, the sizing shelf-fit.ts, the hint and position marker
 * shelf-hud.ts and the listeners (keyboard, drag, wheel) shelf-input.ts; this file keeps the state,
 * the frame (including the flick after a drag) and the lifecycle.
 */

export type { ShelfEls, ShelfEngine };

/** Thrown inside `build()` when the engine is disposed part-way through. */
class Aborted extends Error {}

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
  const lost = watchContextLost(canvas);

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
  let onFirstFrame: (() => void) | null = null;
  const slicer = createSlicer();

  // Not running, or past the entrance with no book open and none still opening or closing: a cover is
  // painted only then, so it never costs a frame of the lift.
  const calm = () =>
    !running ||
    (performance.now() - st.t0 > (intro() + 0.3) * 1000 &&
      !st.opened &&
      !gl?.books.some((b) => b.anim.open > 0));

  // Real covers: downloaded, decoded, painted and uploaded outside the entrance (shelf-covers.ts).
  const covers = createCoverQueue({
    disposed: () => disposed,
    ready: () => !!gl,
    running: () => running,
    calm: () => calm(),
    upload(t, c) {
      if (!gl) return;
      const old = t.image as HTMLCanvasElement | undefined;
      if (old && (old.width !== c.width || old.height !== c.height)) t.dispose(); // new storage for a new size
      t.image = c;
      t.needsUpdate = true;
      gl.renderer.initTexture(t);
      readCovers(canvas, gl.books);
    },
    pixels: (d) => gl?.books.find((k) => k.d.id === d.id)?.coverPx ?? 640,
    // the cover's colours: the spine fades over to them while the loop runs, else it is repainted at once
    colours(d, c) {
      const b = gl?.books.find((k) => k.d.id === d.id);
      if (!b) return;
      retintSpine(b, spineColours(c), running && !reduced);
      st.dirty = true;
    },
  });
  let stopPhotos: (() => void) | null = null;

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
    flickV: 0,
    fitW: 0,
    fitH: 0,
    fitTop: 0,
  };
  const cam = { x: 0, xV: 0 };

  const animate = createAnimate(reduced);
  // the position marker under the line (shelf-hud.ts)
  const syncMarker = createMarkerSync();

  // the open-book path and the input handlers work on this state through the context
  const ctx: ShelfCtx = {
    canvas,
    st,
    cam,
    scene: () => gl,
    els: () => els,
    running: () => running,
    reduced,
    intro,
  };
  const openBookPath = createOpenPath(ctx);
  const { closeBook, setNote } = openBookPath;

  // ---- building (idle time before the layer is opened, short urgent slices once it waits)

  async function build(): Promise<ShelfScene> {
    const T = await import("three");
    await loadShelfFonts();
    if (disposed) throw new Aborted();
    // the scene is built in steps the slicer spreads out; a disposed engine ends the build at the next one
    const run = (steps: Array<() => void>) =>
      slicer.run(
        steps.map((step) => () => {
          if (disposed) throw new Aborted();
          step();
        }),
      );
    return buildShelfScene(
      T,
      canvas,
      books,
      run,
      (tex, d) => covers.load(tex, d),
      (tex, d) => covers.repaint(tex, d),
    );
  }

  // ---- sizing (shelf-fit.ts)

  const fit = () => fitShelf(ctx, closeBook);

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
    // the open book keeps breathing, unless motion is reduced
    let busy = el < introS + 0.3 || st.dirty || (!!st.opened && !reduced);

    if (st.camTarget !== null) {
      if (animate(cam, "x", st.camTarget, 7, dt)) busy = true;
      else st.camTarget = null;
    }
    if (st.flickV !== 0) {
      // coasting after a flick; a touch, an arrow key or an open book ends it
      const f = st.opened || st.down ? { dx: 0, v: 0 } : flick(st.flickV, dt);
      const x = clamp(cam.x + f.dx, -s.maxX, s.maxX);
      st.flickV = x === cam.x + f.dx ? f.v : 0; // an end of the shelf stops it
      cam.x = x;
      busy = true;
    }
    if (stepSpineFades(s.books, dt)) busy = true;
    syncMarker(els?.marker, cam.x, s.maxX, s.visible);
    s.camera.position.x = cam.x; // the fit set the height; the camera looks straight down -z

    if (el > introS && calm() && covers.drain()) busy = true; // one late cover per frame

    const prev = st.hoverHit;
    st.hoverHit =
      !st.opened && el > introS - 0.4 && st.inside && !(st.down && st.down.moved)
        ? pick(s.books)
        : null;
    if (st.hoverHit !== prev) canvas.style.cursor = st.hoverHit ? "pointer" : "";
    const focused = st.focusIdx >= 0 ? s.books[st.focusIdx] : null;

    if (
      poseBooks(s, {
        el,
        dt,
        now,
        reduced,
        hover: st.hoverHit,
        focused,
        opened: st.opened,
        animate,
      })
    ) {
      busy = true;
    }
    if (busy) {
      s.renderer.render(s.scene, s.camera);
      st.dirty = false;
      if (onFirstFrame) {
        const cb = onFirstFrame;
        onFirstFrame = null;
        cb();
      }
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
        // a book with a picture of its spine shows that instead (none does yet)
        stopPhotos = loadSpinePhotos(g.books, {
          animate: () => running && !reduced,
          shown: () => {
            st.dirty = true;
          },
        });
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
    canvas.classList.remove("dragging");
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
      st.fitW = 0; // a new mount refits: the marker and camera limits are for this stage
      next.hint.textContent = hintText(opts.fine, canvas.clientWidth < NARROW_PX);
      setNote(false);
      const ac = (listeners = new AbortController());
      attachShelfInput(canvas, handlers, ac.signal);
      next.info
        .querySelector("button")
        ?.addEventListener("click", () => closeBook(true), { signal: ac.signal });
    },

    async start(opts) {
      const my = ++runToken;
      onFirstFrame = opts?.onFirstFrame ?? null;
      await prepare();
      if (my !== runToken || !els) return;
      if (!gl || lost.lost()) {
        els.hint.textContent = HINT_NO_GL;
        return;
      }
      fit();
      // a skipped drop-in starts past its end
      const skipped = opts?.skipIntro ? intro() + 0.4 : 0;
      st.t0 = performance.now() - skipped * 1000;
      cam.x = initialCamX(gl.maxX, canvas.clientWidth < NARROW_PX);
      cam.xV = st.flickV = 0;
      for (const b of gl.books) b.anim = newBag();
      st.opened = st.hoverHit = st.camTarget = st.down = null;
      st.focusIdx = -1;
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
    hasFailed: () => failed || lost.lost(),
    onLost: lost.subscribe,
    ready: () => !!gl,
    setUrgent: (on) => slicer.setUrgent(on),
    closeBook: () => closeBook(true),
    focusNext,
    openFocused,

    dispose() {
      if (disposed) return;
      unmount();
      disposed = true;
      covers.clear();
      stopPhotos?.();
      gl?.dispose();
      gl = null;
    },
  };
}
