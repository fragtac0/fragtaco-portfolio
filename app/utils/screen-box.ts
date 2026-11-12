/** An element's box on the screen (after any transform). Kept here so the work components read a box in one place. */
export function screenBox(el: Element): DOMRect {
  return el.getBoundingClientRect();
}
