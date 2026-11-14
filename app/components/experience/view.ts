// The map's view (spec 9.2): one number, k, carries the whole change from the flat overview (0) to the tilted
// night map of My climb (1), and u says how far along the trail the camera sits. `viewOf` turns them into the
// numbers of the picture; `project` puts a point of the ground in the stage; `planeTransform` is the CSS 3D
// transform that puts the flat picture exactly where `project` puts the ground (height 0).
import { PICTURE } from "./frame";
import { HEIGHT, liftOf } from "./heights";
import { lerp, smooth } from "./map-math";
import { trailAt, type TrailPoint } from "./trail";

export { HEIGHT };

const rad = (d: number) => (d * Math.PI) / 180;

/** The tilt of the camera in My climb, the turn of the map, and the zoom (the overview's is on `OVERVIEW`). */
export const PITCH = rad(61);
export const YAW = rad(-14);
export const SCLIMB = 3;
/** How tall a milestone's stem is, in map units. */
export const STEM = 15;
/** The middle of the mountain, which the camera drifts a little toward. */
export const MOUNTAIN = { x: 487, y: 320 };
/** Where the overview looks and how much it is zoomed (a slight zoom, so the picture always covers the frame). */
export const OVERVIEW = { ax: 470, ay: 325, s: 1.1 };

export type Stage = { w: number; h: number };
/** The camera's own numbers: where the overview looks, and the trail the camera climbs (sampled, with heights). */
export type Cam = { ax: number; ay: number; s: number; trail: readonly TrailPoint[] };

export type View = {
  k: number;
  /** How far the lines have risen (0 flat, 1 risen). */
  rise: number;
  /** How far the picture has turned to night. */
  night: number;
  /** The map point the camera looks at, and its height. */
  tx: number;
  ty: number;
  tz: number;
  /** The zoom. */
  s: number;
  pitch: number;
  yaw: number;
  /** Screen pixels per map unit. */
  S: number;
  cy: number;
  sy: number;
  cp: number;
  sp: number;
  /** The screen point the camera looks at. */
  CX: number;
  CY: number;
  /** The distance of the eye, in map units. */
  DIST: number;
};

/** The whole view for a state: k (0 overview, 1 on the trail) and u (where along the trail the camera sits). */
export function viewOf(cam: Cam, k: number, u: number, stage: Stage): View {
  const F = trailAt(cam.trail, u);
  const rise = smooth(0.2, 1, k);
  const s = Math.exp(lerp(Math.log(cam.s), Math.log(SCLIMB), k));
  const pitch = PITCH * k;
  const yaw = YAW * k;

  return {
    k,
    rise,
    night: smooth(0.08, 0.62, k),
    tx: lerp(cam.ax, F.x + (MOUNTAIN.x - F.x) * 0.22, k),
    ty: lerp(cam.ay, F.y + (MOUNTAIN.y - F.y) * 0.22, k),
    tz: liftOf(F.n, rise) * 0.9,
    s,
    pitch,
    yaw,
    S: Math.max(stage.w / PICTURE.w, stage.h / PICTURE.h) * s,
    cy: Math.cos(yaw),
    sy: Math.sin(yaw),
    cp: Math.cos(pitch),
    sp: Math.sin(pitch),
    CX: stage.w / 2,
    CY: stage.h * (0.5 + 0.12 * k),
    DIST: 1350 / s,
  };
}

/** A map point (x, y, and z, the height in map units) on the stage, in CSS pixels from its top left. */
export function project(v: View, x: number, y: number, z: number): [number, number] {
  const px = x - v.tx;
  const py = y - v.ty;
  const xr = px * v.cy - py * v.sy;
  const yr = px * v.sy + py * v.cy;
  const zz = z - v.tz;
  const f = v.DIST / (v.DIST - Math.min(yr * v.sp + zz * v.cp, v.DIST * 0.8));

  return [v.CX + v.S * f * xr, v.CY + v.S * f * (yr * v.cp - zz * v.sp)];
}

/**
 * The CSS transform of the flat picture (a 1000 by 650 element at the stage's top left, `transform-origin: 0 0`)
 * that puts each of its points where `project` puts that map point at height 0.
 */
export function planeTransform(v: View): string {
  return (
    `translate(${v.CX}px, ${v.CY}px) perspective(${v.DIST * v.S}px) rotateX(${v.pitch}rad) rotateZ(${v.yaw}rad) ` +
    `translateZ(${-v.tz * v.S}px) scale(${v.S}) translate(${-v.tx}px, ${-v.ty}px)`
  );
}

/** How opaque the flat picture is (it fades as the night comes). */
export const pictureOpacity = (night: number) => 1 - smooth(0.12, 0.85, night);

