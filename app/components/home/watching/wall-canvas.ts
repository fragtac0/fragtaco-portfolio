import type { WallState } from "./wall-types";

/**
 * The wall's canvas, sized: what the block is fitted to and the drawing buffer behind it. The walls'
 * layer is fixed to the viewport today, so until the canvas is in the page the window's size is the
 * size it will have. (This is the one place a smaller frame would be told apart from the window.)
 */

/** The size the block is fitted to: the canvas once it is in the page, else the window the layer will fill. */
export const frameSize = (canvas: HTMLCanvasElement): [number, number] =>
  canvas.clientWidth > 0 ? [canvas.clientWidth, canvas.clientHeight] : [window.innerWidth, window.innerHeight];

/** Reads the canvas's size and its offset in the viewport into the state. */
export function readCanvas(canvas: HTMLCanvasElement, st: WallState) {
  st.vw = canvas.clientWidth;
  st.vh = canvas.clientHeight;
  const r = canvas.getBoundingClientRect();
  st.ox = r.left;
  st.oy = r.top;
}

/** Sizes the drawing buffer for a `w` by `h` CSS size (device pixels, capped at 2), only when it changed. */
export function sizeBuffer(canvas: HTMLCanvasElement, w: number, h: number) {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(w * d);
  const H = Math.round(h * d);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
}
