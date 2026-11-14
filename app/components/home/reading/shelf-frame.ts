import { clearPlacement, noTransition, windowSize, type FrameBox } from "../layer/frame-box";
import { dotPlacement, subWindow } from "../layer/frame-math";
import type { ShelfCtx, ShelfState } from "./shelf-open";
import type { ShelfScene } from "./shelf-scene";

/**
 * The shelf's picture in a frame (layer/frame-math.ts). The row is always fitted to the window the open page would fill
 * (`stageSize`); a frame only changes how much of that picture the canvas shows: the renderer is the frame's size and the
 * orthographic camera looks at the part of the window the frame covers (`setViewOffset`), so the ledge, the books and their shadows are drawn
 * as they are in the open page, scaled to cover the frame and centred. The dot field is a canvas of its own behind the row: it
 * is placed by the same maths (`placeDots`).
 */

/** The size the row is fitted to: the canvas's own when nothing is framed, else the window. */
export function stageSize(canvas: HTMLCanvasElement, box: FrameBox): [number, number] {
  return box.frame() ? windowSize() : [canvas.clientWidth, canvas.clientHeight];
}

/**
 * Sizes the renderer for the frame in force and points the camera at what it shows. Only when something changed: setting a canvas
 * size clears it, and the caller draws right after.
 */
export function applyView(ctx: ShelfCtx, gl: ShelfScene, vw: number, vh: number): void {
  const f = ctx.box.frame();
  const sub = subWindow(f, vw, vh);
  const cw = f ? f.width : vw;
  const ch = f ? f.height : vh;
  const key = `${cw}x${ch}|${sub.x},${sub.y},${sub.w},${sub.h}|${vw}x${vh}`;
  if (key === ctx.st.viewKey) return;
  ctx.st.viewKey = key;
  gl.renderer.setSize(cw, ch, false);
  const whole = sub.x === 0 && sub.y === 0 && sub.w === vw && sub.h === vh;
  if (whole) gl.camera.clearViewOffset();
  else gl.camera.setViewOffset(vw, vh, sub.x, sub.y, sub.w, sub.h);
  gl.camera.updateProjectionMatrix();
}

const DOT_STYLES = ["position", "left", "top", "width", "height", "transform", "transform-origin", "clip-path"] as const;

/** Puts the dot field where the frame's picture has it (or back to the stylesheet's place with no frame). */
export function placeDots(dots: HTMLElement | undefined, box: FrameBox, vw: number, vh: number, ledgeTop: number): void {
  if (!dots) return;
  const f = box.frame();
  const p = f && dotPlacement(f, vw, vh, ledgeTop);
  const s = dots.style;
  if (!p) {
    clearPlacement(dots, DOT_STYLES, () => box.frame() !== null);
    return;
  }
  s.position = "fixed";
  s.left = `${p.left}px`;
  s.top = `${p.top}px`;
  s.width = `${p.width}px`;
  s.height = `${p.height}px`;
  s.transformOrigin = "0 0";
  s.transform = `scale(${p.scale})`;
  const [t, r, b, l] = p.inset;
  s.clipPath = `inset(${t}px ${r}px ${b}px ${l}px)`;
  noTransition(dots);
}

/** Docks or undocks the shelf's canvas: out of the tab order and let the pointer through while docked, the hover and the press forgotten. */
export function dockStage(canvas: HTMLCanvasElement, st: ShelfState, on: boolean): void {
  canvas.style.pointerEvents = on ? "none" : "";
  canvas.tabIndex = on ? -1 : 0;
  if (!on) {
    canvas.removeAttribute("aria-hidden");
    return;
  }
  canvas.setAttribute("aria-hidden", "true");
  canvas.blur();
  st.inside = false;
  st.hoverHit = null;
  st.focusIdx = -1;
  st.down = null;
  st.flickV = 0;
  st.dirty = true;
  canvas.classList.remove("dragging");
}
