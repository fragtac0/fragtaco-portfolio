import type * as THREE from "three";
import type { SiteBook } from "~/types";
import { drawSpine, drawSpinePhoto, type SpineSize } from "./spine-draw";
import { spineColours, spineStyle, type SpineColours, type SpineStyle } from "./spine-styles";

/**
 * The spines of the shelf as textures. Each spine's canvas is the spine as it stands on screen
 * times the device pixel ratio (at most 2), painted by `drawSpine` (spine-draw.ts) from the
 * book's colours. It is painted first from the book's own colour, repainted with a short crossfade
 * when the cover's colours arrive (shelf-covers.ts), and painted from the picture when the book has
 * a `spine` path. The camera is orthographic, so the on-screen size is known from the fit: a new fit
 * (a resize) repaints at the new size on the same canvas and texture, which are never replaced, so
 * nothing leaks. Client only.
 */

export type SpineFace = {
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  style: SpineStyle;
  colours: SpineColours;
  /** The real picture of the spine, once it has loaded (a book with `spine` set). */
  photo: HTMLImageElement | null;
  /**
   * A crossfade: the old look, the new look, how far (0..1) it has come, and whether it has started
   * (only a few run at once, the rest wait their turn showing the old look).
   */
  fade: { from: HTMLCanvasElement; to: HTMLCanvasElement; t: number; live: boolean } | null;
};

/** What the spine functions need of a book: its data, its face and its size in world units. */
export type SpineBook = { d: SiteBook; spine: SpineFace; H: number; T: number };

/** Seconds a spine takes to go from its first colours to its cover's. */
export const FADE_SECONDS = 0.45;
/**
 * Crossfades running at once. Each one writes its spine's canvas to the GPU every frame, so the
 * covers arriving together (they come all at once after the drop-in) tint the shelf in a ripple
 * instead of all the spines uploading in the same frames.
 */
export const MAX_FADES = 3;
/** The most the device pixel ratio counts for. */
export const MAX_DPR = 2;
/** The least a spine canvas is, so a tiny screen still draws something. */
const MIN_PX = 8;

/** The spine canvas size in pixels: world size times CSS pixels per world unit times the pixel ratio (capped at 2). */
export function spinePixels(T: number, H: number, scale: number, dpr: number): SpineSize {
  const k = scale * Math.min(Math.max(dpr, 1), MAX_DPR);
  return { w: Math.max(MIN_PX, Math.round(T * k)), h: Math.max(MIN_PX, Math.round(H * k)) };
}

/** The colours a spine has before its cover's arrive: the book's own colour. */
export const firstColours = (color: string): SpineColours =>
  spineColours({ dominant: color, secondary: color });

const ctxOf = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const x = c.getContext("2d");
  if (!x) throw new Error("2D canvas is not available");
  return x;
};

const blank = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Paints the face's current look (the picture when it has one, else the designed spine) onto a canvas. */
function paintLook(
  c: HTMLCanvasElement,
  d: SiteBook,
  face: Pick<SpineFace, "style" | "colours" | "photo">,
): void {
  const x = ctxOf(c);
  const size = { w: c.width, h: c.height };
  if (face.photo) drawSpinePhoto(x, size, face.photo);
  else drawSpine(x, size, d, face.style, face.colours);
}

/** Makes the spine face of a book at `size`; `toTex` turns its canvas into the texture. */
export function createSpineFace(
  d: SiteBook,
  size: SpineSize,
  toTex: (c: HTMLCanvasElement) => THREE.CanvasTexture,
): SpineFace {
  const canvas = blank(size.w, size.h);
  const first = { style: spineStyle(d.id), colours: firstColours(d.color), photo: null };
  paintLook(canvas, d, first);
  return { canvas, tex: toTex(canvas), ...first, fade: null };
}

