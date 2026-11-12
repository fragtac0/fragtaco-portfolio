import { clamp, FRONT } from "./shelf-math";
import { headerBottom } from "./shelf-head";
import { liftLayout, MARGIN, sideBySide } from "./shelf-lift";
import type { Book, ShelfScene } from "./shelf-scene";

/**
 * The open-book path: work out where the lifted book goes and where its note stands (`liftLayout`),
 * show the note and put it all back on close. The row stays where it is and dims (the pose does
 * that). The engine owns the state; this module reads and writes it through the context it is given.
 */

export type ShelfEls = {
  /** The canvas goes in here. */
  host: HTMLElement;
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
  /** The header's bottom the last fit was made under (px). */
  fitTop: number;
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
  /** Shows or hides the note, and keeps the hidden note out of the tab order. */
  setNote: (on: boolean) => void;
  announce: (text: string) => void;
};

export function createOpenPath(ctx: ShelfCtx): OpenPath {
  const { canvas, st } = ctx;

  const announce = (text: string) => {
    const els = ctx.els();
    if (els?.status) els.status.textContent = text;
  };

  /**
   * Works out where the lifted book goes (`liftLayout`, in pixels), puts the note card beside it
   * (wide) and hands the pose its numbers in world units: how far it rises, where its centre ends
   * up, how large it is drawn (never larger than in the row) and the highest its centre may go
   * (its top stays inside the layer).
   */
  function layoutOpen(b: Book, gl: ShelfScene, els: ShelfEls) {
    const { camera } = gl;
    const info = els.info;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    const wide = sideBySide(window.innerWidth, window.innerHeight);
    const sc = gl.scale;
    const baseRow = vh / 2 + camera.position.y * sc; // the row of the books' feet
    const rowH = b.H * sc;
    const yaw = 0.3; // the cover's turn, as in the pose
    const out = liftLayout({
      vw,
      vh,
      rowX: vw / 2 + (b.base.x - camera.position.x) * sc,
      rowTop: baseRow - rowH,
      rowH,
      coverW: (b.W * Math.cos(yaw) + b.T * Math.sin(yaw)) * sc,
      headBottom: headerBottom(canvas),
      baseRow,
      wide,
      note: { w: info.offsetWidth, h: info.offsetHeight },
      gap: clamp(vw * 0.035, 28, 64),
    });
    if (out.note) {
      info.style.left = Math.round(out.note.left) + "px";
      info.style.top = Math.round(out.note.centreY) + "px";
    } else {
      info.style.left = info.style.top = ""; // the stylesheet's bottom sheet
    }
    // read by scripts/audit/shelf.json: the lifted book's box on the stage (left, top, right, bottom) and its rise
    const bw = (b.W * Math.cos(yaw) + b.T * Math.sin(yaw)) * sc * out.scale;
    const bh = rowH * out.scale;
    canvas.dataset.openBox = [out.cx - bw / 2, out.cy - bh / 2, out.cx + bw / 2, out.cy + bh / 2]
      .map(Math.round)
      .join(",");
    canvas.dataset.openLift = String(Math.round(out.lift));
    // screen to world: the camera sits at (cam.x, yc) and sees `scale` pixels per unit
    const worldY = (py: number) => camera.position.y + (vh / 2 - py) / sc;
    b.lift = out.lift / sc;
    b.openScale = out.scale;
    b.yMax = worldY(MARGIN + rowH / 2);
    b.openPos.set(
      camera.position.x + (out.cx - vw / 2) / sc,
      worldY(out.cy),
      FRONT + b.W / 2 + 0.12, // in front of every neighbour (the pose's z for a risen book)
    );
  }

  const setNote = (on: boolean) => {
    const els = ctx.els();
    if (!els) return;
    const { info, hint, marker } = els;
    info.classList.toggle("on", on);
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
    st.opened = b;
    st.dirty = true;
    st.camTarget = null; // the camera stays where it is, so the book is laid out where the row is now
    const { info } = els;
    const set = (sel: string, text: string) => {
      const el = info.querySelector(sel);
      if (el) el.textContent = text;
    };
    // the note's text first: a narrow screen's sheet is as tall as its text
    set("h3", b.d.title);
    set(".by", `${b.d.author}, ${b.d.pages} pages`);
    set(".note", b.d.note);
    layoutOpen(b, gl, els);
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
