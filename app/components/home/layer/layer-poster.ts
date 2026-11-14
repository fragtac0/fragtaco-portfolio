/**
 * The block's own picture, kept inside the layer while the layer is not yet showing its scene.
 *
 * The layer clips a full-screen box that grows out of its block (interest-layer.tsx). Without a
 * picture in that box it is the plain ground until the scene has drawn its first frame: the block
 * looked wiped out the moment it was clicked. So a copy of the block is stood in the box at the
 * block's own place and size, and grown with the clip to cover the screen, then dissolved once the
 * scene has really drawn. Closing before that, it shrinks back with the clip.
 */

export type Rect = { left: number; top: number; width: number; height: number };

/** How the poster ends up when the layer is fully open: scaled about its own centre to cover the screen. */
export type PosterPose = { dx: number; dy: number; scale: number };

/**
 * The move that takes a poster standing at `block` (in screen pixels) to covering a `vw` by `vh`
 * screen: the smallest scale at which it covers, centred on the screen. Because the clip's edges
 * and the poster's edges both move in a straight line over the same easing, a poster that covers
 * the screen at the end covers the clip all the way.
 */
export function posterPose(block: Rect, vw: number, vh: number): PosterPose {
  if (block.width <= 0 || block.height <= 0) return { dx: 0, dy: 0, scale: 1 };
  return {
    dx: vw / 2 - (block.left + block.width / 2),
    dy: vh / 2 - (block.top + block.height / 2),
    scale: Math.max(vw / block.width, vh / block.height),
  };
}

/** The CSS transform for a pose (`none` for no pose: the poster at its own place and size). */
export function posterTransform(pose: PosterPose | null): string {
  return pose
    ? `translate(${pose.dx}px, ${pose.dy}px) scale(${pose.scale})`
    : "none";
}

/**
 * A copy of the block for the poster (DOM, so checked in the browser audit, `shelf.json` and
 * `wall.json`, not by a unit test): nothing in it can be reached or announced (ids, links,
 * buttons and tab stops are dropped), the wall's drifting columns are held where they were, the small shelf's
 * painted spines are copied across, and it is
 * sized exactly like the block was.
 */
export function cloneBlock(block: HTMLElement, rect: Rect): HTMLElement {
  const copy = block.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("inert", "");
  for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
  for (const el of copy.querySelectorAll("button,a,[tabindex]")) {
    if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) el.remove();
    else el.removeAttribute("tabindex");
  }
  // the wall's columns drift by a CSS animation: the copy stands still where the original is
  const was = block.querySelectorAll<HTMLElement>(".mw-col");
  copy.querySelectorAll<HTMLElement>(".mw-col").forEach((col, i) => {
    col.style.animation = "none";
    const at = was[i] ? getComputedStyle(was[i]).transform : "none";
    col.style.transform = at;
  });
  // a cloned canvas is empty: the small shelf's spines are copied across as they were painted
  const drawn = block.querySelectorAll<HTMLCanvasElement>("canvas");
  copy.querySelectorAll<HTMLCanvasElement>("canvas").forEach((c, i) => {
    const from = drawn[i];
    if (!from || !from.width || !from.height) return;
    c.width = from.width;
    c.height = from.height;
    c.getContext("2d")?.drawImage(from, 0, 0);
  });
  copy.style.width = `${rect.width}px`;
  copy.style.height = `${rect.height}px`;
  copy.style.minHeight = "0";
  return copy;
}
