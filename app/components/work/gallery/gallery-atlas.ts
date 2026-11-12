/**
 * The gallery's picture atlas: every tile's picture in one texture, filled a few at a time.
 *
 * Ported from the ObsidianUI Art Gallery (vendor/obsidianui/art-gallery.jsx: `loadImageTexture`,
 * `createTextureAtlas`), Copyright (c) 2026 ObsidianUI, MIT License (vendor/obsidianui/LICENSE).
 * Changed: the original waits for every picture, then draws one 512 px square per picture on a 2D
 * canvas and uploads the whole canvas once, text atlas too. Here the atlas texture exists at once and
 * each picture is copied into its own cell with `copyTextureToTexture` as it arrives, at most 2 a frame
 * (the wall's rule; each picture is drawn to a 2D canvas cell and sent with `texSubImage2D`), loaded with CORS in view order (index order is row by row) with a few requests in
 * flight and no more than a handful decoded and waiting. Cells have the tile's aspect and are drawn
 * object-fit cover. A picture that fails (no network, no CORS) is simply never uploaded: its tile stays
 * `--surface-1` and nothing else is affected. There is no retry.
 */

import type * as THREE from "three";
import { atlasLayout, coverRect, type AtlasLayout } from "./gallery-math";

type ThreeModule = typeof THREE;

export const UPLOADS_PER_FRAME = 2;
const MAX_IN_FLIGHT = 4;
const MAX_WAITING = 8;
/** The atlas stays within this many texels a side, whatever the GPU allows. */
const MAX_ATLAS_PX = 4096;

export type Atlas = {
  texture: THREE.DataTexture;
  layout: AtlasLayout;
  /** performance.now() (ms) when each tile's picture went up; 0 until it has. */
  loadedAt: Float64Array;
  /** Uploads up to 2 waiting pictures (call once a frame); returns how many went up. */
  pump(): number;
  /** Decoded pictures are waiting for a frame: the loop must keep running. */
  waiting(): boolean;
  /** Stops loading, frees the textures. */
  dispose(): void;
};

export function createAtlas(
  T: ThreeModule,
  renderer: THREE.WebGLRenderer,
  srcs: string[],
  aspect: number,
  cellLong: number,
  onWork: () => void,
): Atlas {
  const count = srcs.length;
  const gl = renderer.getContext() as WebGL2RenderingContext; // three 0.169 is WebGL 2 only
  const layout = atlasLayout(count, aspect, cellLong, Math.min(MAX_ATLAS_PX, renderer.capabilities.maxTextureSize));
  const texture = new T.DataTexture(new Uint8Array(layout.width * layout.height * 4), layout.width, layout.height);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  // the zero fill is only for the first upload; the cells are filled one by one after that
  texture.onUpdate = () => {
    (texture.image as { data: Uint8Array | null }).data = null;
    texture.onUpdate = () => {};
  };

  const cell = document.createElement("canvas");
  cell.width = layout.cellW;
  cell.height = layout.cellH;
  const ctx = cell.getContext("2d");
  // three's `copyTextureToTexture` is not used: it does not select texture unit 0 before it writes (so with another
  // unit active it writes into whatever is bound there: INVALID_VALUE or a wrong texture), and with a canvas source it
  // sets UNPACK_ROW_LENGTH, which Chrome rejects. The plain call is made on the renderer's own context after the
  // texture exists (`initTexture`), and `resetState` makes three forget what it thought was bound.
  renderer.initTexture(texture);
  const glTexture = (renderer.properties.get(texture) as { __webglTexture: WebGLTexture }).__webglTexture;
  const loadedAt = new Float64Array(count);
  const ready: Array<{ i: number; img: HTMLImageElement }> = [];
  const images = new Set<HTMLImageElement>();
  let next = 0;
  let inFlight = 0;
  let disposed = false;

  const settle = (img: HTMLImageElement) => {
    img.onload = null;
    img.onerror = null;
    images.delete(img);
    inFlight--;
  };

  /** Starts loads in index order while there is room. */
  function fill() {
    while (!disposed && next < count && inFlight < MAX_IN_FLIGHT && ready.length + inFlight < MAX_WAITING) {
      const i = next++;
      const img = new Image();
      img.crossOrigin = "anonymous";
      images.add(img);
      inFlight++;
      img.onload = () => {
        settle(img);
        const done = () => {
          if (disposed) return;
          ready.push({ i, img });
          onWork();
        };
        // decode off the main thread when it can; a picture that will not decode is dropped
        if (typeof img.decode === "function") img.decode().then(done, () => (img.naturalWidth ? done() : fill()));
        else done();
        fill();
      };
      img.onerror = () => {
        settle(img);
        fill();
      };
      img.src = srcs[i];
    }
  }

  fill();

  return {
    texture,
    layout,
    loadedAt,
    pump() {
      if (disposed || !ctx) return 0;
      let up = 0;
      while (up < UPLOADS_PER_FRAME && ready.length) {
        const { i, img } = ready.shift() as { i: number; img: HTMLImageElement };
        try {
          const r = coverRect(img.naturalWidth, img.naturalHeight, layout.cellW, layout.cellH);
          ctx.clearRect(0, 0, layout.cellW, layout.cellH);
          ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, layout.cellW, layout.cellH);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, glTexture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
          gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
          gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            (i % layout.cols) * layout.cellW,
            Math.floor(i / layout.cols) * layout.cellH,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            cell,
          );
          renderer.resetState();
          loadedAt[i] = performance.now();
          up++;
        } catch {
          // a picture the canvas will not take stays the flat surface
        }
      }
      fill();
      return up;
    },
    waiting: () => ready.length > 0,
    dispose() {
      disposed = true;
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
      images.clear();
      ready.length = 0;
      texture.dispose();
    },
  };
}
