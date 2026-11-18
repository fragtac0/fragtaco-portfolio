// The map's view (spec 9.2): one number, k, carries the whole change from the flat overview (0) to the tilted
// night map of My climb (1), and u says how far along the trail the camera sits. `viewOf` turns them into the
// numbers of the picture; `project` puts a point of the ground in the stage; `planeTransform` is the CSS 3D
// transform that puts the flat picture exactly where `project` puts the ground (height 0).
import { PICTURE } from "./frame";
import { HEIGHT, liftOf } from "./heights";
import { DOCK_GAP, WORDS_GAP, overlaps, type Box, type KeepOut } from "./keep-out";
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
/**
 * Where a narrow screen (a phone: `PHONE_LOOK_MEDIA`) starts its overview, in the page's CSS and in the engine, so the first look is near
 * the one `fitOverview` finds for the phones the page was measured on (390 by 844 and 360 by 640 keep it as it is, 320 by 568 zooms in a
 * step and moves 22 px; the picture's own framing needed a glide of 91, 47 and 63 px). It still covers any stage at its zoom.
 */
export const PHONE_OVERVIEW = { ax: 530, ay: 345, s: 1.1 };
/** The screens that start at `PHONE_OVERVIEW` (a phone held upright; one held sideways starts at the picture's own framing). */
export const PHONE_LOOK_MEDIA = "(max-width: 700px)";

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

/** Where the overview looks and how much it is zoomed: the picture's own framing (`OVERVIEW`), or the one `fitOverview` found. */
export type Look = { ax: number; ay: number; s: number };
/** A point the overview must keep on the screen: a place on the map, and the room round it on the screen (a bead's touch target, the line's width), in pixels. */
export type FitPoint = { x: number; y: number; pad: number };

/** The points to keep: each bead (with its touch target's half size round it) and every fourth point of each line of the trail (with the line's reach). */
export function overviewPoints(beads: readonly { x: number; y: number }[], lines: readonly (readonly { x: number; y: number }[])[], beadPad: number, linePad: number): FitPoint[] {
  return [
    ...beads.map((p) => ({ x: p.x, y: p.y, pad: beadPad })),
    ...lines.flatMap((line) => line.filter((_, i) => i % 4 === 0).map((p) => ({ x: p.x, y: p.y, pad: linePad }))),
  ];
}

/** The room left at the stage's edges, in pixels. */
export const FIT_GUTTER = 12;
/** The search: each zoom is this share of the one before (or one over it, zooming in), up to this many times the picture's zoom or down to this share of it; the look-at point moves in steps of this many map units. */
export const FIT_ZOOM_STEP = 0.96;
export const FIT_ZOOM_MOST = 1.6;
export const FIT_ZOOM_LEAST = 0.45;
export const FIT_MOVE_STEP = 8;

/** At k = 0 the view is plain scaling (no tilt, no turn): where a map point is on the stage for a look. */
export const overviewAt = (look: Look, stage: Stage, x: number, y: number): [number, number] => {
  const S = Math.max(stage.w / PICTURE.w, stage.h / PICTURE.h) * look.s;

  return [stage.w / 2 + S * (x - look.ax), stage.h / 2 + S * (y - look.ay)];
};

export const sameLook = (a: Look, b: Look): boolean => a.ax === b.ax && a.ay === b.ay && a.s === b.s;

/** The framing is eased toward the fitted one at this rate per second, and is there when this near (in map units; the zoom counts 200 times). */
export const GLIDE_RATE = 9;
export const GLIDE_NEAR = 0.05;

/** One step of `dt` seconds from the framing `from` toward `to`: a soft ease (the same share of what is left each moment, whatever the frame rate), the framing itself once it is near. */
export function glideTo(from: Look, to: Look, dt: number): Look {
  if (Math.abs(from.ax - to.ax) + Math.abs(from.ay - to.ay) + 200 * Math.abs(from.s - to.s) < GLIDE_NEAR) return { ax: to.ax, ay: to.ay, s: to.s };

  const f = 1 - Math.exp(-GLIDE_RATE * Math.max(0, dt));

  return { ax: from.ax + (to.ax - from.ax) * f, ay: from.ay + (to.ay - from.ay) * f, s: from.s + (to.s - from.s) * f };
}

