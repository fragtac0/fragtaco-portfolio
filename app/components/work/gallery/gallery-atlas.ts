/**
 * The gallery's picture atlases: every tile's picture in one texture, filled a few at a time, and under it a small
 * second one with every tile's local art (`placeholderArt`, no network), which the pictures fade in over.
 *
 * Ported from the ObsidianUI Art Gallery (vendor/obsidianui/art-gallery.jsx: `loadImageTexture`,
 * `createTextureAtlas`), Copyright (c) 2026 ObsidianUI, MIT License (vendor/obsidianui/LICENSE).
 * Changed: the original waits for every picture, then draws one 512 px square per picture on a 2D
 * canvas and uploads the whole canvas once, text atlas too. Here the atlas texture exists at once and
 * each picture is drawn into a 2D canvas cell and sent to its place with `texSubImage2D` as it arrives, at most
 * 2 a frame (the wall's rule), loaded with CORS in the order the tiles arrive (`order`: the middle first) with a few
 * requests in flight and no more than a handful loading, decoding or waiting. Cells have the tile's aspect and are drawn
 * object-fit cover. A picture that fails (no network, no CORS) or is YouTube's grey stand-in for a missing video
 * (`isMissingCover`) is simply never uploaded: its tile stays on its art and nothing else is affected. There is no retry.
 * The art is small (a soft gradient) and local, so all of it is in within a few frames, 8 a frame.
 */

import type * as THREE from "three";
import { isMissingCover } from "../../../content/work-media";
import { SURFACE_1, channels } from "../../../styles/tokens";
import { atlasLayout, coverRect, type AtlasLayout } from "./gallery-math";

type ThreeModule = typeof THREE;

export const UPLOADS_PER_FRAME = 2;
const ART_UPLOADS_PER_FRAME = 8;
/** The art atlas's cells are this many px on the long side: it is a soft gradient. */
const ART_LONG_PX = 48;
const MAX_IN_FLIGHT = 4;
const MAX_WAITING = 8;
/** The atlas stays within this many texels a side, whatever the GPU allows. */
const MAX_ATLAS_PX = 4096;

export type AtlasInput = {
  /** The picture address of each tile. */
  srcs: string[];
  /** The local art of each tile (a data address): what a tile shows until its picture is in, and for good if it never comes. */
  arts: string[];
  aspect: number;
  /** The long side of a picture cell, px. */
  cellLong: number;
  /** The order tiles are loaded in (every index once): the order they arrive in. */
  order: number[];
};

export type Atlas = {
  texture: THREE.DataTexture;
  layout: AtlasLayout;
  /** The art atlas: same cell order, small cells. */
  artTexture: THREE.DataTexture;
  artLayout: AtlasLayout;
  /** performance.now() (ms) when each tile's picture went up; 0 until it has. */
  loadedAt: Float64Array;
  /** Uploads up to 2 waiting pictures and a few arts (call once a frame); returns how many pictures went up. */
  pump(): number;
  /** Decoded pictures or arts are waiting for a frame: the loop must keep running. */
  waiting(): boolean;
  /** Pictures that have gone up so far. */
  uploaded(): number;
  /** Every picture has gone up or been given up on: nothing more is coming. */
  settled(): boolean;
  /** The art of every tile is in the art atlas (or could not be made: then the tiles show the plain surface). */
  artReady(): boolean;
  /** Stops loading, frees the textures. */
  dispose(): void;
};

/** A plain texture of the given layout: filled with `fill` once, then written cell by cell. */
function makeTexture(T: ThreeModule, layout: AtlasLayout, fill: [number, number, number] | null): THREE.DataTexture {
  const data = new Uint8Array(layout.width * layout.height * 4);
  if (fill) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = 255;
    }
  }
  const texture = new T.DataTexture(data, layout.width, layout.height);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  // the first fill is only for the first upload; the cells are written one by one after that
  texture.onUpdate = () => {
    (texture.image as { data: Uint8Array | null }).data = null;
    texture.onUpdate = () => {};
  };
  return texture;
}

