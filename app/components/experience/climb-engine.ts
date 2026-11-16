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
import { writeHits } from "./bead-hit";
import { chartAlpha } from "./chart";
import { createChartState } from "./chart-state";
import { changeAt, IN_MS, kOf, startChange, type Change, type Mode } from "./climb-change";
import type { CanvasLayer, ClimbEngine, ClimbLayers, ClimbOptions } from "./climb-engine-types";
import { dipAt, hopStart, jumpNow } from "./climb-hop";
import { createEntrance } from "./entrance-driver";
import { PICTURE, SUMMIT_XY } from "./frame";
import { setHeights } from "./heights";
import { BEAD_REACH, NO_KEEP_OUT, TRAIL_REACH, reachBox, type Box } from "./keep-out";
import { smooth } from "./map-math";
import { drawTerrain, type Terrain } from "./terrain-canvas";
import { aheadTrail, sharesFor, trailAt, type TrailPoint } from "./trail";
import { drawRadar, drawTrail, pinPlaces, radarFoot, radarPhases, radarSide, type Pin } from "./trail-layer";
import { OVERVIEW, PHONE_OVERVIEW, fitOverview, glideTo, overviewPoints, pictureOpacity, planeTransform, project, sameLook, viewOf, type Cam, type Look, type Stage, type View } from "./view";
import type { XY } from "./card-slot";

export type { CanvasLayer, ClimbEngine, ClimbLayers, ClimbOptions, Host, Layer, StageLayer, StyleLike } from "./climb-engine-types";

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
/** A bead whose head is past this share of the stage's width shows its label on its left (the side with more room), so the label is not cut off at the edge. */
export const FLIP_AT = 0.5;
/** The radar is redrawn at about 30 frames a second (its ring moves under half a pixel a frame): this many milliseconds apart at least (Ruling R102). */
export const RADAR_GAP = 30;
/** A bead's touch target, in pixels (the overview keeps the whole of it on the screen). */
export const BEAD_TARGET = 44;

