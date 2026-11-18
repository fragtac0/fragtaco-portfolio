import type { SiteBook } from "~/types";
import { firstColours, lateSpines, repaintSpines, spineText, type SpineBook } from "./shelf-spines";
import { OPEN_FONT_LEG_MS, OPEN_FONT_WAIT_MS, spineFontsReady, watchSpineFonts } from "./spine-fonts";
import type { RunSteps } from "./shelf-scene";
import { designFor } from "./spine-series";

/**
 * The font wait of the shelf's build, and the repaint when a face comes late (R89). The first paint
 * waits for the spine faces (`spineFontsReady`, 2.5 s at most) and for whatever else the caller adds
 * (`also`: the interface faces the generated covers use). Once the layer waits for the shelf
 * (`FontCap.waiting`, from the moment the canvas is mounted into it) the wait is cut: 1 s after the
 * mount, or 500 ms after the layer opens (`FontCap.urgent`, the end of the grow; at once under reduced
 * motion), whichever is first (`fontCapDeadline`). So a slow font never costs the 3D shelf the layer's
 * give-up, 1.5 s after it opens: the spines are painted in what has loaded.
 * A face that comes after that paints again only the spines that were drawn without it (each spine
 * remembers the faces it lacked, `SpineFace.missing`), a few at a time through the engine's slicer,
 * and the generated covers that have no real cover too when `also` was cut short. Client only.
 */

/** Spines painted per step of a late repaint, as in the build. */
const REPAINT_PER_STEP = 3;

export type FontCap = {
  /** Resolves when the cap's deadline passes (`fontCapDeadline`); once resolved it stays so. */
  reached: Promise<void>;
  /** The layer is (not) waiting for the shelf: the clock runs while it is, and starts over if it was left. */
  waiting(on: boolean): void;
  /** The layer is open (not growing) and waits for the shelf: starts the shorter leg, `OPEN_FONT_LEG_MS`. */
  urgent(on: boolean): void;
  stop(): void;
};

/**
 * When the cap ends, as a clock reading (pure). `mountAt` is when the canvas was mounted into the layer
 * (the start of the grow), `openAt` when the layer opened onto it (the end of the grow; the same moment
 * under reduced motion, which has no grow), `null` while that has not come. The wait ends at the earlier
 * of `mountAt + mountMs` and `openAt + openMs`: the layer gives up on 3D `SCENE_GIVE_UP_MS` after it
 * opens, and the build still has to run after the cap, so the open leg leaves it about a second of that
 * (R89). With a grow the mount leg is the shorter (the open comes 680 ms after the mount); with none the
 * open leg is. `null` when the layer is not waiting yet.
 */
export function fontCapDeadline(
  mountAt: number | null,
  openAt: number | null,
  mountMs = OPEN_FONT_WAIT_MS,
  openMs = OPEN_FONT_LEG_MS,
): number | null {
  if (mountAt === null) return null;
  const a = mountAt + mountMs;
  return openAt === null ? a : Math.min(a, openAt + openMs);
}

export function createFontCap(mountMs = OPEN_FONT_WAIT_MS, openMs = OPEN_FONT_LEG_MS): FontCap {
  let timer = 0;
  let done = false;
  let resolve: () => void = () => undefined;
  const reached = new Promise<void>((r) => (resolve = r));
  let mountAt: number | null = null;
  let openAt: number | null = null;
  let isUrgent = false;
  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  const arm = () => {
    stop();
    const at = done ? null : fontCapDeadline(mountAt, openAt, mountMs, openMs);
    if (at === null) return;
    timer = window.setTimeout(() => {
      done = true;
      resolve();
    }, Math.max(0, at - performance.now()));
  };
  return {
    reached,
    waiting(on) {
      mountAt = on ? performance.now() : null;
      openAt = on && isUrgent ? mountAt : null;
      arm();
    },
    urgent(on) {
      isUrgent = on;
      openAt = on && mountAt !== null ? (openAt ?? performance.now()) : null;
      arm();
    },
    stop,
  };
}

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
