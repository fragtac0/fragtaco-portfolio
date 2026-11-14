import type { LayerKind } from "./layer-state";

/** How ready a box's scene is: still being made, drawn into its box, or unable to draw (the box shows its flat preview). */
export type SceneStatus = "pending" | "ready" | "plain";

/** A click on a box whose scene is not ready waits this long, then opens to the plain grid (spec 6.2). */
export const READY_WAIT_MS = 400;

export type OpenGate = {
  /** A click on the block of `kind`. */
  request(kind: LayerKind): void;
  /** The status of `kind` changed: a click that was waiting for it goes on. */
  settled(kind: LayerKind): void;
  /** Drops a wait without opening. */
  cancel(): void;
};

export type OpenGateDeps = {
  status: (kind: LayerKind) => SceneStatus;
  /** Opens the layer for `kind`; `plain` when it must use the plain grid (the scene is not, or will not be, ready). */
  open: (kind: LayerKind, plain: boolean) => void;
  /** The pressed state of the block: on while a click waits. */
  press: (kind: LayerKind, on: boolean) => void;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
};

/**
 * Decides what a click on a home block does. A ready scene opens at once; a plain one opens at once to the plain grid; one that
 * is still being made shows the pressed state and waits up to `READY_WAIT_MS` for its first frame, then opens to the plain
 * grid. It never opens onto nothing and never ignores the click. One click waits at a time.
 */
export function createOpenGate(deps: OpenGateDeps): OpenGate {
  let waiting: { kind: LayerKind; timer: number } | null = null;

  const go = (kind: LayerKind, plain: boolean) => {
    if (waiting) {
      deps.clearTimer(waiting.timer);
      waiting = null;
      deps.press(kind, false);
    }
    deps.open(kind, plain);
  };

  return {
    request(kind) {
      if (waiting) return;
      const s = deps.status(kind);
      if (s !== "pending") return go(kind, s === "plain");
      deps.press(kind, true);
      waiting = { kind, timer: deps.setTimer(() => go(kind, true), READY_WAIT_MS) };
    },
    settled(kind) {
      if (!waiting || waiting.kind !== kind) return;
      const s = deps.status(kind);
      if (s !== "pending") go(kind, s === "plain");
    },
    cancel() {
      if (!waiting) return;
      deps.clearTimer(waiting.timer);
      deps.press(waiting.kind, false);
      waiting = null;
    },
  };
}
