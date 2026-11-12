/**
 * Pointer input for the gallery canvas: move and leave set the hover, a drag nudges the grid a little
 * (it settles back, it never scrolls), and a press and release that did not drag opens the tile under
 * it. Original work for this site. The engine listens on the canvas itself; a page that puts something
 * above the canvas can leave this unused and call the gallery's own `setPointer`, `clearPointer` and
 * `nudge` from its own events.
 */

export type GalleryInputTarget = {
  setPointer(x: number, y: number): void;
  clearPointer(): void;
  nudge(dx: number, dy: number): void;
  /** The tile under a canvas point (as `tileAt`), or null. */
  pick(x: number, y: number): number | null;
};

/** A press that moves further than this is a drag, not a tap. */
export const DRAG_SLOP_PX = 6;
/** A dragged finger moves the grid by this fraction of its own travel (the rest is the rubber band). */
export const DRAG_GAIN = 0.4;

/** Listens on `canvas` until `signal` aborts. `onActivate` gets the tile a tap or click landed on. */
export function attachGalleryInput(
  canvas: HTMLCanvasElement,
  target: GalleryInputTarget,
  onActivate: ((i: number) => void) | undefined,
  signal: AbortSignal,
): void {
  let down: { id: number; x: number; y: number; lastX: number; lastY: number; dragging: boolean } | null = null;
  const at = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const opts = { signal };
  canvas.style.touchAction = "none";

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const [x, y] = at(e);
      down = { id: e.pointerId, x, y, lastX: x, lastY: y, dragging: false };
      canvas.setPointerCapture?.(e.pointerId);
      target.setPointer(x, y);
    },
    opts,
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      const [x, y] = at(e);
      target.setPointer(x, y);
      if (!down || down.id !== e.pointerId) return;
      if (!down.dragging && Math.hypot(x - down.x, y - down.y) > DRAG_SLOP_PX) down.dragging = true;
      if (down.dragging) target.nudge((x - down.lastX) * DRAG_GAIN, (y - down.lastY) * DRAG_GAIN);
      down.lastX = x;
      down.lastY = y;
    },
    opts,
  );
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!down || down.id !== e.pointerId) return;
    const was = down;
    down = null;
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (!cancelled && !was.dragging && onActivate) {
      const [x, y] = at(e);
      const i = target.pick(x, y);
      if (i !== null) onActivate(i);
    }
    if (e.pointerType !== "mouse") target.clearPointer(); // a finger leaves nothing to hover
  };
  canvas.addEventListener("pointerup", (e) => end(e, false), opts);
  canvas.addEventListener("pointercancel", (e) => end(e, true), opts);
  canvas.addEventListener(
    "pointerleave",
    () => {
      if (!down) target.clearPointer(); // while pressed the pointer is captured and the drag goes on outside
    },
    opts,
  );
}
