/**
 * The rules for a pointer press on the shelf, as pure functions so they are tested without a DOM.
 * A press is remembered in `ShelfState.down`; these decide when it is a drag and when it is stale
 * (its pointerup went elsewhere, for example onto a header button).
 */

/** A move over this many px is a drag, not a tap. */
export const DRAG_PX = 6;

/** The pointer has travelled far enough from where it went down to be dragging. */
export const isDrag = (dxPx: number): boolean => Math.abs(dxPx) > DRAG_PX;

type PointerFacts = { pointerId: number; pointerType: string; buttons: number };

/**
 * A mouse move with no button held cannot belong to a press: the press's pointerup went somewhere
 * else (a header button, outside the window), so the record is stale and must not pan the shelf.
 */
export function pressIsStale(down: { id: number } | null, e: PointerFacts): boolean {
  return !!down && down.id === e.pointerId && e.pointerType === "mouse" && e.buttons === 0;
}

/**
 * Whether a pointerdown starts a new press. A second finger does not take over a live drag, but a
 * press from the same pointer replaces the old record (a mouse shares one id, so any record it left
 * behind is stale by then).
 */
export function startsPress(down: { id: number } | null, e: Pick<PointerFacts, "pointerId">) {
  return !down || down.id === e.pointerId;
}
