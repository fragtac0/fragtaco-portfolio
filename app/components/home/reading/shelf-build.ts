import type { SiteBook } from "~/types";
import type { CoverQueue } from "./shelf-covers";
import { buildShelfScene, type RunSteps, type ShelfScene } from "./shelf-scene";
import type { SpineFonts } from "./shelf-spine-fonts";

/** Thrown inside `buildShelf` when the engine is disposed part-way through. */
export class Aborted extends Error {}

/** `run` for the engine: each step first checks the engine is still there, and ends the build with `Aborted` if not. */
export const abortable =
  (run: RunSteps, disposed: () => boolean): RunSteps =>
  (steps) =>
    run(
      steps.map((step) => () => {
        if (disposed()) throw new Aborted();
        step();
      }),
    );

/**
 * The shelf's build, run by the engine's `prepare()`: three.js is loaded with `import("three")` (its
 * own chunk) while the faces load, then the scene is built in the steps the slicer spreads out (idle
 * time, or back to back once the layer waits). The wait for the faces (`fonts.ready`) is capped when the layer
 * waits for the shelf (shelf-spine-fonts.ts), so it never outlasts the layer's give-up. A disposed
 * engine ends the build with `Aborted` at the next step.
 */
export async function buildShelf(
  canvas: HTMLCanvasElement,
  books: SiteBook[],
  deps: {
    disposed(): boolean;
    fonts: SpineFonts;
    /** The slicer's `run`, ending in `Aborted` once the engine is disposed. */
    run: RunSteps;
    covers: CoverQueue;
  },
): Promise<ShelfScene> {
  const { fonts, run, covers } = deps;
  const [T] = await Promise.all([import("three"), fonts.ready]);
  if (deps.disposed()) throw new Aborted();
  return buildShelfScene(
    T,
    canvas,
    books,
    run,
    (tex, d) => covers.load(tex, d),
    (tex, d) => covers.repaint(tex, d),
  );
}
