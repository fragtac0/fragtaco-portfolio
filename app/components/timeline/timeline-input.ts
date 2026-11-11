// Pointer, wheel and keyboard input for the timeline canvas. It only turns events into calls on the
// controls the canvas module hands in; it keeps no picture state of its own.
import { moveFocus, PAN_STEP, wheelIntent, wheelZoomFactor } from "./timeline-motion";

/** Zoom factor of one `+` or `-` press and of the two buttons. */
export const KEY_ZOOM = 1.5;
/** A touch that moves less than this is a tap, not a drag. */
const TAP_SLOP = 6;

export interface Controls {
  /** Zoom by `factor` keeping the screen point (px, py) still. */
  zoomAt(factor: number, px: number, py: number, animate: boolean): void;
  /** Move the picture by (dx, dy) screen pixels. */
  panBy(dx: number, dy: number, animate: boolean): void;
  fit(animate: boolean): void;
  /** The pointer is over (px, py), or has left (null). */
  pointerAt(px: number | null, py: number | null): void;
  /** A finger tapped (px, py): show that day. */
  tapAt(px: number, py: number): void;
  /** Move the keyboard's focus cell (or start it) to a day, bringing it into view. */
  focusCell(next: (current: number) => number): void;
  clearFocus(): void;
  size(): { vw: number; vh: number; cols: number; total: number };
  reduced(): boolean;
}

/** Wires the canvas's events to the controls. Returns the function that removes them. */
export function attachInput(canvas: HTMLCanvasElement, ctl: Controls): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch: number | null = null;
  let lastPanAt = -1e9;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();

    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const distance = () => {
    const [a, b] = [...pointers.values()];

    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const middle = () => {
    const [a, b] = [...pointers.values()];

    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // a pointer that is already gone (or a scripted one): the events still arrive while it is over the canvas
    }
    pointers.set(e.pointerId, local(e));
    moved = 0;
    if (pointers.size === 2) pinch = distance();
    canvas.dataset.dragging = "true";
    ctl.pointerAt(null, null);
  };

  const onMove = (e: PointerEvent) => {
    const at = local(e);
    const before = pointers.get(e.pointerId);
    if (!before) {
      if (e.pointerType === "mouse") ctl.pointerAt(at.x, at.y);
      return;
    }
    if (pointers.size === 1) {
      moved += Math.abs(at.x - before.x) + Math.abs(at.y - before.y);
      pointers.set(e.pointerId, at);
      if (moved > TAP_SLOP) ctl.panBy(at.x - before.x, at.y - before.y, false);
      return;
    }
    const mid = pinch !== null ? middle() : null;
    pointers.set(e.pointerId, at);
    if (pinch === null || !mid) return;
    const next = distance();
    const now = middle();
    moved = TAP_SLOP + 1;
    // zoom about where the fingers were, then follow them: the day between them stays between them
    if (pinch > 0 && next > 0) ctl.zoomAt(next / pinch, mid.x, mid.y, false);
    ctl.panBy(now.x - mid.x, now.y - mid.y, false);
    pinch = next;
  };

  const onUp = (e: PointerEvent) => {
    const had = pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) delete canvas.dataset.dragging;
    if (had && pointers.size === 0 && moved <= TAP_SLOP && e.pointerType !== "mouse") {
      if (e.type === "pointerup") ctl.tapAt(local(e).x, local(e).y);
    } else if (had && e.pointerType === "mouse" && pointers.size === 0) {
      const at = local(e);
      ctl.pointerAt(at.x, at.y);
    }
  };

  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && pointers.size === 0) ctl.pointerAt(null, null);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const at = local(e);
    const intent = wheelIntent(e, performance.now() - lastPanAt);
    if (intent === "pan") {
      lastPanAt = performance.now();
      ctl.panBy(-e.deltaX, -e.deltaY, false);
      return;
    }
    ctl.zoomAt(wheelZoomFactor(e), at.x, at.y, !ctl.reduced());
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const { vw, vh, cols, total } = ctl.size();
    const animate = !ctl.reduced();
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (arrows.includes(e.key)) {
      e.preventDefault();
      if (e.shiftKey) {
        ctl.focusCell((current) => moveFocus(current, e.key, cols, total));
        return;
      }
      const dx = e.key === "ArrowLeft" ? PAN_STEP : e.key === "ArrowRight" ? -PAN_STEP : 0;
      const dy = e.key === "ArrowUp" ? PAN_STEP : e.key === "ArrowDown" ? -PAN_STEP : 0;
      ctl.panBy(dx, dy, animate);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      ctl.zoomAt(KEY_ZOOM, vw / 2, vh / 2, animate);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      ctl.zoomAt(1 / KEY_ZOOM, vw / 2, vh / 2, animate);
    } else if (e.key === "0") {
      e.preventDefault();
      ctl.fit(animate);
    } else if (e.key === "Escape") {
      ctl.clearFocus();
    }
  };

  const onBlur = () => ctl.clearFocus();

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("blur", onBlur);

  return () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("blur", onBlur);
  };
}
