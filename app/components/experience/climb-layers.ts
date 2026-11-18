// What the map's loop writes to its layers each frame or when its size changes (climb-engine.ts), apart so the loop's file stays a loop.
import { FLIP_AT } from "./climb-constants";
import type { CanvasLayer, PinLayer } from "./climb-engine-types";
import type { Pin } from "./trail-layer";

/** Move each bead to its head on the stage: its place, its growth with the camera's tilt (`k`: 0 overview, 1 climb), which side its label is on, and its stacking by height. */
export function placePins(pins: readonly PinLayer[], places: readonly Pin[], k: number, stageWidth: number): void {
  places.forEach(({ head }, i) => {
    pins[i].style.transform = `translate(${head[0]}px, ${head[1]}px)`;
    pins[i].style.setProperty("--bs", String(0.5 + 0.5 * k));
    pins[i].style.setProperty("--flip", head[0] > FLIP_AT * stageWidth ? "1" : "0");
    pins[i].style.zIndex = String(Math.round(head[1]));
  });
}

/** Give a canvas the size of `w` by `h` CSS pixels at the pixel ratio (this clears it, even at the size it has: the caller draws again before the next paint). */
export function sizeCanvas(c: CanvasLayer, w: number, h: number, ratio: number): void {
  c.width = Math.round(w * ratio);
  c.height = Math.round(h * ratio);
}

/** Leave nothing drawn on the canvases (the page falls back to the list when the heights fail). */
export function clearCanvases(canvases: ReadonlyArray<readonly [CanvasRenderingContext2D | null, CanvasLayer]>): void {
  for (const [c, cv] of canvases) {
    c?.setTransform(1, 0, 0, 1, 0, 0);
    c?.clearRect(0, 0, cv.width, cv.height);
  }
}