export function createAtlas(
  T: ThreeModule,
  renderer: THREE.WebGLRenderer,
  input: AtlasInput,
  onWork: () => void,
): Atlas {
  const { srcs, arts, aspect, cellLong, order } = input;
  const count = srcs.length;
  const gl = renderer.getContext() as WebGL2RenderingContext; // three 0.169 is WebGL 2 only
  const maxPx = Math.min(MAX_ATLAS_PX, renderer.capabilities.maxTextureSize);
  const layout = atlasLayout(count, aspect, cellLong, maxPx);
  const artLayout = atlasLayout(count, aspect, ART_LONG_PX, maxPx);
  const texture = makeTexture(T, layout, null);
  const artTexture = makeTexture(T, artLayout, channels(SURFACE_1));

  // three's `copyTextureToTexture` is not used: it does not select texture unit 0 before it writes (so with another
  // unit active it writes into whatever is bound there: INVALID_VALUE or a wrong texture), and with a canvas source it
  // sets UNPACK_ROW_LENGTH, which Chrome rejects. The plain call is made on the renderer's own context after the
  // texture exists (`initTexture`), and `resetState` makes three forget what it thought was bound.
  renderer.initTexture(texture);
  renderer.initTexture(artTexture);
  // `__webglTexture` is three's internal name; if a three upgrade renames it, or the upload errors, no picture is marked
  // loaded (every tile stays on its art) instead of fading in as black
  const glOf = (t: THREE.Texture) => {
    const found = (renderer.properties.get(t) as { __webglTexture?: unknown }).__webglTexture;
    return found instanceof WebGLTexture ? found : null;
  };
  const glTexture = glOf(texture);
  const glArt = glOf(artTexture);
  let broken = glTexture === null;
  let checked = false;
  if (broken) console.warn("The video wall cannot reach its picture texture; the tiles stay on their art.");

  /** A canvas the size of one cell, and the write of it into cell `i` of a texture. */
  const cellOf = (l: AtlasLayout) => {
    const c = document.createElement("canvas");
    c.width = l.cellW;
    c.height = l.cellH;
    return { canvas: c, ctx: c.getContext("2d") };
  };
  type Cell = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  const picCell = cellOf(layout);
  const artCell = cellOf(artLayout);
  function writeCell(
    gt: WebGLTexture,
    l: AtlasLayout,
    c: Cell,
    img: HTMLImageElement,
    i: number,
  ) {
    const r = coverRect(img.naturalWidth, img.naturalHeight, l.cellW, l.cellH);
    const { ctx } = c;
    ctx.clearRect(0, 0, l.cellW, l.cellH);
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, l.cellW, l.cellH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gt);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, (i % l.cols) * l.cellW, Math.floor(i / l.cols) * l.cellH, gl.RGBA, gl.UNSIGNED_BYTE, c.canvas);
    renderer.resetState();
  }

  const loadedAt = new Float64Array(count);
  const ready: Array<{ i: number; img: HTMLImageElement }> = [];
  const readyArt: Array<{ i: number; img: HTMLImageElement }> = [];
  const images = new Set<HTMLImageElement>();
  let next = 0;
  let inFlight = 0;
  let decoding = 0;
  let pictures = 0;
  let artsIn = 0;
  let artsGone = 0;
  let disposed = false;

  const settle = (img: HTMLImageElement) => {
    img.onload = null;
    img.onerror = null;
    images.delete(img);
    inFlight--;
  };

  /** Starts loads in arrival order while there is room. */
  function fill() {
    while (!disposed && next < count && inFlight < MAX_IN_FLIGHT && ready.length + inFlight + decoding < MAX_WAITING) {
      const i = order[next++];
      const img = new Image();
      img.crossOrigin = "anonymous";
      images.add(img);
      inFlight++;
      img.onload = () => {
        settle(img);
        // YouTube's grey stand-in for a removed video loads fine and is not a picture: the tile keeps its art
        if (isMissingCover(srcs[i], img.naturalWidth)) {
          fill();
          return;
        }
        const done = () => {
          decoding--;
          if (disposed) return;
          ready.push({ i, img });
          onWork();
        };
        // decode off the main thread when it can; a picture that will not decode is dropped
        decoding++;
        if (typeof img.decode === "function") {
          img.decode().then(done, () => {
            if (img.naturalWidth) done();
            else {
              decoding--;
              fill();
            }
          });
        } else done();
        fill();
      };
      img.onerror = () => {
        settle(img);
        fill();
      };
      img.src = srcs[i];
    }
  }

  // the art: local data addresses, all started at once, in arrival order
  for (const i of order) {
    const img = new Image();
    images.add(img);
    const gone = () => {
      images.delete(img);
      artsGone++;
    };
    img.onload = () => {
      const put = () => {
        images.delete(img);
        if (disposed) return;
        readyArt.push({ i, img });
        onWork();
      };
      if (typeof img.decode === "function") img.decode().then(put, gone);
      else put();
    };
    img.onerror = gone;
    img.src = arts[i];
  }
  fill();

  return {
    texture,
    layout,
    artTexture,
    artLayout,
    loadedAt,
    pump() {
      if (disposed) return 0;
      let a = 0;
      while (a < ART_UPLOADS_PER_FRAME && readyArt.length && glArt && artCell.ctx) {
        const { i, img } = readyArt.shift() as { i: number; img: HTMLImageElement };
        try {
          writeCell(glArt, artLayout, artCell as Cell, img, i);
          artsIn++;
        } catch {
          artsGone++; // the tile stays the plain surface
        }
        a++;
      }
      if (broken || !glTexture || !picCell.ctx) return 0; // the art above never waits on the picture texture
      let up = 0;
      while (up < UPLOADS_PER_FRAME && ready.length) {
        const { i, img } = ready.shift() as { i: number; img: HTMLImageElement };
        try {
          if (!checked) gl.getError(); // flush an old error so the check below is about this upload
          writeCell(glTexture, layout, picCell as Cell, img, i);
          if (!checked) {
            checked = true;
            if (gl.getError() !== gl.NO_ERROR) {
              broken = true;
              ready.length = 0;
              console.warn("The video wall's picture upload failed; the tiles stay on their art.");
              break;
            }
          }
          loadedAt[i] = performance.now();
          pictures++;
          up++;
        } catch {
          // a picture the canvas will not take stays on its art
        }
      }
      fill();
      return up;
    },
    waiting: () => readyArt.length > 0 || (!broken && ready.length > 0),
    uploaded: () => pictures,
    settled: () => broken || (next >= count && inFlight === 0 && decoding === 0 && ready.length === 0),
    artReady: () => artsIn + artsGone >= count,
    dispose() {
      disposed = true;
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
      images.clear();
      ready.length = 0;
      readyArt.length = 0;
      texture.dispose();
      artTexture.dispose();
    },
  };
}
