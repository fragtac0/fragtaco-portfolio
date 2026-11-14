import type { SiteBook } from "~/types";
import { firstColours, lateSpines, repaintSpines, spineText, type SpineBook } from "./shelf-spines";
import { OPEN_FONT_WAIT_MS, spineFontsReady, watchSpineFonts } from "./spine-fonts";
import { designFor } from "./spine-series";

/**
 * The font wait of the shelf's build, and the repaint when a face comes late (R89). The first paint
 * waits for the spine faces (`spineFontsReady`, 2.5 s at most) and for whatever else the caller adds
 * (`also`: the interface faces the generated covers use). Once the layer has opened onto the shelf
 * (`FontCap.waiting`, from the moment the canvas is mounted into it) the wait is cut to about 1 s, so
 * a slow font never costs the 3D shelf the layer's give-up: the spines are painted in what has loaded.
 * A face that comes after that paints again only the spines that were drawn without it (each spine
 * remembers the faces it lacked, `SpineFace.missing`), a few at a time through the engine's slicer,
 * and the generated covers too when `also` was cut short. Client only.
 */

/** Spines painted per step of a late repaint, as in the build. */
const REPAINT_PER_STEP = 3;

export type FontCap = {
  /** Resolves `ms` after the layer first waits for the shelf; once resolved it stays so. */
  reached: Promise<void>;
  /** The layer is (not) waiting for the shelf: the clock runs while it is, and starts over if it was left. */
  waiting(on: boolean): void;
  stop(): void;
};

export function createFontCap(ms = OPEN_FONT_WAIT_MS): FontCap {
  let timer = 0;
  let done = false;
  let resolve: () => void = () => undefined;
  const reached = new Promise<void>((r) => (resolve = r));
  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  return {
    reached,
    waiting(on) {
      stop();
      if (!on || done) return;
      timer = window.setTimeout(() => {
        done = true;
        resolve();
      }, ms);
    },
    stop,
  };
}

/** Runs steps one after another, spread over time (the engine's slicer). */
export type RunSteps = (steps: Array<() => void>) => Promise<void>;

export type SpineFonts = {
  /** Resolves when the spine faces (and `also`) have loaded, or the wait has run out: build after it. */
  ready: Promise<void>;
  /** The scene's spines exist: paints again what lacked a face that has arrived since. `run` spreads the work. */
  scene(books: SpineBook[], run: RunSteps): void;
  stop(): void;
};

export type SpineFontsOptions = {
  /** Called after each late repaint step (the frame must be drawn). */
  repainted(): void;
  /** Ends the wait early (the layer waits for the shelf). */
  cap: Promise<void>;
  /** Other faces to wait for, with no limit of their own. */
  also?: Promise<unknown>;
  /** `also` came after the wait was cut: what it drew in a fallback face is drawn again (given the scene's books). */
  alsoLate?(books: SpineBook[]): void;
};

/**
 * The spine faces for `books`. Start it before the scene is built (the watch must not miss a face
 * that arrives while the wait runs); call `scene` once the scene exists.
 */
export function createSpineFonts(books: SiteBook[], opts: SpineFontsOptions): SpineFonts {
  const designs = books.map((b) => designFor(b, firstColours(b.color)));
  const letters = books.map(spineText).join(" ");
  let live: SpineBook[] | null = null;
  let run: RunSteps | null = null;

  const repaint = () => {
    if (!live || !run) return;
    const todo = lateSpines(live);
    const steps: Array<() => void> = [];
    for (let i = 0; i < todo.length; i += REPAINT_PER_STEP) {
      steps.push(() => {
        repaintSpines(todo.slice(i, i + REPAINT_PER_STEP));
        opts.repainted();
      });
    }
    if (steps.length) void run(steps).catch(() => undefined); // the engine was disposed: nothing to paint
  };
  const stopWatch = watchSpineFonts(designs, letters, repaint);

  let alsoDone = false;
  let alsoAtReady = false;
  const also = Promise.resolve(opts.also).then(() => {
    alsoDone = true;
    if (live && !alsoAtReady) opts.alsoLate?.(live);
  });
  const ready = Promise.race([
    Promise.all([spineFontsReady(designs, letters), also]).then(() => undefined),
    opts.cap,
  ]).then(() => {
    alsoAtReady = alsoDone;
  });

  return {
    ready,
    scene(list, runSteps) {
      live = list;
      run = runSteps;
      repaint(); // a face that arrived between the paint and now
      if (alsoDone && !alsoAtReady) opts.alsoLate?.(list);
    },
    stop: stopWatch,
  };
}
