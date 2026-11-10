/**
 * The shelf's pointer and keyboard listeners. This file decides which events matter (modifier
 * keys, the stage having focus, the loop running); the engine owns the state and does the work
 * in the handlers. Every listener is removed when `signal` aborts.
 *
 * Keyboard (spec 8.10), while the scene is running: ArrowLeft and ArrowRight move a focus
 * highlight along the books and put DOM focus on the stage; Enter on the stage opens the
 * highlighted book. Esc is HomePage's, through the hooks ReadingScene registers.
 */

export type ShelfInputHandlers = {
  /** The frame loop is running. */
  running: () => boolean;
  /** A book is open. */
  opened: () => boolean;
  pointerMove: (e: PointerEvent) => void;
  pointerDown: (e: PointerEvent) => void;
  pointerUp: (e: PointerEvent) => void;
  pointerCancel: () => void;
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
