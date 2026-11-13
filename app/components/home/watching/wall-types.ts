import { tileSize, type LayoutTile, type TileSize } from "./wall-math";

/** The types and shared state of the video wall (the engine, its input and its drawing). */

export type WallEls = {
  /** The canvas goes in here. */
  host: HTMLElement;
  /** The chip under the focused tile: a `b` (title) and a `span` (channel). */
  chip: HTMLElement;
};

/**
 * The part of the wall the detail view drives; the no-WebGL grid supplies its own. `spreads` is
 * true for the WebGL wall, which draws the chosen video itself; the grid has nothing to draw, so
 * the detail view shows the picture.
 */
export type WallControl = Pick<WallEngine, "freeze" | "release" | "thaw" | "rectOf"> & {
  spreads: boolean;
};

export type WallEngine = {
  /**
   * Creates the GL context, program and atlas texture in steps (idle time, or short slices once
   * `setUrgent(true)`), and starts loading thumbnails. Resolves when the wall is built or has failed.
   */
  prepare(): Promise<void>;
  /** True once `prepare()` has run and the wall could not start (no WebGL, a failed shader, a lost context). */
  hasFailed(): boolean;
  /** The GL setup is done, so `start()` draws on the next frame. */
  ready(): boolean;
  /** Urgent: preparation stops yielding to idle time and runs in short slices every frame. */
  setUrgent(on: boolean): void;
  /** Called once when the graphics context is lost (the scene switches to its plain grid). */
  onLost(cb: () => void): () => void;
  mount(els: WallEls): void;
  /** Starts the loop once the wall is built; `onFirstFrame` is called once, right after the first frame is drawn. */
  start(opts?: { onFirstFrame?: () => void }): Promise<void>;
  stop(): void;
  unmount(): void;
  /** True: the wall draws the chosen video itself (see `WallControl`). */
  readonly spreads: true;
  /**
   * A video is chosen: the drift stops, the chosen tile travels to the middle and the others
   * spread away. A no-op for the tile that is already chosen.
   */
  freeze(key?: string): void;
  /** The close begins: the tiles travel back (the choice is held until `thaw`). */
  release(): void;
  /** The close is over: the choice is forgotten and the wall drifts on. */
  thaw(): void;
  /** The tile's current rectangle in viewport coordinates, or null when it is not in view. */
  rectOf(key: string): DOMRect | null;
  /** Move the keyboard focus one tile: (1, 0) right, (0, 1) down. */
  focusNext(dx: number, dy: number): void;
  openFocused(): void;
  dispose(): void;
};

export type Tile = LayoutTile & {
  /** Its own hover weight, 0 to 1: the tile that is focused (pointer or keyboard). */
  f: number;
  /** How far it is in the focused video's channel echo, 0 to 1. */
  e: number;
  /** How much it is the chosen video (0 to 1, eased): 1 once it has travelled to the middle. */
  c: number;
  /** Its brightness (1, down to 0.55 for the others while a video is open) and its opacity (1; 0 for a tile in the text's way). */
  dim: number;
  fade: number;
  /** Displaced centre, size and corner radius (the pointer's nudge, or the spread). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rad: number;
};

/** The engine's interaction and view state, shared with the input code. */
export type WallState = {
  /** The wall's clock, seconds (it stops advancing under reduced motion). */
  t: number;
  size: TileSize;
  /** Canvas size, and its offset in the viewport. The tiles live in this flat space; the fish-eye is applied when they are shown. */
  vw: number;
  vh: number;
  ox: number;
  oy: number;
  pan: { x: number; y: number };
  vel: { x: number; y: number };
  /** The pointer in flat wall coordinates (already through `edgeUnwarp`). */
  mouse: { x: number; y: number; inside: boolean };
  /** The tile the keyboard highlight is on, as its column and row indices. */
  kbd: { cx: number; cy: number } | null;
  down: { id: number; x: number; y: number; lx: number; ly: number; ts: number } | null;
  dragging: boolean;
  hoverKey: string | null;
  /**
   * The chosen video, from the click until the close is over: the wall is still and the tiles
   * spread around it. `live` is false while it closes. The wall takes no input but the arrow keys.
   */
  choice: { key: string; idx: number; live: boolean } | null;
  /** The tiles of the last frame, hovered one last. */
  tiles: Tile[];
};

export const createWallState = (): WallState => ({
  t: 0,
  size: tileSize(1280),
  vw: 0,
  vh: 0,
  ox: 0,
  oy: 0,
  pan: { x: 0, y: 0 },
  vel: { x: 0, y: 0 },
  mouse: { x: 0, y: 0, inside: false },
  kbd: null,
  down: null,
  dragging: false,
  hoverKey: null,
  choice: null,
  tiles: [],
});

/** What the engine lends to the input code: its canvas, state and a live accessor. */
export type WallCtx = {
  canvas: HTMLCanvasElement;
  st: WallState;
  running: () => boolean;
};
