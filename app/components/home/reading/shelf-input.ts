import { isDrag, pressIsStale, startsPress } from "./shelf-drag";
import { clamp, panFromDrag, wheelPanPx } from "./shelf-math";
import type { OpenPath, ShelfCtx } from "./shelf-open";
import type { Book } from "./shelf-scene";

/**
 * The shelf's pointer and keyboard listeners. This file decides which events matter (modifier
 * keys, the stage having focus, the loop running); the engine owns the state and does the work
 * in the handlers. Every listener is removed when `signal` aborts.
 *
 * Keyboard (spec 8.10), while the scene is running: ArrowLeft and ArrowRight move a focus
 * highlight along the books (the hover lift; the camera follows on narrow screens) and put DOM
 * focus on the stage; Enter on the stage opens the highlighted book; Esc closes it (HomePage owns
 * Esc, through the hooks ReadingScene registers). Opening moves focus to "Put it back"; closing
 * returns it to the stage. The highlight clears when the stage loses focus.
 *
 * Panning (spec 3.6): dragging with a mouse, pen or finger moves the camera along the shelf (a
 * movement over 6px is a drag, and a drag never opens a book); the release speed carries on as a
 * flick the engine settles; a horizontal wheel (trackpad) or shift+wheel pans too.
 */

export type ShelfInputHandlers = {
  /** The frame loop is running. */
  running: () => boolean;
  /** A book is open. */
  opened: () => boolean;
  pointerMove: (e: PointerEvent) => void;
  pointerDown: (e: PointerEvent) => void;
  pointerUp: (e: PointerEvent) => void;
  pointerCancel: (e: PointerEvent) => void;
  wheel: (e: WheelEvent) => void;
  pointerLeave: () => void;
  /** The stage lost focus. */
  blur: () => void;
  /** Move the keyboard highlight one book along. */
  arrow: (dir: 1 | -1) => void;
  /** Open the highlighted book. */
  enter: () => void;
  /** The window was resized while running. */
  resize: () => void;
};

export function attachShelfInput(
  canvas: HTMLCanvasElement,
  h: ShelfInputHandlers,
  signal: AbortSignal,
): void {
  const on = { signal };
  canvas.addEventListener("pointermove", h.pointerMove, on);
  canvas.addEventListener("pointerdown", h.pointerDown, on);
  canvas.addEventListener("pointerup", h.pointerUp, on);
  canvas.addEventListener("pointercancel", h.pointerCancel, on);
  canvas.addEventListener("pointerleave", h.pointerLeave, on);
  // not passive: a sideways wheel is ours, and must not also swipe the browser back
  canvas.addEventListener("wheel", h.wheel, { signal, passive: false });
  canvas.addEventListener("blur", h.blur, on);
  window.addEventListener(
    "keydown",
    (e) => {
      if (!h.running() || e.altKey || e.ctrlKey || e.metaKey || h.opened()) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (document.activeElement !== canvas) canvas.focus({ preventScroll: true });
        h.arrow(e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key === "Enter" && document.activeElement === canvas) {
        e.preventDefault();
        h.enter();
      }
    },
    on,
  );
  window.addEventListener("resize", () => h.running() && h.resize(), on);
}

export type ShelfInput = {
  /** Wire these to `attachShelfInput`. */
  handlers: ShelfInputHandlers;
  /** The first of `list` under the pointer ray, or null. */
  pick: (list: Book[]) => Book | null;
  focusNext: (dir: 1 | -1) => void;
  openFocused: () => void;
};

