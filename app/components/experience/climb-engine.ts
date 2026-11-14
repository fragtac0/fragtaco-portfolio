// The map's loop (spec 9.2 to 9.4): one eased number, k, carries the change between the two states, and `u`, how far
// along the trail the camera sits, follows its goal on a soft spring. Every frame is written straight to the page's layers
// with no React state. The picture is one plane moved with `planeTransform` (its opacity falls as the night comes), the
// night map is a 2D canvas drawn only while the night is on and only when the view changed, and the stage's `--night`
// drives the overlays' strength in CSS. The trail and the pins' stems are drawn on an overlay canvas when the view changes,
// the beads are moved with a transform, and the radar at "now" is a small canvas drawn every frame (the one thing that
// keeps the loop going when nothing else moves; under reduced motion it is drawn once and the loop stops).
//
// The loop runs only while the page is visible. The engine touches no global: the clock, the frame callback and the layers
// are handed in, and it is tested with stand-ins (climb-engine.test.ts). The page (experience-map.tsx) wires the real ones.
import { settle, springStep } from "./camera";
import type { XY } from "./card-slot";
import { changeAt, startChange, type Change, type Mode } from "./climb-change";
import { PICTURE, SUMMIT_XY } from "./frame";
import { setHeights } from "./heights";
import { smooth } from "./map-math";
import { drawTerrain, type Terrain } from "./terrain-canvas";
import { aheadTrail, sharesFor, trailAt, type TrailPoint } from "./trail";
import { drawRadar, drawTrail, pinPlaces, radarFoot, radarPhases, radarSide, type Pin } from "./trail-layer";
import { OVERVIEW, pictureOpacity, planeTransform, viewOf, type Cam, type Stage, type View } from "./view";

/** The bits of a style the engine writes (a CSSStyleDeclaration is one). */
export type StyleLike = { transform: string; opacity: string; width: string; height: string; visibility: string; zIndex: string; setProperty(name: string, value: string): void };
export type Layer = { style: StyleLike };
export type CanvasLayer = Layer & { width: number; height: number; getContext(kind: "2d"): CanvasRenderingContext2D | null };
export type StageLayer = Layer & { classList: { toggle(name: string, force?: boolean): unknown } };

/** The layers the engine moves: the stage (for `--night`), the plane holding the picture, the night's ground, the night map's canvas, the trail's and the radar's canvases, and the beads (with the box that holds them). */
export type ClimbLayers = { stage: StageLayer; plane: Layer; night: Layer; terrain: CanvasLayer; trail: CanvasLayer; radar: CanvasLayer; pinBox: Layer; pins: Layer[] };

/** Time and frames, handed in (the page gives `performance.now` and `requestAnimationFrame`). */
export type Host = { now(): number; raf(cb: (now: number) => void): number; cancel(id: number): void };

export type ClimbOptions = {
  /** The trail, sampled (heights are set from the terrain once it is loaded). */
  trail: TrailPoint[];
  /** Whether motion is reduced right now (asked every frame). */
  reduced: () => boolean;
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
  /** Where things stand (the page and the tests read it). */
  state(): { k: number; u: number; goal: number; index: number; mode: Mode; moving: boolean; ready: boolean };
  destroy(): void;
};

/** The night map is drawn only above this much night (below it its opacity is 0). */
export const NIGHT_ON = 0.04;
/** The picture is moved only while it can be seen. */
export const PICTURE_SEEN = 0.003;
/** Where the camera starts on the trail when it goes into My climb, before it settles for the chosen milestone. */
export const ENTRY_U = 0.72;
/** How long the card waits: for a milestone already in view, for one the camera has to travel to, and for the change into My climb (milliseconds). */
export const WAIT_STAY = 250;
export const WAIT_MOVE = 1300;
export const WAIT_ENTRY = 3150;
/** The spring is at rest when it is this near its goal and this slow. */
const REST = 0.0004;

