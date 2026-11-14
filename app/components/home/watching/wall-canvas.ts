import { windowSize, type FrameBox } from "../layer/frame-box";
import type { Frame } from "../layer/frame-math";
import type { WallGl } from "./wall-gl";
import type { WallState } from "./wall-types";

/**
 * The wall's canvas, sized: what the block is fitted to and the drawing buffer behind it. With no frame the canvas fills the layer
 * (fixed to the window) and the block is fitted to the canvas; with a frame (layer/frame-math.ts) the block is still fitted to the
 * window the open page would fill, and the canvas holds that picture scaled to cover the frame.
 */

/** Device pixels per CSS pixel the drawing buffer is made at: the screen's, up to 2. */
export const bufferDpr = () => Math.min(window.devicePixelRatio || 1, 2);

/**
 * Reads the size the block is laid out for into the state, and where the canvas is in the window. Framed, the layout window is
 * the window and the offset is the frame's (no layout is read for it); not framed, both are the canvas's own.
 */
export function readCanvas(canvas: HTMLCanvasElement, st: WallState, frame: Frame | null) {
  if (frame) {
    [st.vw, st.vh] = windowSize();
    st.ox = frame.left;
    st.oy = frame.top;
    return;
  }
  st.vw = canvas.clientWidth;
  st.vh = canvas.clientHeight;
  const r = canvas.getBoundingClientRect();
  st.ox = r.left;
  st.oy = r.top;
}

/**
 * Sizes the drawing buffer for a `vw` by `vh` window drawn into the frame in force, only when it changed (assigning a size clears
 * the canvas), and tells the second pass where the window's picture goes in it.
 */
export function fitBuffer(canvas: HTMLCanvasElement, box: FrameBox, wgl: WallGl | null, vw: number, vh: number) {
  const view = box.view(vw, vh, bufferDpr());
  if (canvas.width !== view.bufW || canvas.height !== view.bufH) {
    canvas.width = view.bufW;
    canvas.height = view.bufH;
  }
  wgl?.setPicture(view.full ? null : view);
}

/** Docks or undocks the wall's canvas: out of the tab order and let the pointer through while docked, the hover and the press forgotten. */
export function dockCanvas(canvas: HTMLCanvasElement, st: WallState, on: boolean) {
  canvas.style.pointerEvents = on ? "none" : "";
  canvas.tabIndex = on ? -1 : 0;
  if (!on) {
    canvas.removeAttribute("aria-hidden");
    return;
  }
  canvas.setAttribute("aria-hidden", "true");
  canvas.blur();
  st.mouse.inside = false;
  st.hoverKey = null;
  st.dragging = false;
  st.down = null;
  st.kbd = null;
}