export function createClimbEngine(layers: ClimbLayers, options: ClimbOptions): ClimbEngine {
  const { stage, plane, night, terrain: canvas, trail: trailCanvas, radar: radarCanvas, frame: frameCanvas, pinBox, pins } = layers;
  const { trail, reduced, host } = options;
  const ctx = canvas.getContext("2d");
  const trailCtx = trailCanvas.getContext("2d");
  const radarCtx = radarCanvas.getContext("2d");
  const frameCtx = frameCanvas.getContext("2d");
  const chart = createChartState();
  /** Where the overview starts, and where `fitOverview` searches from: the picture's own framing, or the phone's. */
  const start = (): Look => (options.phone?.() ? PHONE_OVERVIEW : OVERVIEW);
  const cam: Cam = { ...start(), trail };
  const size: Stage = { w: 0, h: 0 };
  const ahead = aheadTrail([trail[trail.length - 1].x, trail[trail.length - 1].y], SUMMIT_XY);
  const shares = sharesFor(pins.length);
  let spots = shares.map((u) => ({ ...trailAt(trail, u), u }));
  const entrance = createEntrance(pins, shares, reduced, options.entrance === true);
  let keep = NO_KEEP_OUT;
  /** The overview's framing that `cam` is gliding to. */
  let look: Look = { ...start() };
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
  /** When the radar was last drawn, and when the dip of a reduced-motion step began (null: none). */
  let radarAt = -1e9;
  let hop: number | null = null;
  let side = 0;
  let foot: XY = [0, 0];
  let seen: View = viewOf(cam, 0, 1, size);
  let wasCalm = false;
  let alphaWas = "";
  /** Each bead's hit area as last written (bead-hit.ts), so a frame writes only what changed. */
  const hitWas: (string | null)[] = pins.map(() => null);
  /** The night map was drawn for reduced motion, which never changes its view: it need not be drawn again until the size or the heights do. */
  let terrainFresh = false;
  /** A change to a state was asked for before the heights or the size were there. */
  let pending = false;
  let gone = ctx === null || trailCtx === null || radarCtx === null || frameCtx === null;

  if (gone) options.onFail?.();

  const springing = () => Math.abs(goal - u) > REST || Math.abs(vel) > REST;
  const moving = () => change !== null || springing() || hop !== null;

  function schedule() {
    if (handle || gone || !visible || size.w === 0) return;
    handle = host.raf(frame);
  }

  /** The camera with the overview's framing it is gliding to (the chart's labels are chosen for that framing, not for the one the glide passes through). */
  const fitted = (): Cam => ({ ...cam, ...look });
  /** Where the beads and the trail's line are in the overview (the chart's labels keep out of them). */
  const overviewAvoid = (): Box[] => {
    const v = viewOf(fitted(), 0, 1, size);
    const line = (pts: readonly TrailPoint[]) => pts.filter((_, i) => i % 4 === 0).map((p) => reachBox(...project(v, p.x, p.y, 0), TRAIL_REACH));

    return [...pinPlaces(v, spots).map((p) => reachBox(p.head[0], p.head[1], BEAD_REACH)), ...line(trail), ...line(ahead)];
  };

  /** The overview's framing (R104): the start's (the picture's own, or the phone's) where the whole trail and its nine beads already fit between the page's words and the dock, else the nearest one where they do. */
  function frameOverview() {
    if (size.w <= 0 || size.h <= 0) return; // no size yet: the first resize does it

    look = fitOverview(start(), overviewPoints(spots, [trail, ahead], BEAD_TARGET / 2, TRAIL_REACH), size, keep);
    if (reduced()) Object.assign(cam, look);
  }

  /** The radar's rings, at `now` (milliseconds) counted from `from` (when the entrance started it; null: not yet, nothing is drawn); still, under reduced motion. */
  function radar(now: number, calm: boolean, from: number | null) {
    radarAt = now;
    if (radarCtx === null) return;
    if (from === null) radarCtx.clearRect(0, 0, side, side);
    else drawRadar(radarCtx, seen, spots[spots.length - 1], foot, side, dpr, radarPhases(calm ? 800 : now - from));
  }

  function scene(now: number, traced: boolean) {
    const calm = reduced();
    const v = viewOf(cam, k, u, size);
    const dark = calm ? k : v.night;
    const opacity = pictureOpacity(dark);
    const { shown, done } = dipAt(hop, now);

    if (done) hop = null;

    if (opacity > PICTURE_SEEN) plane.style.transform = planeTransform(calm ? viewOf(cam, 0, u, size) : v);
    plane.style.opacity = String(opacity);
    plane.style.visibility = opacity > 0 ? "visible" : "hidden";
    night.style.opacity = String(smooth(0, 0.7, dark));
    canvas.style.opacity = String(smooth(0.04, 0.75, dark) * shown);
    stage.style.setProperty("--night", smooth(0.45, 1, k).toFixed(3));
    stage.classList.toggle("is-night", k > 0.45);
    if (dark > NIGHT_ON && terrain !== null && ctx !== null && !(calm && terrainFresh)) {
      drawTerrain(ctx, terrain.levels, calm ? viewOf(cam, 1, u, size) : v, size, dpr);
      terrainFresh = calm;
    }
    // the trail, the stems, the beads and the radar: in reduced motion they are seen in whichever state is nearer, and fade across the change
    seen = calm ? viewOf(cam, k < 0.5 ? 0 : 1, u, size) : v;

    const places: Pin[] = pinPlaces(seen, spots);
    const fade = calm ? Math.abs(1 - 2 * k) : 1;
    const alpha = String(+(fade * shown).toFixed(3));
    const over = chartAlpha(seen.night); // the overview's own marks fade with the picture
    const entering = entrance.step(now); // the entrance (spec 8): how much of the trail is drawn, and whether the radar has begun

    if (trailCtx !== null) drawTrail(trailCtx, seen, size, dpr, trail, ahead, places, (c) => chart.under(c, seen, size, over, want !== "climb"), { share: entering.share, aheadShare: entering.ahead, alpha: entering.alpha });
    if (frameCtx !== null) {
      const at = want === "climb" ? spots[index] : { x: SUMMIT_XY[0], y: SUMMIT_XY[1] };

      chart.frame(frameCtx, seen, size, dpr, [at.x, at.y], over * fade);
    }
    const heads = places.map((p) => p.head);

    writeHits(pins.map((p) => p.style), heads, hitWas, pins.map((p) => p.hasAttribute("data-under")));
    places.forEach(({ head }, i) => {
      pins[i].style.transform = `translate(${head[0]}px, ${head[1]}px)`;
      pins[i].style.setProperty("--bs", String(0.5 + 0.5 * seen.k));
      pins[i].style.setProperty("--flip", head[0] > FLIP_AT * size.w ? "1" : "0");
      pins[i].style.zIndex = String(Math.round(head[1]));
    });
    if (alpha !== alphaWas) {
      alphaWas = alpha;
      trailCanvas.style.opacity = radarCanvas.style.opacity = pinBox.style.opacity = alpha;
    }
    foot = radarFoot(seen, spots[spots.length - 1]);
    radarCanvas.style.transform = `translate(${foot[0] - side / 2}px, ${foot[1] - side / 2}px)`;
    radar(now, calm, entering.radar);
    options.onHeads?.(heads, { w: size.w, h: size.h });
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
      // reduced motion: no travel. A step that moves the camera waits for the middle of its dip, then jumps (and the night map, which keeps its view under reduced motion, is drawn again)
      if (!calm) [u, vel] = springStep(u, vel, goal, dt);
      else if (jumpNow(hop, now)) {
        [u, vel] = [goal, 0];
        terrainFresh = false;
      }
      if (!springing()) [u, vel] = [goal, 0];
      dirty = true;
    }
    if (hop !== null) dirty = true;
    if (!sameLook(cam, look)) {
      // the overview's framing glides to the fitted one (the picture's first place is the page's CSS, which cannot know the fit)
      Object.assign(cam, glideTo(cam, look, dt));
      dirty = true;
    }
    if (entrance.wakes(now)) dirty = true;
    if (dirty) scene(now, traced);
    else if (!calm && now - radarAt >= RADAR_GAP) radar(now, calm, entrance.step(now).radar);
    if (moving() || !calm || entrance.live()) schedule();
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
    if (far && entering <= 0 && reduced()) hop = hopStart(hop, host.now());

    return entering > 0 ? WAIT_ENTRY * entering : far ? WAIT_MOVE : WAIT_STAY;
  }

  function go(mode: Mode, to = pins.length - 1) {
    want = mode;
    wantIndex = to;
    pending = true;
    if (terrain === null || size.w === 0) return; // setTerrain and resize start it
    pending = false;

    // a change already heading there carries on (one camera move, however many presses come during it); any other starts from where k is
    const running = change !== null && change.to === kOf(mode);
    let wait = mode === "climb" ? aim(to, 1 - k) : 0;

    if (running && change !== null && 1 - k > 1e-6) wait = Math.max(0, change.t0 + change.ms * (WAIT_ENTRY / IN_MS) - host.now());
    if (!running) {
      const next = startChange(k, mode, host.now(), reduced());

      if (next !== null) change = next;
    }
    options.onSelect?.(mode === "climb" ? to : null, wait);
    dirty = true; // the readout tells the chosen milestone, or the summit
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
        stageBox(frameCanvas, w, h);
        stageBox(radarCanvas, side, side);
        radarCanvas.style.width = radarCanvas.style.height = `${side}px`;
        terrainFresh = false;
        dirty = true;
        frameOverview();
        chart.refit(fitted(), size, overviewAvoid());
        if (!gone && visible && w > 0) scene(host.now(), false);
      }
      if (pending) go(want, wantIndex);
      schedule();
    },
    setTerrain(t) {
      terrain = t;
      setHeights(trail, t.field);
      setHeights(ahead, t.field);
      chart.setHeights(t.field);
      spots = shares.map((share) => ({ ...trailAt(trail, share), u: share }));
      terrainFresh = false;
      dirty = true;
      if (pending) go(want, wantIndex);
      schedule();
    },
    go,
    setKeepOut(next) {
      keep = next;
      frameOverview();
      chart.setKeepOut(next, fitted(), size, overviewAvoid());
      dirty = true;
      schedule();
    },
    redraw() {
      dirty = true;
      schedule();
    },
    startEntrance(at) {
      entrance.start(at);
      schedule();
    },
    finishEntrance() {
      entrance.finish(host.now());
      dirty = true;
      schedule();
    },
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
      // leave nothing of the trail, the radar or the beads behind (the page falls back to the list when the heights fail)
      for (const [c, cv] of [[trailCtx, trailCanvas], [radarCtx, radarCanvas], [frameCtx, frameCanvas], [ctx, canvas]] as const) {
        c?.setTransform(1, 0, 0, 1, 0, 0);
        c?.clearRect(0, 0, cv.width, cv.height);
      }
      pinBox.style.opacity = "";
    },
  };
}
