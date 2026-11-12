import { clamp, FRONT } from "./shelf-math";
import type { Book, ShelfScene } from "./shelf-scene";

/**
 * The open-book path: draw the shelf once without the book, keep that as the blurred backdrop,
 * lift the book to the middle beside its note, and put it all back on close. The engine owns the
 * state; this module reads and writes it through the context it is given.
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
  /** The position marker under the line: a track with one thumb child (`.shelf-marker`). */
  marker?: HTMLElement;
  /** Optional polite live region for screen readers. */
  status?: HTMLElement;
};

/** The engine's interaction state, shared with the input and open-book code. */
export type ShelfState = {
  t0: number;
  opened: Book | null;
  hoverHit: Book | null;
  /**
   * A pointer is down. `moved`: it has travelled over 6px, so it is a drag and never opens a book.
   * `stopped`: it landed on a coasting shelf to stop it, so it does not open a book either.
   * `t` and `v` are the time and smoothed speed (units per second) of the last drag move.
   */
  down: {
    id: number;
    x: number;
    cx: number;
    moved: boolean;
    stopped: boolean;
    t: number;
    v: number;
  } | null;
  /** The shelf's coasting speed after a flick, in world units per second (0 when settled). */
  flickV: number;
  inside: boolean;
  dirty: boolean;
  focusIdx: number;
  camTarget: number | null;
  fitW: number;
  fitH: number;
};

/** What the engine lends to the modules it split off: its canvas, state and live accessors. */
export type ShelfCtx = {
  canvas: HTMLCanvasElement;
  st: ShelfState;
  cam: { x: number; xV: number };
  scene: () => ShelfScene | null;
  els: () => ShelfEls | null;
  running: () => boolean;
  /** Motion is reduced: no coasting after a flick. */
  reduced: boolean;
  /** Seconds the drop-in lasts (0 when motion is reduced). */
  intro: () => number;
};

export type OpenPath = {
  openBook: (b: Book) => void;
  /** `refocus`: give focus back to the stage (not when the whole layer is going away). */
  closeBook: (refocus: boolean) => void;
  /** Shows or hides the blur, dim and note, and keeps the hidden note out of the tab order. */
  setNote: (on: boolean) => void;
  announce: (text: string) => void;
};

const WIDE = () => window.innerWidth > 860;

export function createOpenPath(ctx: ShelfCtx): OpenPath {
  const { canvas, st } = ctx;

  const announce = (text: string) => {
    const els = ctx.els();
    if (els?.status) els.status.textContent = text;
  };

  /**
   * The open book and its note sit side by side, and the pair is centred on screen. The camera is
   * orthographic, so the book is brought forward in place and drawn larger (`openScale`, never
   * smaller than it stands in the row) to about 60% of the height (40% on a phone).
   */
  function layoutOpen(b: Book, gl: ShelfScene, els: ShelfEls) {
    const { camera } = gl;
    const info = els.info;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    const wide = WIDE();
    b.openScale = Math.max(1, (vh * (wide ? 0.6 : 0.4)) / (b.H * gl.scale));
    const bw = (b.W * Math.cos(0.3) + b.T * Math.sin(0.3)) * gl.scale * b.openScale;
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
    // screen position to world: the camera sits at (cam.x, yc) and sees `scale` pixels per unit
    b.openPos.set(
      camera.position.x + (sx - vw / 2) / gl.scale,
      camera.position.y + (vh / 2 - sy) / gl.scale,
      FRONT + 1,
    );
  }

  const setNote = (on: boolean) => {
    const els = ctx.els();
    if (!els) return;
    const { info, blur, dim, hint, marker } = els;
    for (const el of [blur, dim, info]) el.classList.toggle("on", on);
    hint.classList.toggle("off", on);
    marker?.classList.toggle("off", on);
    // a hidden note is out of the tab order and the reading order
    info.inert = !on;
    info.setAttribute("aria-hidden", String(!on));
  };

  function openBook(b: Book) {
    const gl = ctx.scene();
    const els = ctx.els();
    if (!gl || !els || !ctx.running()) return;
    if (st.opened || performance.now() - st.t0 < ctx.intro() * 1000) return;
    const { renderer: r, scene, camera } = gl;
    // draw the shelf once without the book that is about to leave, and keep that as the backdrop
    b.g.visible = b.wallSh.visible = false;
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
    layoutOpen(b, gl, els);
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

  function closeBook(refocus: boolean) {
    if (!st.opened) return;
    st.opened = null;
    st.dirty = true;
    setNote(false);
    announce("");
    if (refocus && ctx.els()) canvas.focus({ preventScroll: true });
  }

  return { openBook, closeBook, setNote, announce };
}
