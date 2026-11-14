import { windowSize } from "../layer/frame-box";
import { headGuess, settleHead } from "./shelf-math";

/**
 * Where the layer's header ends, in CSS pixels from the top of `stage` (the shelf's canvas): the shelf is fitted under it (`flatFrame`) and a lifted book is kept clear of
 * it. The header is the sibling `.xp-head` in the layer; when it cannot be found (a test, a layer
 * not mounted) the guess for this width stands in. The number is whole pixels, so a fit does not
 * chase a fraction, and it is the box's guess when the two are within a pixel (`settleHead`).
 */
export function headerBottom(stage: Element): number {
  const layer = stage.closest(".home-layer");
  const head = layer?.querySelector(".xp-head");
  if (!layer || !head) return headGuess(windowSize()[0]);
  // from the layer's top, which is the window the row is fitted to (the canvas itself may be a smaller frame)
  const measured = Math.max(0, Math.ceil(head.getBoundingClientRect().bottom - layer.getBoundingClientRect().top));
  return settleHead(measured, headGuess(windowSize()[0]));
}
