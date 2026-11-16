import type * as THREE from "three";
import type { RunSteps, ShelfScene } from "./shelf-scene";

/** Textures sent to the GPU per step: the same few at a time as the scene's own upload (shelf-scene.ts). */
const UPLOADS_PER_STEP = 3;

/** What the engine lends the prefit: the slicer's run, the scene, and the engine's own fit and reframe. */
export type PrefitDeps = {
  run: RunSteps;
  scene: () => ShelfScene | null;
  /** The shelf is mounted, docked in its box's frame and not running (nothing is on screen yet): the arrival's work may be done ahead. */
  ready: () => boolean;
  fit: () => void;
  reframe: (redraw: boolean) => void;
};

/** The textures the fit changed (the ledge's, a repainted spine): the ones whose last upload is not their current version. */
export function staleTextures(gl: ShelfScene): THREE.Texture[] {
  const maps: Array<THREE.Texture | null> = [gl.ledge.material.map, ...gl.books.map((b) => b.spine.tex)];
  return maps.filter((t): t is THREE.Texture => !!t && (gl.renderer.properties.get(t) as { __version?: number }).__version !== t.version);
}

/**
 * The docked shelf's arrival work, done ahead (R55.3f, Task 26 I1). The box's first frame used to carry the first fit (the renderer's
 * buffer, the ledge's picture, the spines' sizes, the dot field's canvas), the new textures' upload and the buffer's first allocation on top
 * of the first draw: one frame of 50 to 67 ms at 4 times slower CPU. Run in the slices of `run` (idle time while the block is near, a few
 * milliseconds a frame once it is on screen), each step first checks that nothing has started: a shelf that is running did the work itself.
 * This prepares; it draws nothing (the buffer is cleared, which an empty canvas does not show), so spec 6.1 holds: a scene draws only while its
 * box is on screen.
 */
export async function prefitShelf(d: PrefitDeps): Promise<void> {
  const gl = d.scene();
  if (!gl || !d.ready()) return;
  let todo: THREE.Texture[] = [];
  await d.run([
    () => {
      if (!d.ready()) return;
      d.fit();
      d.reframe(true);
      todo = staleTextures(gl);
    },
  ]);
  const uploads: Array<() => void> = [];
  for (let i = 0; i < todo.length; i += UPLOADS_PER_STEP) {
    uploads.push(() => {
      if (!d.ready()) return;
      for (const map of todo.slice(i, i + UPLOADS_PER_STEP)) gl.renderer.initTexture(map);
    });
  }
  // the buffer is allocated by its first use: clear it now, so the first frame does not wait for the allocation
  uploads.push(() => {
    if (d.ready()) gl.renderer.clear();
  });
  await d.run(uploads);
}
