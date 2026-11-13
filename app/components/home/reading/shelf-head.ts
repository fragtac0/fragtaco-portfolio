import { headGuess } from "./shelf-math";

/**
 * Where the layer's header ends, in CSS pixels from the top of `stage` (the shelf's canvas): the shelf is fitted under it (`flatFrame`) and a lifted book is kept clear of
 * it. The header is the sibling `.xp-head` in the layer; when it cannot be found (a test, a layer
 * not mounted) the guess for this width stands in. The number is whole pixels, so a fit does not
 * chase a fraction.
 */
export function headerBottom(stage: Element): number {
  const head = stage.closest(".home-layer")?.querySelector(".xp-head");
  if (!head) return headGuess(window.innerWidth);
  return Math.max(0, Math.ceil(head.getBoundingClientRect().bottom - stage.getBoundingClientRect().top));
}
