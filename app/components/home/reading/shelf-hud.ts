import { markerLeft, markerShown } from "./shelf-math";

/**
 * The shelf's small overlay: the position marker under the line. It is a 2px track with a thumb
 * that shows where the camera is along a shelf wider than the screen; it moves with `transform`
 * only and is hidden when the whole shelf fits.
 */

/** Puts the marker `top` px from the top of the stage. */
export function placeMarker(el: HTMLElement | undefined, top: number): void {
  if (el) el.style.top = `${Math.round(top)}px`;
}

/**
 * Returns the function the frame calls to move the marker. It writes to the DOM only when the
 * camera (to a thousandth of a unit), the shelf's reach or the visible share has changed, and also
 * leaves the camera x in `data-cam-x` (and the reach in `data-max-x`) for tests and debugging.
 */
export function createMarkerSync(): (
  el: HTMLElement | undefined,
  camX: number,
  maxX: number,
  visible: number,
) => void {
  let lastEl: HTMLElement | undefined;
  let lastKey = "";
  return (el, camX, maxX, visible) => {
    if (!el) return;
    const key = `${camX.toFixed(3)}|${maxX.toFixed(3)}|${visible.toFixed(3)}`;
    if (el === lastEl && key === lastKey) return;
    lastEl = el;
    lastKey = key;
    el.hidden = !markerShown(maxX, visible);
    el.dataset.camX = camX.toFixed(3);
    el.dataset.maxX = maxX.toFixed(3);
    const thumb = el.firstElementChild;
    if (!(thumb instanceof HTMLElement) || visible <= 0) return;
    thumb.style.width = `${visible * 100}%`;
    // a translate in percent of the thumb's own width: the thumb's left edge sits at markerLeft of the track
    thumb.style.transform = `translate3d(${(markerLeft(camX, maxX, visible) / visible) * 100}%, 0, 0)`;
  };
}