/** The handler bodies: they read and write the engine's state through `ctx`. */
export function createShelfInput(
  ctx: ShelfCtx,
  open: OpenPath,
  /** Re-fits the renderer to the canvas (the engine owns it). */
  resize: () => void,
): ShelfInput {
  const { canvas, st, cam } = ctx;
  const { openBook, closeBook, announce } = open;

  const pick = (list: Book[]): Book | null => {
    const gl = ctx.scene();
    if (!gl) return null;
    gl.ray.setFromCamera(gl.ndc, gl.camera);
    const h = gl.ray.intersectObjects(list.map((b) => b.mesh))[0];
    return h ? (list.find((b) => b.mesh === h.object) ?? null) : null;
  };
  const setNdc = (e: PointerEvent) => {
    const gl = ctx.scene();
    if (!gl) return;
    const r = canvas.getBoundingClientRect();
    gl.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  function focusNext(dir: 1 | -1) {
    const gl = ctx.scene();
    if (!gl || !ctx.running() || st.opened) return;
    const n = gl.books.length;
    st.focusIdx = st.focusIdx < 0 ? (dir > 0 ? 0 : n - 1) : clamp(st.focusIdx + dir, 0, n - 1);
    const b = gl.books[st.focusIdx];
    st.camTarget = clamp(b.base.x, -gl.maxX, gl.maxX);
    st.flickV = 0;
    st.dirty = true;
    announce(`${b.d.title}, ${b.d.author}. Book ${st.focusIdx + 1} of ${n}.`);
  }
  function openFocused() {
    const gl = ctx.scene();
    if (!gl || st.focusIdx < 0) return;
    openBook(gl.books[st.focusIdx]);
  }

  /** Forgets the press: the pointer is up, cancelled, or never had its pointerup. */
  function endPress() {
    st.down = null;
    canvas.classList.remove("dragging");
  }

  const handlers: ShelfInputHandlers = {
    running: ctx.running,
    opened: () => !!st.opened,
    pointerMove(e) {
      const gl = ctx.scene();
      if (!gl) return;
      setNdc(e);
      st.inside = e.pointerType === "mouse";
      // a mouse moving with no button held has no press: its pointerup went elsewhere
      if (pressIsStale(st.down, e)) endPress();
      const d = st.down;
      if (!d || d.id !== e.pointerId || st.opened) return;
      const dx = e.clientX - d.x;
      if (!d.moved && isDrag(dx)) {
        d.moved = true;
        canvas.classList.add("dragging");
      }
      if (!d.moved) return;
      const x = panFromDrag(d.cx, dx, gl.dist, canvas.clientHeight, gl.maxX);
      const dtS = (e.timeStamp - d.t) / 1000;
      if (dtS > 0) {
        const inst = (x - cam.x) / dtS;
        d.v = d.v === 0 ? inst : d.v * 0.4 + inst * 0.6;
        d.t = e.timeStamp;
      }
      cam.x = x;
      cam.xV = 0;
      st.camTarget = null;
      st.dirty = true;
    },
    pointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      setNdc(e);
      if (!startsPress(st.down, e)) return; // a second finger does not take over the drag
      try {
        // captured from the press, so its pointerup always lands here, never on a header button
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // the pointer is already gone: the press simply ends with it
      }
      st.down = {
        id: e.pointerId,
        x: e.clientX,
        cx: cam.x,
        moved: false,
        stopped: st.flickV !== 0,
        t: e.timeStamp,
        v: 0,
      };
      st.flickV = 0;
    },
    pointerUp(e) {
      setNdc(e);
      const d = st.down;
      if (!d || d.id !== e.pointerId) return;
      endPress();
      const gl = ctx.scene();
      if (d.moved) {
        // the release speed carries on, unless the pointer was held still before letting go
        const fresh = e.timeStamp - d.t < 90;
        st.flickV = ctx.reduced || !fresh ? 0 : d.v;
        st.dirty = true;
        return;
      }
      if (d.stopped || !gl || !ctx.running()) return;
      if (st.opened) {
        if (!pick([st.opened])) closeBook(true);
        return;
      }
      const hit = pick(gl.books);
      if (hit) openBook(hit);
    },
    pointerCancel(e) {
      if (st.down?.id === e.pointerId) endPress();
    },
    wheel(e) {
      const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      const px = wheelPanPx(e.deltaX * lines, e.deltaY * lines, e.shiftKey);
      if (px === null) return;
      // a sideways swipe is ours while the layer is up, even when it does not pan (it must not
      // also swipe the browser back); this listener exists only while the layer is mounted
      e.preventDefault();
      const gl = ctx.scene();
      if (!gl || !ctx.running() || st.opened) return;
      cam.x = clamp(cam.x + (px * gl.dist) / canvas.clientHeight, -gl.maxX, gl.maxX);
      cam.xV = 0;
      st.camTarget = null;
      st.flickV = 0;
      st.dirty = true;
    },
    pointerLeave: () => (st.inside = false),
    blur() {
      // the keyboard highlight lives only while the stage has focus (opening moves focus on)
      if (st.opened || st.focusIdx < 0) return;
      st.focusIdx = -1;
      st.dirty = true;
    },
    arrow: focusNext,
    enter: openFocused,
    resize,
  };

  return { handlers, pick, focusNext, openFocused };
}
