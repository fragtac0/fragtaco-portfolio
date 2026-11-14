// The types of the map's loop (climb-engine.ts): the layers it moves, the clock and frame callback it is handed, its options and
// the engine itself.
import type { XY } from "./card-slot";
import type { Mode } from "./climb-change";
import type { KeepOut } from "./keep-out";
import type { Terrain } from "./terrain-canvas";
import type { TrailPoint } from "./trail";
import type { Stage } from "./view";

/** The bits of a style the engine writes (a CSSStyleDeclaration is one). */
export type StyleLike = { transform: string; opacity: string; width: string; height: string; visibility: string; zIndex: string; setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
export type Layer = { style: StyleLike };
export type CanvasLayer = Layer & { width: number; height: number; getContext(kind: "2d"): CanvasRenderingContext2D | null };
export type StageLayer = Layer & { classList: { toggle(name: string, force?: boolean): unknown } };

/** The layers the engine moves: the stage (for `--night`), the plane holding the picture, the night's ground, the night map's canvas, the trail's, the radar's and the frame's canvases, and the beads (with the box that holds them). */
export type ClimbLayers = { stage: StageLayer; plane: Layer; night: Layer; terrain: CanvasLayer; trail: CanvasLayer; radar: CanvasLayer; frame: CanvasLayer; pinBox: Layer; pins: Layer[] };

/** Time and frames, handed in (the page gives `performance.now` and `requestAnimationFrame`). */
export type Host = { now(): number; raf(cb: (now: number) => void): number; cancel(id: number): void };

export type ClimbOptions = {
  /** The trail, sampled (heights are set from the terrain once it is loaded). */
  trail: TrailPoint[];
  /** Whether motion is reduced right now (asked every frame). */
  reduced: () => boolean;
  /** Whether the screen is a phone's (asked when the overview is framed): its overview starts at `PHONE_OVERVIEW`, not the picture's own framing. Absent: not a phone. */
  phone?: () => boolean;
  host: Host;
  /** A milestone was chosen (null: none, the map left My climb) and how long the card should wait, in milliseconds, for the camera. */
  onSelect?: (index: number | null, wait: number) => void;
  /** The beads' heads on the stage, each time they moved. */
  onHeads?: (heads: XY[], stage: Stage) => void;
  /** A canvas could not give a 2D context: the map cannot be drawn. */
  onFail?: () => void;
  /** Every frame that moves: [time, k, screen y of the camera's look-at point, pitch, tx, ty, tz, zoom] (the audit's hook). */
  trace?: () => number[][] | undefined;
};

export type ClimbEngine = {
  /** The stage's size in CSS pixels and the pixel ratio. Draws at once if they changed. */
  resize(w: number, h: number, dpr: number): void;
  /** The heights are loaded: the night map can be drawn, and a change that was waiting for it starts. */
  setTerrain(terrain: Terrain): void;
  /** Go to a state (in My climb, to a milestone: the last, "now", by default). Before the heights are loaded the change waits for them. */
  go(mode: Mode, index?: number): void;
  /** Whether the page is on screen (a hidden tab asks for no frames). */
  setVisible(visible: boolean): void;
  /** Where the page's words and the dock are on the stage (the chart's labels keep out of them), as the page reads them. */
  setKeepOut(keep: KeepOut): void;
  /** Draw again at the next frame (a font arrived: the chart's lettering). */
  redraw(): void;
  /** Where things stand (the page and the tests read it). */
  state(): { k: number; u: number; goal: number; index: number; mode: Mode; moving: boolean; ready: boolean };
  destroy(): void;
};
