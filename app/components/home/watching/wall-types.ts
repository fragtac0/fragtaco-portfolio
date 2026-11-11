import { tileSize, type LayoutTile, type TileSize } from "./wall-math";

/** The types and shared state of the video wall (the engine, its input and its drawing). */

export type WallEls = {
  /** The canvas goes in here. */
  host: HTMLElement;
  /** The chip under the focused tile: a `b` (title) and a `span` (channel). */
  chip: HTMLElement;
  hint: HTMLElement;
};

/** The part of the wall the detail view drives; the no-WebGL grid supplies its own. */
export type WallControl = Pick<WallEngine, "freeze" | "thaw" | "hold" | "rectOf">;

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
  /** While a video is open the wall stops, keeps that tile in focus, and takes no input. */
  freeze(key?: string): void;
  thaw(): void;
  /** Stops drawing altogether, under the cover of the detail view. */
  hold(v: boolean): void;
  /** The tile's current rectangle in viewport coordinates, or null when it is not in view. */
  rectOf(key: string): DOMRect | null;
  /** Move the keyboard focus one tile: (1, 0) right, (0, 1) down. */
  focusNext(dx: number, dy: number): void;
  openFocused(): void;
  dispose(): void;
};

export type Tile = LayoutTile & {
  /** The depth plane of its column. */
  plane: "near" | "far";
  /** Its own hover weight, 0 to 1. */
  f: number;
  /** How far it is in the focused video's channel echo, 0 to 1. */
  e: number;
  /** Displaced centre, size and corner radius. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rad: number;
  /** Brightness and extra mipmap bias, from its plane, the focus and the echo. */
  dim: number;
  bias: number;
};

/** The engine's interaction and view state, shared with the input code. */
export type WallState = {
  /** The wall's clock, seconds (it stops advancing under reduced motion). */
  t: number;
  size: TileSize;
  /** Canvas size, and its offset in the viewport. */
  vw: number;
  vh: number;
  ox: number;
  oy: number;
  pan: { x: number; y: number };
  vel: { x: number; y: number };
  mouse: { x: number; y: number; inside: boolean };
  /** The tile the keyboard highlight is on, as its column and row indices. */
  kbd: { cx: number; cy: number } | null;
  down: { id: number; x: number; y: number; lx: number; ly: number; ts: number } | null;
  dragging: boolean;
  hoverKey: string | null;
  /** The detail view is opening or open: the wall settles and takes no input. */
  frozen: boolean;
  /** Not drawing at all, under the cover of the detail view. */
  held: boolean;
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
  frozen: false,
  held: false,
  tiles: [],
});

/** What the engine lends to the input code: its canvas, state and a live accessor. */
export type WallCtx = {
  canvas: HTMLCanvasElement;
  st: WallState;
  running: () => boolean;
};
