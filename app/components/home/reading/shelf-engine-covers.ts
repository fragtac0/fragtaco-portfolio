import { createCoverQueue, type CoverQueue } from "./shelf-covers";
import { readCovers } from "./shelf-fit";
import type { ShelfState } from "./shelf-open";
import type { ShelfScene } from "./shelf-scene";
import { retintSpine } from "./shelf-spines";
import { spineColours } from "./spine-styles";

/** What the engine lends the cover queue (shelf-engine.ts keeps these as its own state). */
export type EngineCoverDeps = {
  canvas: HTMLCanvasElement;
  st: ShelfState;
  scene: () => ShelfScene | null;
  disposed: () => boolean;
  running: () => boolean;
  /** Not running, or past the entrance with no book open: a cover is painted only then, so it never costs a frame of the lift. */
  calm: () => boolean;
  reduced: boolean;
};

/** The real covers (shelf-covers.ts) wired to the engine's scene: downloaded, decoded, painted and uploaded outside the entrance. */
export function createEngineCovers(d: EngineCoverDeps): CoverQueue {
  const { canvas, st, scene, reduced } = d;
  return createCoverQueue({
    disposed: d.disposed,
    ready: () => !!scene(),
    running: d.running,
    calm: d.calm,
    upload(t, c) {
      const gl = scene();
      if (!gl) return;
      const old = t.image as HTMLCanvasElement | undefined;
      if (old && (old.width !== c.width || old.height !== c.height)) t.dispose(); // new storage for a new size
      t.image = c;
      t.needsUpdate = true;
      gl.renderer.initTexture(t);
      readCovers(canvas, gl.books);
    },
    pixels: (b) => scene()?.books.find((k) => k.d.id === b.id)?.coverPx ?? 640,
    // the cover's colours: the spine fades over to them while the loop runs, else it is repainted at once
    colours(b, c) {
      const k = scene()?.books.find((x) => x.d.id === b.id);
      if (!k) return;
      retintSpine(k, spineColours(c), d.running() && !reduced);
      st.dirty = true;
    },
  });
}
