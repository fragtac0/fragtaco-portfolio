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
  /** Puts the camera where a run starts (after the fit, which knows the row's reach): the box framing follows the camera, so the row is framed as the run will frame it. */
  home: () => void;
  reframe: (redraw: boolean) => void;
};

/** The textures the fit changed (the ledge's, a repainted spine): the ones whose last upload is not their current version. */
export function staleTextures(gl: ShelfScene): THREE.Texture[] {
  const maps: Array<THREE.Texture | null> = [gl.ledge.material.map, ...gl.books.map((b) => b.spine.tex)];
  return maps.filter((t): t is THREE.Texture => !!t && (gl.renderer.properties.get(t) as { __version?: number }).__version !== t.version);
}

/** Thrown by a step that finds the shelf no longer ready: the rest of the run is dropped at once. */
class Stop extends Error {}

/**
 * The docked shelf's arrival work, done ahead (R55.3g, Task 26 I1). The box's first frame used to carry the first fit (the renderer's
 * buffer, the ledge's picture, the spines' sizes, the dot field's canvas), the new textures' upload and the buffer's first allocation on top
 * of the first draw: one frame of 50 to 67 ms at 4 times slower CPU. One run of `run`'s slices (idle time while the block is near, a few
 * milliseconds a frame once it is on screen): the fit, the camera where the run starts and the framing that follows it (the dot field's canvas is sized for it: a phone's shelf starts at its left end, and a framing made with the camera elsewhere is another size), the changed textures three at a time, the buffer's first use. Each step first checks that
 * the shelf is still mounted, docked and not running (a layer that opens, or a box that came on screen and started, did the work itself or does
 * not need it): if not, the run ends there, so a click never waits for steps that have nothing to do.
 * This prepares; it draws nothing (the buffer is cleared, which an empty canvas does not show), so spec 6.1 holds: a scene draws only while its
 * box is on screen.
 */
export async function prefitShelf(d: PrefitDeps): Promise<void> {
  const gl = d.scene();
  if (!gl || !d.ready()) return;
  let todo: THREE.Texture[] = [];
  // at most the ledge and every spine
  const groups = Math.ceil((gl.books.length + 1) / UPLOADS_PER_STEP);
  const steps: Array<() => void> = [
    () => {
      d.fit();
      d.home();
      d.reframe(true);
      todo = staleTextures(gl);
    },
    ...Array.from({ length: groups }, (_, g) => () => {
      for (const map of todo.slice(g * UPLOADS_PER_STEP, (g + 1) * UPLOADS_PER_STEP)) gl.renderer.initTexture(map);
    }),
    // the buffer is allocated by its first use: clear it now, so the first frame does not wait for the allocation
    () => gl.renderer.clear(),
  ];
  try {
    await d.run(
      steps.map((step) => () => {
        if (!d.ready()) throw new Stop();
        step();
      }),
    );
  } catch (err) {
    if (!(err instanceof Stop)) throw err;
  }
}