/** Changes the look from `change`, with a crossfade when `animate`, otherwise at once. */
function look(b: SpineBook, change: () => void, animate: boolean): void {
  const face = b.spine;
  const { width: w, height: h } = face.canvas;
  if (!animate) {
    change();
    face.fade = null;
    paintLook(face.canvas, b.d, face);
    face.tex.needsUpdate = true;
    return;
  }
  const from = blank(w, h);
  ctxOf(from).drawImage(face.canvas, 0, 0);
  change();
  const to = blank(w, h);
  paintLook(to, b.d, face);
  face.fade = { from, to, t: 0, live: false };
}

/** The cover's colours arrived: the spine goes over to them. A book with a spine picture keeps it. */
export function retintSpine(b: SpineBook, colours: SpineColours, animate: boolean): void {
  if (b.spine.photo) return;
  look(b, () => (b.spine.colours = colours), animate);
}

/** The picture of the spine arrived: the spine goes over to it. */
export function showSpinePhoto(b: SpineBook, img: HTMLImageElement, animate: boolean): void {
  look(b, () => (b.spine.photo = img), animate);
}

/**
 * Advances the crossfades by `dt` seconds, writing each into its spine's canvas; true while any is
 * still running (the frame must be drawn).
 */
export function stepSpineFades(books: SpineBook[], dt: number): boolean {
  let busy = false;
  let live = books.filter((b) => b.spine.fade?.live).length;
  for (const b of books) {
    const face = b.spine;
    const f = face.fade;
    if (!f) continue;
    if (!f.live) {
      if (live >= MAX_FADES) {
        busy = true; // waiting its turn
        continue;
      }
      f.live = true;
      live++;
    }
    f.t = Math.min(1, f.t + dt / FADE_SECONDS);
    const x = ctxOf(face.canvas);
    x.globalAlpha = 1;
    x.drawImage(f.from, 0, 0);
    x.globalAlpha = f.t;
    x.drawImage(f.to, 0, 0);
    x.globalAlpha = 1;
    face.tex.needsUpdate = true;
    if (f.t >= 1) {
      // that last frame is exactly the new look; the helper canvases are let go
      f.from.width = f.from.height = f.to.width = f.to.height = 0;
      face.fade = null;
      live--;
    } else {
      busy = true;
    }
  }
  return busy;
}

/**
 * Repaints every spine whose size on screen has changed (at `scale` CSS pixels per world unit and
 * `dpr`), on the same canvas and texture; true when any did. Resizing a canvas clears it, and the
 * texture's storage has to be made again for the new size, so it is disposed first (the texture
 * object stays, and is uploaded again when next drawn). A crossfade in progress is dropped: the
 * repaint is already the new look.
 */
export function resizeSpines(books: SpineBook[], scale: number, dpr: number): boolean {
  let changed = false;
  for (const b of books) {
    const face = b.spine;
    const size = spinePixels(b.T, b.H, scale, dpr);
    if (size.w === face.canvas.width && size.h === face.canvas.height) continue;
    face.fade = null;
    face.canvas.width = size.w;
    face.canvas.height = size.h;
    paintLook(face.canvas, b.d, face);
    face.tex.dispose();
    face.tex.needsUpdate = true;
    changed = true;
  }
  return changed;
}

/**
 * Starts loading the picture of the spine of every book that has one (`spine`, a path under
 * `public/`) and shows each when it decodes. Returns a function that stops it (the shelf was
 * disposed): pending loads are abandoned.
 */
export function loadSpinePhotos(
  books: SpineBook[],
  deps: { animate(): boolean; shown(): void },
): () => void {
  let stopped = false;
  const images: HTMLImageElement[] = [];
  for (const b of books) {
    if (!b.d.spine) continue;
    const img = new Image();
    img.onload = () => {
      if (stopped || img.naturalWidth < 1) return;
      void img
        .decode()
        .catch(() => undefined)
        .then(() => {
          if (stopped) return;
          showSpinePhoto(b, img, deps.animate());
          deps.shown();
        });
    };
    img.onerror = () => undefined; // a missing picture keeps the designed spine
    img.src = b.d.spine;
    images.push(img);
  }
  return () => {
    stopped = true;
    for (const img of images) {
      img.onload = img.onerror = null;
      img.src = "";
    }
  };
}