/** The values from `lo` to `hi` that the search tries for one axis: `at` itself (kept in range), then steps away from it, and the two ends. */
const along = (at: number, lo: number, hi: number): number[] => {
  const out = [Math.min(hi, Math.max(lo, at)), lo, hi];

  for (let d = FIT_MOVE_STEP; at - d >= lo || at + d <= hi; d += FIT_MOVE_STEP) {
    if (at - d >= lo) out.push(at - d);
    if (at + d <= hi) out.push(at + d);
  }

  return out;
};

/** The zooms the search tries, nearest the picture's first: out and in a step at a time while the picture still covers the stage (a zoom of 1 or more), then further out. */
function zoomsFrom(base: number): number[] {
  const out = [base];
  const into: number[] = [];
  const away: number[] = [];

  for (let s = base * FIT_ZOOM_STEP; s >= 1; s *= FIT_ZOOM_STEP) away.push(s);
  for (let s = base / FIT_ZOOM_STEP; s <= base * FIT_ZOOM_MOST; s /= FIT_ZOOM_STEP) into.push(s);
  for (let i = 0; i < Math.max(away.length, into.length); i++) out.push(...[away[i], into[i]].filter((s) => s !== undefined));
  for (let s = (away.at(-1) ?? base) * FIT_ZOOM_STEP; s >= base * FIT_ZOOM_LEAST; s *= FIT_ZOOM_STEP) out.push(s);

  return out;
}

/**
 * The overview's framing for a stage (Ruling R104). The picture's own (`base`) where the whole trail and its beads (`points`) already sit
 * inside the stage less its gutters, clear of the page's words and the dock (`keep`); otherwise the nearest framing where they do: the
 * zoom kept and the look-at point moved the least, and only when no move is enough the zoom changed a step at a time (out or in while the
 * picture still covers the stage; further out last). While the zoom is at least 1 the look-at point stays where the picture still covers
 * the stage. Returns `base` when nothing fits.
 */
export function fitOverview(base: Look, points: readonly FitPoint[], stage: Stage, keep: KeepOut): Look {
  const bounds: Box = { l: FIT_GUTTER, t: FIT_GUTTER, r: stage.w - FIT_GUTTER, b: stage.h - FIT_GUTTER };
  const grow = (b: Box, g: number): Box => ({ l: b.l - g, t: b.t - g, r: b.r + g, b: b.b + g });
  const blocks = [...keep.words.map((b) => grow(b, WORDS_GAP)), ...(keep.dock ? [grow(keep.dock, DOCK_GAP)] : [])];
  const fits = (look: Look): boolean =>
    points.every((p) => {
      const [x, y] = overviewAt(look, stage, p.x, p.y);
      const box: Box = { l: x - p.pad, t: y - p.pad, r: x + p.pad, b: y + p.pad };

      return box.l >= bounds.l && box.t >= bounds.t && box.r <= bounds.r && box.b <= bounds.b && !blocks.some((b) => overlaps(box, b));
    });

  if (stage.w <= 0 || stage.h <= 0 || points.length === 0 || fits(base)) return base;

  const cover = Math.max(stage.w / PICTURE.w, stage.h / PICTURE.h);

  for (const s of zoomsFrom(base.s)) {
    const S = cover * s;
    const covers = s >= 1;
    const [x0, x1] = covers ? [stage.w / (2 * S), PICTURE.w - stage.w / (2 * S)] : [0, PICTURE.w];
    const [y0, y1] = covers ? [stage.h / (2 * S), PICTURE.h - stage.h / (2 * S)] : [0, PICTURE.h];
    let best: Look | null = null;
    let far = Infinity;

    for (const ax of along(base.ax, x0, x1)) {
      for (const ay of along(base.ay, y0, y1)) {
        const d = Math.hypot(ax - base.ax, ay - base.ay);

        if (d < far && fits({ ax, ay, s })) {
          best = { ax, ay, s };
          far = d;
        }
      }
    }
    if (best !== null) return best;
  }

  return base;
}