export function createClimbEngine(layers: ClimbLayers, options: ClimbOptions): ClimbEngine {
  const { stage, plane, night, terrain: canvas, trail: trailCanvas, radar: radarCanvas, pinBox, pins } = layers;
  const { trail, reduced, host } = options;
  const ctx = canvas.getContext("2d");
  const trailCtx = trailCanvas.getContext("2d");
  const radarCtx = radarCanvas.getContext("2d");
  const cam: Cam = { ...OVERVIEW, trail };
  const size: Stage = { w: 0, h: 0 };
  const ahead = aheadTrail([trail[trail.length - 1].x, trail[trail.length - 1].y], SUMMIT_XY);
  const shares = sharesFor(pins.length);
  let spots = shares.map((u) => ({ ...trailAt(trail, u), u }));
  let dpr = 1;
  let k = 0;
  /** How far along the trail the camera sits, where it is going, and how fast it is going (a soft spring). */
  let u = 1;
  let goal = 1;
  let vel = 0;
  let index = pins.length - 1;
  let want: Mode = "overview";
  let wantIndex = index;
  let change: Change | null = null;
  let terrain: Terrain | null = null;
  let dirty = false;
  let visible = true;
  let handle = 0;
  let last = 0;
  let side = 0;
  let foot: XY = [0, 0];
  let seen: View = viewOf(cam, 0, 1, size);
  let wasCalm = false;
  let alphaWas = "";
  /** The night map was drawn for reduced motion, which never changes its view: it need not be drawn again until the size or the heights do. */
  let terrainFresh = false;
  /** A change to a state was asked for before the heights or the size were there. */
  let pending = false;
  let gone = ctx === null || trailCtx === null || radarCtx === null;

  if (gone) options.onFail?.();

  const springing = () => Math.abs(goal - u) > REST || Math.abs(vel) > REST;
  const moving = () => change !== null || springing();

  function schedule() {
    if (handle || gone || !visible || size.w === 0) return;
    handle = host.raf(frame);
  }

  /** The radar's rings, at `now` (milliseconds); still, under reduced motion. */
  function radar(now: number, calm: boolean) {
    if (radarCtx !== null) drawRadar(radarCtx, seen, spots[spots.length - 1], foot, side, dpr, radarPhases(calm ? 800 : now));
  }

  function scene(now: number, traced: boolean) {
    const calm = reduced();
    const v = viewOf(cam, k, u, size);
    const dark = calm ? k : v.night;
    const opacity = pictureOpacity(dark);

    if (opacity > PICTURE_SEEN) plane.style.transform = planeTransform(calm ? viewOf(cam, 0, u, size) : v);
    plane.style.opacity = String(opacity);
    plane.style.visibility = opacity > 0 ? "visible" : "hidden";
    night.style.opacity = String(smooth(0, 0.7, dark));
    canvas.style.opacity = String(smooth(0.04, 0.75, dark));
    stage.style.setProperty("--night", smooth(0.45, 1, k).toFixed(3));
    stage.classList.toggle("is-night", k > 0.45);
    if (dark > NIGHT_ON && terrain !== null && ctx !== null && !(calm && terrainFresh)) {
      drawTerrain(ctx, terrain.levels, calm ? viewOf(cam, 1, u, size) : v, size, dpr);
      terrainFresh = calm;
    }
    // the trail, the stems, the beads and the radar: in reduced motion they are seen in whichever state is nearer, and fade across the change
    seen = calm ? viewOf(cam, k < 0.5 ? 0 : 1, u, size) : v;

    const places: Pin[] = pinPlaces(seen, spots);
    const alpha = calm ? String(Math.abs(1 - 2 * k)) : "1";

    if (trailCtx !== null) drawTrail(trailCtx, seen, size, dpr, trail, ahead, places);
    places.forEach(({ head }, i) => {
      pins[i].style.transform = `translate(${head[0]}px, ${head[1]}px)`;
      pins[i].style.setProperty("--bs", String(0.5 + 0.5 * seen.k));
      pins[i].style.zIndex = String(Math.round(head[1]));
    });
    if (alpha !== alphaWas) {
      alphaWas = alpha;
      trailCanvas.style.opacity = radarCanvas.style.opacity = pinBox.style.opacity = alpha;
    }
    foot = radarFoot(seen, spots[spots.length - 1]);
    radarCanvas.style.transform = `translate(${foot[0] - side / 2}px, ${foot[1] - side / 2}px)`;
    radar(now, calm);
    options.onHeads?.(places.map((p) => p.head), { w: size.w, h: size.h });
    dirty = false;

    const rows = options.trace?.();

    if (rows && traced) rows.push([Math.round(now), +k.toFixed(4), +v.CY.toFixed(2), +v.pitch.toFixed(4), +v.tx.toFixed(2), +v.ty.toFixed(2), +v.tz.toFixed(2), +v.s.toFixed(3)]);
  }

  function frame(now: number) {
    handle = 0;
    if (gone || !visible) return;

    const calm = reduced();
    const traced = moving();
    const dt = Math.min(0.05, Math.max(0, (now - (last || now)) / 1000));

    last = now;
    if (calm !== wasCalm) {
      wasCalm = calm;
      dirty = true;
    }
    if (change !== null) {
      const at = changeAt(change, now);

      k = at.k;
      if (at.done) change = null;
      dirty = true;
    }
    if (springing()) {
      [u, vel] = calm ? [goal, 0] : springStep(u, vel, goal, dt);
      if (!springing()) [u, vel] = [goal, 0];
      dirty = true;
    }
    if (dirty) scene(now, traced);
    else if (!calm) radar(now, calm);
    if (moving() || !calm) schedule();
  }

  /** Move the camera so the milestone is in view, and say how long the card should wait for it. */
  function aim(i: number, entering: number): number {
    const m = spots[i];

    index = i;
    if (entering >= 1 - 1e-6) {
      // coming in from the overview: the camera starts from the entry's place and settles for the milestone at once
      goal = settle(cam, ENTRY_U, m, size);
      u = goal;
      vel = 0;
      terrainFresh = false;

      return WAIT_ENTRY;
    }

    const next = settle(cam, goal, m, size);
    const far = Math.abs(next - goal) > 0.001;

    goal = next;

    return entering > 0 ? WAIT_ENTRY * entering : far ? WAIT_MOVE : WAIT_STAY;
  }

  function go(mode: Mode, to = pins.length - 1) {
    want = mode;
    wantIndex = to;
    pending = true;
    if (terrain === null || size.w === 0) return; // setTerrain and resize start it
    pending = false;

    const wait = mode === "climb" ? aim(to, 1 - k) : 0;
    const next = startChange(k, mode, host.now(), reduced());

    if (next !== null) change = next;
    options.onSelect?.(mode === "climb" ? to : null, wait);
    schedule();
  }

  return {
    resize(w, h, ratio) {
      const same = size.w === w && size.h === h && dpr === ratio;

      size.w = w;
      size.h = h;
      dpr = ratio;
      plane.style.width = `${PICTURE.w}px`; // from here the plane is placed by `planeTransform`, not by the page's CSS
      plane.style.height = `${PICTURE.h}px`;
      if (!same) {
        // a canvas is cleared by being given a size, even the one it has: so only on a change, and drawn again before the next paint
        const stageBox = (c: CanvasLayer, cw: number, ch: number) => {
          c.width = Math.round(cw * ratio);
          c.height = Math.round(ch * ratio);
        };

        side = radarSide(Math.max(w / PICTURE.w, h / PICTURE.h));
        stageBox(canvas, w, h);
        stageBox(trailCanvas, w, h);
        stageBox(radarCanvas, side, side);
        radarCanvas.style.width = radarCanvas.style.height = `${side}px`;
        terrainFresh = false;
        dirty = true;
        if (!gone && visible && w > 0) scene(host.now(), false);
      }
      if (pending) go(want, wantIndex);
      schedule();
    },
    setTerrain(t) {
      terrain = t;
      setHeights(trail, t.field);
      setHeights(ahead, t.field);
      spots = shares.map((share) => ({ ...trailAt(trail, share), u: share }));
      terrainFresh = false;
      dirty = true;
      if (pending) go(want, wantIndex);
      schedule();
    },
    go,
    setVisible(v) {
      visible = v;
      if (v) {
        // time has passed: a change under way is where its clock says, and one frame redraws
        dirty = true;
        last = 0;
        schedule();
      } else if (handle) {
        host.cancel(handle);
        handle = 0;
      }
    },
    state: () => ({ k, u, goal, index, mode: want, moving: moving(), ready: terrain !== null }),
    destroy() {
      gone = true;
      if (handle) host.cancel(handle);
      handle = 0;
    },
  };
}
