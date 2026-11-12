/** The public types of the gallery engine (gallery-engine.ts re-exports them). */

import type { Safe } from "./gallery-math";

export type GalleryOptions = {
  items: { src: string }[];
  /** Tile width over height: 16/9 for long form, 9/16 for short form. */
  aspect: number;
  reduced: boolean;
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
