import type { SiteBook } from "~/types";
import { createSlicer } from "../../../utils/idle";
import { watchContextLost } from "../context-lost";
import { createCoverQueue } from "./shelf-covers";
import { attachShelfInput, createShelfInput } from "./shelf-input";
import { createOpenPath, type ShelfCtx, type ShelfEls, type ShelfState } from "./shelf-open";
import type { ShelfEngine } from "./shelf-engine-types";
import { createAnimate, poseBooks } from "./shelf-pose";
import { createMarkerSync } from "./shelf-hud";
import { fitShelf, readCovers } from "./shelf-fit";
import { loadShelfFonts, newBag, type ShelfScene } from "./shelf-scene";
import { Aborted, abortable, buildShelf } from "./shelf-build";
import { createFontCap, createSpineFonts, type SpineFonts } from "./shelf-spine-fonts";
import { loadSpinePhotos, retintSpine, stepSpineFades } from "./shelf-spines";
import { spineColours } from "./spine-styles";
import { clamp, flick, initialCamX, introSeconds, NARROW_PX } from "./shelf-math";

/**
 * The reading shelf: 14 books in one row on a line, seen face on and drawn with three.js (ported from
 * the `Shelf` module of docs/redesign/mockups/home-v4.html; since R44.3 the camera is orthographic and
 * the row unlit, so the colours are true). Shadows are not a shadow map: a lifted book has a soft
 * shadow on the ground behind it. Opening a book lifts it and turns it to its cover (620 ms) while the
 * row dims to 70% and the note shows beside it (shelf-open.ts, shelf-lift.ts).
 *
 * three.js is only loaded with `import("three")` (shelf-build.ts), its own chunk. The engine owns its
 * canvas: `prepare()` builds the scene in idle time while no layer is mounted, so the layer opens onto
 * a warm scene; once the layer is open and waiting, `setUrgent()` runs the same steps back to back
 * (about 8 ms a frame), and the wait for the fonts is capped from `mount()` (R89). `mount()` puts the canvas into the layer,
 * `unmount()` takes it out but keeps the GL scene for an instant re-open, `dispose()` frees everything.
 * A lost graphics context makes `hasFailed()` true and calls `onLost` listeners.
 *
 * The poses are shelf-pose.ts, the open-book path shelf-open.ts, the real covers shelf-covers.ts, the
 * scene shelf-scene.ts, the sizing shelf-fit.ts, the marker shelf-hud.ts, the listeners shelf-input.ts;
 * this file keeps the state, the frame (including the flick after a drag) and the lifecycle.
 */

export type { ShelfEls, ShelfEngine };

const STAGE_LABEL = "Bookshelf. Use left and right arrows to browse, Enter to open.";

/** Client only: creates a canvas. The scene is built later, by `prepare()`. */
export function createShelf(
  books: SiteBook[],
  opts: { reducedMotion: boolean },
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
  // the spine faces: painted after they load (capped once the layer waits), again when one arrives late (shelf-spine-fonts.ts)
  let fonts: SpineFonts | null = null;
  const fontCap = createFontCap();

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
  const run = abortable((steps) => slicer.run(steps), () => disposed); // a disposed engine ends a build at its next step

  function build(): Promise<ShelfScene> {
    if (disposed) return Promise.reject(new Aborted());
    // the faces load while three.js does; the first paint waits for them up to the cap (shelf-spine-fonts.ts)
    fonts = createSpineFonts(books, {
      repainted: () => {
        st.dirty = true;
      },
      cap: fontCap.reached,
      also: loadShelfFonts(),
      alsoLate: () => gl?.books.forEach((b) => covers.repaint(b.coverTex, b.d)), // the interface faces came late
    });
    return buildShelf(canvas, books, { disposed: () => disposed, fonts, run, covers });
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
        fonts?.scene(g.books, run);
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
        if (err instanceof Aborted) {
          fonts?.stop(); // disposed part-way: the font watch has no scene to repaint
          return;
        }
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
    fontCap.waiting(false);
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
      fontCap.waiting(true); // someone waits for the shelf now: the font wait is capped from here
      next.host.appendChild(canvas);
      st.fitW = 0; // a new mount refits: the marker and camera limits are for this stage
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
      if (!gl || lost.lost()) return; // the scene switches to its plain grid

      fit();
      // the books stand in place: start past the end of the drop-in
      st.t0 = performance.now() - (intro() + 0.4) * 1000;
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
      fonts?.stop();
      fontCap.stop();
      gl?.dispose();
      gl = null;
    },
  };
}
