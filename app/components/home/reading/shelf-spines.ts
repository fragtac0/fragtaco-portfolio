import type * as THREE from "three";
import type { SiteBook } from "~/types";
import { drawSpinePhoto, type SpineSize } from "./spine-draw";
import { paintSpine } from "./spine-paint";
import { missingFaces } from "./spine-fonts";
import { designFor, hasSeries, plainSeries, type SeriesDesign } from "./spine-series";
import { spineColours, type SpineColours } from "./spine-styles";

/**
 * The spines of the shelf as textures. Each spine's canvas is the spine as it stands on screen
 * times the device pixel ratio (at most 2), painted by `paintSpine` (spine-paint.ts) in the book's
 * design from the series (spine-series.ts). A book with no design of its own gets the series' plain
 * style from its colour first and from its cover's colours when they arrive (shelf-covers.ts, a short
 * crossfade); a designed book keeps its design. A spine is painted again when a late face arrives
 * (`lateSpines`, `repaintSpines`; shelf-spine-fonts.ts), and from the picture when the book has a `spine` path. The camera is
 * orthographic, so the on-screen size is known from the fit: a new fit (a resize) repaints at the new size on the same canvas and texture, which are never replaced, so
 * nothing leaks. Client only.
 */

export type SpineFace = {
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  /** What the spine wears: the book's entry in the series, or the plain style from `colours`. */
  design: SeriesDesign;
  /** The colours the plain style is made from (the cover's, once they arrive). */
  colours: SpineColours;
  /** The pixel ratio (at most 2) the canvas is drawn for; the author's minimum size and the edge follow it. */
  dpr: number;
  /** The faces its design names that had not loaded when it was last painted (it is in a fallback for these). */
  missing: string[];
  /** The author's font size on the canvas in pixels, as last set (0 under a picture); the audit reads it. */
  authorPx: number;
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
  const k = scale * cappedDpr(dpr);
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

const cappedDpr = (dpr: number): number => Math.min(Math.max(dpr, 1), MAX_DPR);

const blank = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** The letters a book's spine shows (the subsets its faces must have). */
export const spineText = (d: Pick<SiteBook, "title" | "author">): string => `${d.title} ${d.author}`;

/** Paints the face's current look (the picture when it has one, else the designed spine) onto a canvas. */
function paintLook(
  c: HTMLCanvasElement,
  d: SiteBook,
  face: Pick<SpineFace, "design" | "photo" | "dpr" | "authorPx" | "missing">,
): void {
  const x = ctxOf(c);
  const size = { w: c.width, h: c.height };
  if (face.photo) {
    drawSpinePhoto(x, size, face.photo);
    face.authorPx = 0;
    face.missing = [];
  } else {
    face.missing = missingFaces(face.design, spineText(d)); // read first: what was loaded is what this paint uses
    face.authorPx = paintSpine(x, size.w, size.h, d, face.design, { dpr: face.dpr }).authorSize;
  }
}

/** Lets a crossfade's helper canvases go (a finished one and a discarded one alike). */
function dropFade(face: SpineFace): void {
  const f = face.fade;
  if (!f) return;
  f.from.width = f.from.height = f.to.width = f.to.height = 0;
  face.fade = null;
}

/** Makes the spine face of a book at `size`; `toTex` turns its canvas into the texture. */
export function createSpineFace(
  d: SiteBook,
  size: SpineSize,
  toTex: (c: HTMLCanvasElement) => THREE.CanvasTexture,
  dpr = 1,
): SpineFace {
  const canvas = blank(size.w, size.h);
  const colours = firstColours(d.color);
  const first = {
    design: designFor(d, colours),
    colours,
    photo: null,
    dpr: cappedDpr(dpr),
    authorPx: 0,
    missing: [] as string[],
  };
  paintLook(canvas, d, first);
  return { canvas, tex: toTex(canvas), ...first, fade: null };
}

/** Changes the look from `change`, with a crossfade when `animate`, otherwise at once. */
function look(b: SpineBook, change: () => void, animate: boolean): void {
  const face = b.spine;
  const { width: w, height: h } = face.canvas;
  if (!animate) {
    change();
    dropFade(face);
    paintLook(face.canvas, b.d, face);
    face.tex.needsUpdate = true;
    return;
  }
  dropFade(face); // an earlier fade that never started or never finished is replaced
  const from = blank(w, h);
  ctxOf(from).drawImage(face.canvas, 0, 0);
  change();
  const to = blank(w, h);
  paintLook(to, b.d, face);
  face.fade = { from, to, t: 0, live: false };
}

/**
 * The cover's colours arrived: a spine in the plain style goes over to them. A book with a spine
 * picture keeps it, and a designed book keeps its design (the cloth and foil are the series').
 */
export function retintSpine(b: SpineBook, colours: SpineColours, animate: boolean): void {
  if (b.spine.photo || hasSeries(b.d)) return;
  look(
    b,
    () => {
      b.spine.colours = colours;
      b.spine.design = plainSeries(colours);
    },
    animate,
  );
}

/**
 * The spines that were painted with a face missing and can now be drawn in at least one more of
 * them: only these are painted again when a late face arrives. Pure but for the font set it asks.
 */
export const lateSpines = (books: readonly SpineBook[]): SpineBook[] =>
  books.filter(
    (b) => b.spine.missing.length > 0 && missingFaces(b.spine.design, spineText(b.d)).length < b.spine.missing.length,
  );

/**
 * Paints these spines again, each on its own canvas (same size, so the texture's storage stays and
 * only its contents are sent again). A crossfade in progress is dropped: the repaint is already its end.
 */
export function repaintSpines(books: SpineBook[]): void {
  for (const b of books) {
    dropFade(b.spine);
    paintLook(b.spine.canvas, b.d, b.spine);
    b.spine.tex.needsUpdate = true;
  }
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
      dropFade(face);
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
    dropFade(face);
    face.dpr = cappedDpr(dpr);
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
