/** The public types of the gallery engine (gallery-engine.ts re-exports them). */

import type { Safe } from "./gallery-math";

export type GalleryOptions = {
  /** `src` is the tile's picture; `art` its local stand-in (a data address) that shows until the picture is in and for good if it never comes. */
  items: { src: string; art: string }[];
  /** Tile width over height: 16/9 for long form, 9/16 for short form. */
  aspect: number;
  reduced: boolean;
  /** Asked once, when the first frame is about to be drawn: true if the wall is already on screen as plain links (a slow load), so the tiles are drawn whole at once, with no arrival, and the links can fade out under them without a gap. */
  instant?: boolean | (() => boolean);
  /** The first frame has been drawn (once): the engine's tiles are on the canvas, so the links may go. */
  onDrawn?(): void;
  onHover(i: number | null): void;
  /** The safe area (heading band, dock band, margin); a function is asked again at every `resize()`. Default: the 4% margin. */
  safe?: Safe | (() => Safe);
  /** A tap or click that did not drag landed on tile `i`. */
  onActivate?(i: number): void;
  /** The browser took the GL context away: the engine has stopped; show the plain grid. */
  onLost?(): void;
};

export type Gallery = {
  resize(): void;
  setPointer(x: number, y: number): void;
  clearPointer(): void;
  nudge(dx: number, dy: number): void;
  focus(i: number | null): void;
  destroy(): void;
};
