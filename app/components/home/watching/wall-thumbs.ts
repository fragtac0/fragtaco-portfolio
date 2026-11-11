import type { SiteVideo } from "~/types";
import { thumbUrl, type Atlas } from "./wall-math";

/**
 * Thumbnails are never stored: `sddefault.jpg` (or `hqdefault.jpg` where the sync recorded that
 * sddefault does not exist, or if the first one is too small) is decoded off the main thread,
 * drawn into one cell canvas and uploaded into a power-of-two atlas, at most 2 cells a frame,
 * with a single mipmap rebuild on a frame that uploaded. A thumbnail that never loads keeps the
 * animated placeholder.
 */

export type Thumbs = {
  /** Up to 2 cells, then one mipmap rebuild for the batch. Returns whether anything went up. */
  pumpFrame(): boolean;
  /** Starts the background pump if thumbnails are waiting (the wall's own loop is not running). */
  kick(): void;
  /** When each cell's thumbnail went up (performance.now ms), 0 until it has; indexed like `atlas.cells`. The arrival animation's clock. */
  loadedAt: Float64Array;
  dispose(): void;
};

/**
 * Creates the atlas texture on `gl`, binds it to the active unit and starts loading. `running`
 * says whether the wall's frame loop is up: while it is not, uploads get a loop of their own.
 */
export function createThumbs(
  gl: WebGLRenderingContext,
  atlas: Atlas,
  videos: SiteVideo[],
  running: () => boolean,
): Thumbs {
  const g = gl;
  const a = atlas;
  if (videos.length > a.cells.length) {
    console.warn(
      `The wall shows ${a.cells.length} of ${videos.length} videos: the thumbnail atlas is full.`,
    );
  }
  const loadedAt = new Float64Array(a.cells.length);
  const queue: Array<[number, HTMLImageElement]> = [];
  const images = new Set<HTMLImageElement>();
  let disposed = false;
  let pumpRaf = 0;
  let cell: HTMLCanvasElement | null = document.createElement("canvas");
  cell.width = a.cw;
  cell.height = a.ch;
  let cellCtx = cell.getContext("2d");

  // a power-of-two atlas, so it can carry mipmaps: the soft focus is just a biased lookup
  const tex = g.createTexture();
  g.bindTexture(g.TEXTURE_2D, tex);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, a.aw, a.ah, 0, g.RGBA, g.UNSIGNED_BYTE, null);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.generateMipmap(g.TEXTURE_2D);

  const drop = (img: HTMLImageElement) => {
    img.onload = null;
    img.onerror = null;
    images.delete(img);
  };
  const loadImage = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      if (disposed) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        drop(img); // a failed image is not kept
        resolve(null);
      };
      images.add(img);
      img.src = src;
    });

  /** sddefault, or hqdefault when that fails or is tiny; decoded before it is queued. */
  async function loadThumb(i: number) {
    const v = videos[i];
    const first = thumbUrl(v, "sd");
    let img = await loadImage(first);
    if (!img || img.naturalWidth <= 200) {
      const hq = thumbUrl(v, "hq");
      if (img) drop(img);
      img = hq === first ? null : await loadImage(hq);
    }
    if (!img || disposed) return;
    try {
      await img.decode();
    } catch {
      drop(img);
      return;
    }
    if (disposed) return;
    queue.push([i, img]);
    schedulePump();
  }

  function pumpFrame(): boolean {
    if (!cell || !cellCtx || !queue.length) return false;
    g.bindTexture(g.TEXTURE_2D, tex);
    for (let n = 0; n < 2 && queue.length; n++) {
      const [i, img] = queue.shift() as [number, HTMLImageElement];
      const c = a.cells[i];
      const ih = img.naturalHeight * 0.75; // keep the 16:9 middle of the 4:3 thumbnail
      cellCtx.drawImage(
        img,
        0,
        (img.naturalHeight - ih) / 2,
        img.naturalWidth,
        ih,
        0,
        0,
        a.cw,
        a.ch,
      );
      g.texSubImage2D(g.TEXTURE_2D, 0, c.x, c.y, g.RGBA, g.UNSIGNED_BYTE, cell);
      loadedAt[i] = performance.now();
      drop(img);
    }
    g.generateMipmap(g.TEXTURE_2D);
    return true;
  }

  /** While the wall is not running its frame loop does not exist, so uploads get their own. */
  function schedulePump() {
    if (pumpRaf || running() || disposed || !queue.length) return;
    pumpRaf = requestAnimationFrame(() => {
      pumpRaf = 0;
      if (disposed || running()) return;
      pumpFrame();
      schedulePump();
    });
  }

  for (let i = 0; i < a.cells.length; i++) void loadThumb(i);

  return {
    pumpFrame,
    kick: schedulePump,
    loadedAt,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(pumpRaf);
      queue.length = 0;
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
      images.clear();
      g.deleteTexture(tex);
      cell = null;
      cellCtx = null;
    },
  };
}
