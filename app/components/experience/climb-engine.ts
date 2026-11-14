// The map's loop (spec 9.2): one eased number, k, carries the change between the two states, and every frame of it
// is written straight to the page's layers with no React state. The picture is one plane moved with
// `planeTransform` (its opacity falls as the night comes), the night map is a 2D canvas drawn only while the night
// is on and only when the view changed, and the stage's `--night` drives the overlays' strength in CSS.
//
// The loop runs only while something moves (a change under way, or one frame after the size, the heights or the
// visibility changed) and only while the page is visible: when nothing moves, no frame is asked for. Reduced
// motion has no camera travel: the picture stays flat and the night map stays in its My climb pose while the two
// crossfade. The engine touches no global: the clock, the frame callback and the layers are handed in, and it is
// tested with stand-ins for them (climb-engine.test.ts). The page (experience-map.tsx) wires the real ones.
import { settle } from "./camera";
import { changeAt, startChange, type Change, type Mode } from "./climb-change";
import { setHeights } from "./heights";
import { smooth } from "./map-math";
import { drawTerrain, type Terrain } from "./terrain-canvas";
import { trailAt, type TrailPoint } from "./trail";
import { PICTURE } from "./frame";
import { OVERVIEW, pictureOpacity, planeTransform, viewOf, type Cam, type Stage } from "./view";

/** The bits of a style the engine writes (a CSSStyleDeclaration is one). */
export type StyleLike = { transform: string; opacity: string; width: string; height: string; setProperty(name: string, value: string): void };
export type Layer = { style: StyleLike };
export type CanvasLayer = Layer & { width: number; height: number; getContext(kind: "2d"): CanvasRenderingContext2D | null };

/** The layers the engine moves: the plane holding the picture, the night's ground, the night map canvas, and the stage (for `--night`). */
export type ClimbLayers = { stage: Layer; plane: Layer; night: Layer; terrain: CanvasLayer };

/** Time and frames, handed in (the page gives `performance.now` and `requestAnimationFrame`). */
export type Host = { now(): number; raf(cb: (now: number) => void): number; cancel(id: number): void };

export type ClimbOptions = {
  /** The trail, sampled (heights are set from the terrain once it is loaded). */
  trail: TrailPoint[];
  /** Whether motion is reduced right now (asked at each change). */
  reduced: () => boolean;
  host: Host;
  /** Every frame that moves: [time, k, screen y of the camera's look-at point, pitch, tx, ty, tz, zoom] (the audit's hook). */
  trace?: () => number[][] | undefined;
};

export type ClimbEngine = {
  /** The stage's size in CSS pixels and the pixel ratio. Draws once. */
  resize(w: number, h: number, dpr: number): void;
  /** The heights are loaded: the night map can be drawn, and a change that was waiting for it starts. */
  setTerrain(terrain: Terrain): void;
  /** Go to a state. Before the heights are loaded the change waits for them. */
  go(mode: Mode): void;
  /** Whether the page is on screen (a hidden tab asks for no frames). */
  setVisible(visible: boolean): void;
  /** Where things stand (the page and the tests read it). */
  state(): { k: number; mode: Mode; moving: boolean; ready: boolean };
  destroy(): void;
};

/** The night map is drawn only above this much night. */
export const NIGHT_ON = 0.02;
/** The picture is moved only while it can be seen. */
export const PICTURE_SEEN = 0.003;

export function createClimbEngine(layers: ClimbLayers, options: ClimbOptions): ClimbEngine {
  const { stage, plane, night, terrain: canvas } = layers;
  const { trail, reduced, host } = options;
  const ctx = canvas.getContext("2d");
  const cam: Cam = { ...OVERVIEW, trail };
  const size: Stage = { w: 0, h: 0 };
  let dpr = 1;
  let k = 0;
  /** How far along the trail the camera sits in My climb (set when it goes in). */
  let u = 1;
  let want: Mode = "overview";
  let change: Change | null = null;
  let terrain: Terrain | null = null;
  let dirty = false;
  let visible = true;
  let handle = 0;
  let gone = false;
  /** The night map was drawn for reduced motion, which never changes its view: it need not be drawn again until the size or the heights do. */
  let terrainFresh = false;
  /** A change to a state was asked for before the heights or the size were there. */
  let pending = false;

  const moving = () => change !== null;

  function schedule() {
    if (handle || gone || !visible || size.w === 0) return;
    handle = host.raf(frame);
  }

  /** Where the camera sits in My climb for "now", the last milestone: where it is while that is in the middle of the view. */
  function entryShare(): number {
    const now = { ...trailAt(trail, 1), u: 1 };

    return settle(cam, 0.72, now, size);
  }

  function draw(now: number) {
    // Under reduced motion the picture stays flat and the night map stays risen, and the night is simply k (a plain crossfade);
    // otherwise one view carries both.
    const calm = reduced();
    const v = viewOf(cam, k, u, size);
    const dark = calm ? k : v.night;
    const opacity = pictureOpacity(dark);

    if (opacity > PICTURE_SEEN) plane.style.transform = planeTransform(calm ? viewOf(cam, 0, u, size) : v);
    plane.style.opacity = String(opacity);
    night.style.opacity = String(smooth(0, 0.7, dark));
    canvas.style.opacity = String(smooth(0.04, 0.75, dark));
    stage.style.setProperty("--night", smooth(0.45, 1, k).toFixed(3));
    if (dark > NIGHT_ON && terrain !== null && ctx !== null && !(calm && terrainFresh)) {
      drawTerrain(ctx, terrain.levels, calm ? viewOf(cam, 1, u, size) : v, size, dpr);
      terrainFresh = calm;
    }
    dirty = false;

    const rows = options.trace?.();

    if (rows && moving()) rows.push([Math.round(now), +k.toFixed(4), +v.CY.toFixed(2), +v.pitch.toFixed(4), +v.tx.toFixed(2), +v.ty.toFixed(2), +v.tz.toFixed(2), +v.s.toFixed(3)]);
  }

  function frame(now: number) {
    handle = 0;
    if (gone || !visible) return;
    if (change !== null) {
      const at = changeAt(change, now);

      k = at.k;
      if (at.done) change = null;
      dirty = true;
    }
    if (dirty) draw(now);
    if (moving()) schedule();
  }

  function go(mode: Mode) {
    want = mode;
    pending = true;
    if (terrain === null || size.w === 0) return; // setTerrain and resize start it
    pending = false;
    if (mode === "climb" && k < 1e-6) {
      u = entryShare();
      terrainFresh = false;
    }

    const next = startChange(k, mode, host.now(), reduced());

    if (next !== null) change = next;
    schedule();
  }

  return {
    resize(w, h, ratio) {
      size.w = w;
      size.h = h;
      dpr = ratio;
      plane.style.width = `${PICTURE.w}px`; // from here the plane is placed by `planeTransform`, not by the page's CSS
      plane.style.height = `${PICTURE.h}px`;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      terrainFresh = false;
      dirty = true;
      if (pending) go(want);
      schedule();
    },
    setTerrain(t) {
      terrain = t;
      setHeights(trail, t.field);
      terrainFresh = false;
      dirty = true;
      if (pending) go(want);
      schedule();
    },
    go,
    setVisible(v) {
      visible = v;
      if (v) {
        // time has passed: a change under way is where its clock says, and one frame redraws
        dirty = true;
        schedule();
      } else if (handle) {
        host.cancel(handle);
        handle = 0;
      }
    },
    state: () => ({ k, mode: want, moving: moving(), ready: terrain !== null }),
    destroy() {
      gone = true;
      if (handle) host.cancel(handle);
      handle = 0;
    },
  };
}
