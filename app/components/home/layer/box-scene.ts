import type { LayerKind } from "./layer-state";

/**
 * A scene's own element, made once per page on the client. It holds the scene's DOM (the canvas, the chip, the book's note, the
 * lists a screen reader reads) for as long as the page lives and is the frame the open move grows: it stands in its home box
 * while the layer is closed (home-page.tsx, interest-blocks.tsx) and move-driver.ts carries it to the layer and back. In the box
 * it is hidden from the tab order and from a screen reader (the whole block is one button); `data-at` says where it is.
 * The texture under the scene is the open page's own (hero.css `.home-page .tex`).
 */
export function makeScene(kind: LayerKind): HTMLElement {
  const el = document.createElement("div");
  el.className = "box-scene";
  el.dataset.kind = kind;
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("inert", "");
  const tex = document.createElement("div");
  tex.className = "tex";
  el.appendChild(tex);
  return el;
}

/** The scene has left its box for the layer (or come back): a screen reader and the keyboard reach it only in the layer. */
export function setSceneInBox(el: HTMLElement, inBox: boolean): void {
  if (inBox) {
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("inert", "");
  } else {
    el.removeAttribute("aria-hidden");
    el.removeAttribute("inert");
  }
}
