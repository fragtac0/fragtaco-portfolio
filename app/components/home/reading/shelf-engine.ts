import type { SiteBook } from "~/types";
import { createCoverQueue } from "./shelf-covers";
import { attachShelfInput, type ShelfInputHandlers } from "./shelf-input";
import { buildShelfScene, loadShelfFonts, type Book, type ShelfScene } from "./shelf-scene";
import {
  CAMERA,
  cameraAt,
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
 * Keyboard (spec 8.10), while the scene is running: ArrowLeft and ArrowRight move a focus
 * highlight along the books (the hover lift; the camera follows on narrow screens) and put DOM
 * focus on the stage; Enter on the stage opens the highlighted book; Esc closes it (HomePage owns
 * Esc, through the hooks ReadingScene registers). Opening moves focus to "Put it back"; closing
 * returns it to the stage. The highlight clears when the stage loses focus.
 */

export type ShelfEls = {
  /** The canvas goes in here. */
  host: HTMLElement;
  /** Half-resolution snapshot of the shelf, blurred in CSS while a book is open. */
  blur: HTMLCanvasElement;
  dim: HTMLElement;
  /** The note card: `h3`, `.by`, `.note` and a `button`. */
  info: HTMLElement;
  hint: HTMLElement;
  /** Optional polite live region for screen readers. */
  status?: HTMLElement;
};

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

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const WIDE = () => window.innerWidth > 860;

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
  const st = {
    t0: 0,
    opened: null as Book | null,
    hoverHit: null as Book | null,
    down: null as { x: number; cx: number; moved: boolean } | null,
    inside: false,
    dirty: true,
    focusIdx: -1,
    camTarget: null as number | null,
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

  const announce = (text: string) => {
    if (els?.status) els.status.textContent = text;
  };

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

  // ---- interaction

  const pick = (list: Book[]): Book | null => {
    if (!gl) return null;
    gl.ray.setFromCamera(gl.ndc, gl.camera);
    const h = gl.ray.intersectObjects(list.map((b) => b.mesh))[0];
    return h ? (list.find((b) => b.mesh === h.object) ?? null) : null;
  };
  const setNdc = (e: PointerEvent) => {
    if (!gl) return;
    const r = canvas.getBoundingClientRect();
    gl.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  /** The open book and its note sit side by side, and the pair is centred on screen. */
  function layoutOpen(b: Book) {
    if (!gl || !els) return;
    const { T, camera, ray, ndc2, fwd } = gl;
    const info = els.info;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    const tanH = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const wide = WIDE();
    const dist = b.H / (2 * tanH * (wide ? 0.6 : 0.4));
    const ppu = vh / (2 * tanH * dist);
    const bw = (b.W * Math.cos(0.3) + b.T * Math.sin(0.3)) * ppu;
    const gapPx = clamp(vw * 0.035, 28, 64);
    const iw = info.offsetWidth;
    let sx = vw / 2;
    let sy = vh * 0.36;
    if (wide) {
      const x0 = (vw - (bw + gapPx + iw)) / 2;
      sx = x0 + bw / 2;
      sy = vh * 0.5;
      info.style.left = Math.round(x0 + bw + gapPx) + "px";
    } else {
      info.style.left = "";
    }
    ndc2.set((sx / vw) * 2 - 1, 1 - (sy / vh) * 2);
    ray.setFromCamera(ndc2, camera);
    camera.getWorldDirection(fwd);
    const dir = ray.ray.direction;
    b.openPos.copy(ray.ray.origin).addScaledVector(dir, dist / dir.dot(fwd));
  }

  const setNote = (on: boolean) => {
    if (!els) return;
    const { info, blur, dim, hint } = els;
    for (const el of [blur, dim, info]) el.classList.toggle("on", on);
    hint.classList.toggle("off", on);
    // a hidden note is out of the tab order and the reading order
    info.inert = !on;
    info.setAttribute("aria-hidden", String(!on));
  };

  function openBook(b: Book) {
    if (!gl || !els || !running) return;
    if (st.opened || performance.now() - st.t0 < intro() * 1000) return;
    const { renderer: r, scene, camera } = gl;
    // draw the shelf once without the book that is about to leave, and keep that as the backdrop
    b.g.visible = b.contact.visible = b.wallSh.visible = false;
    r.render(scene, camera);
    const w = Math.round(canvas.width / 2);
    const h = Math.round(canvas.height / 2);
    const bx = els.blur.getContext("2d");
    // reallocate only when the size changes (assigning a size clears and reallocates the canvas)
    if (els.blur.width !== w) els.blur.width = w;
    if (els.blur.height !== h) els.blur.height = h;
    if (bx) {
      bx.clearRect(0, 0, w, h);
      bx.drawImage(canvas, 0, 0, w, h);
    }
    b.g.visible = true;
    st.opened = b;
    st.dirty = true;
    layoutOpen(b);
    const { info } = els;
    const set = (sel: string, text: string) => {
      const el = info.querySelector(sel);
      if (el) el.textContent = text;
    };
    set("h3", b.d.title);
    set(".by", `${b.d.author}, ${b.d.pages} pages`);
    set(".note", b.d.note);
    setNote(true);
    announce(`${b.d.title}, ${b.d.author}, ${b.d.pages} pages. ${b.d.note}`);
    info.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }

  /** `refocus`: give focus back to the stage (not when the whole layer is going away). */
  function closeBook(refocus: boolean) {
    if (!st.opened) return;
    st.opened = null;
    st.dirty = true;
    setNote(false);
    announce("");
    if (refocus && els) canvas.focus({ preventScroll: true });
  }

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

  function focusNext(dir: 1 | -1) {
    if (!gl || !running || st.opened) return;
    const n = gl.books.length;
    st.focusIdx = st.focusIdx < 0 ? (dir > 0 ? 0 : n - 1) : clamp(st.focusIdx + dir, 0, n - 1);
    const b = gl.books[st.focusIdx];
    st.camTarget = clamp(b.base.x, -gl.maxX, gl.maxX);
    st.dirty = true;
    announce(`${b.d.title}, ${b.d.author}. Book ${st.focusIdx + 1} of ${n}.`);
  }
  function openFocused() {
    if (!gl || st.focusIdx < 0) return;
    openBook(gl.books[st.focusIdx]);
  }

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

  const input: ShelfInputHandlers = {
    running: () => running,
    opened: () => !!st.opened,
    pointerMove(e) {
      if (!gl) return;
      setNdc(e);
      st.inside = e.pointerType === "mouse";
      if (st.down && e.pointerType !== "mouse" && !st.opened) {
        const dx = e.clientX - st.down.x;
        if (Math.abs(dx) > 6) st.down.moved = true;
        cam.x = clamp(
          st.down.cx - ((dx * gl.dist) / canvas.clientHeight) * 0.9,
          -gl.maxX,
          gl.maxX,
        );
        cam.xV = 0;
        st.camTarget = null;
        st.dirty = true;
      }
    },
    pointerDown(e) {
      setNdc(e);
      st.down = { x: e.clientX, cx: cam.x, moved: false };
    },
    pointerUp(e) {
      setNdc(e);
      const moved = st.down?.moved;
      st.down = null;
      if (moved || !gl || !running) return;
      if (st.opened) {
        if (!pick([st.opened])) closeBook(true);
        return;
      }
      const hit = pick(gl.books);
      if (hit) openBook(hit);
    },
    pointerCancel: () => (st.down = null),
    pointerLeave: () => (st.inside = false),
    blur() {
      // the keyboard highlight lives only while the stage has focus (opening moves focus on)
      if (st.opened || st.focusIdx < 0) return;
      st.focusIdx = -1;
      st.dirty = true;
    },
    arrow: focusNext,
    enter: openFocused,
    resize: fit,
  };

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
      attachShelfInput(canvas, input, ac.signal);
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
