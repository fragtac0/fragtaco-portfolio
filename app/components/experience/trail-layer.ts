// The trail, the pins' stems and the radar (spec 9.3), drawn on two overlay canvases above the night map and its depth
// blurs (Ruling R101: nothing here sits under a backdrop blur, so the blurs never re-run while the radar moves).
// The trail canvas covers the stage and is drawn when the view changes. The radar canvas is a small square round "now",
// drawn every frame the radar runs. The foot of each pin and the trail share one height, so the feet sit on the line.
import type { XY } from "./card-slot";
import { liftOf } from "./heights";
import { STEM, project, type Stage, type View } from "./view";
import type { TrailPoint } from "./trail";

/** How far the trail and the pins' feet stand above the ground, in map units, when the lines have fully risen. */
export const TRAIL_LIFT = 0.8;
/** The stems and feet are drawn once the lines have risen this much. */
export const STEMS_FROM = 0.02;
/** The radar's two rings: a ring's life, and how big it grows (map units, before the zoom takes the root). */
export const RADAR_MS = 2600;
export const RADAR_R0 = 2;
export const RADAR_R1 = 17;
export const RADAR_SCALE = 1.6;
export const RADAR_POINTS = 40;
/** The most a radar ring's radius can be, in screen pixels for each unit of the stage's scale (the climb's, with the near side's perspective). */
export const RADAR_REACH = 66;

/** The colours (the cream and the accent of tokens.css, as the preview mixed them for the canvas). */
export const TRAIL_SHADOW = "rgba(0, 0, 0, 0.42)";
export const TRAIL_INK = "#fff8e8";
export const AHEAD_INK = "rgba(255, 248, 232, 0.8)";
export const STEM_INK = "rgba(255, 255, 255, 0.8)";
export const FOOT_INK = "#fff";

/** A milestone as the overlay needs it: where it is on the ground, and the ground's height there. */
export type Spot = Pick<TrailPoint, "x" | "y" | "n">;
export type Pin = { foot: XY; head: XY };

/** The lift of the trail's feet at this rise. */
export const trailLift = (v: View): number => TRAIL_LIFT * v.rise;

/** Where each milestone's foot (on the trail) and head (the top of its stem, where its bead is) are on the stage. */
export function pinPlaces(v: View, spots: readonly Spot[]): Pin[] {
  const lift = trailLift(v);

  return spots.map((m) => {
    const z = liftOf(m.n, v.rise) + lift;

    return { foot: project(v, m.x, m.y, z), head: project(v, m.x, m.y, z + STEM * v.rise) };
  });
}

function trace(c: CanvasRenderingContext2D, v: View, points: readonly TrailPoint[], lift: number): void {
  c.beginPath();
  points.forEach((p, i) => {
    const [x, y] = project(v, p.x, p.y, liftOf(p.n, v.rise) + lift);

    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  });
}

/**
 * The trail on the cleared canvas: the first one as a dark line under a cream one, then the dotted way ahead to the summit,
 * then each pin's stem and foot. `pins` come from `pinPlaces` for the same view.
 */
export function drawTrail(c: CanvasRenderingContext2D, v: View, stage: Stage, dpr: number, trail: readonly TrailPoint[], ahead: readonly TrailPoint[], pins: readonly Pin[]): void {
  const lift = trailLift(v);

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, stage.w, stage.h);
  c.lineCap = "round";
  c.lineJoin = "round";
  trace(c, v, trail, lift);
  c.strokeStyle = TRAIL_SHADOW;
  c.lineWidth = 3.6;
  c.stroke();
  c.strokeStyle = TRAIL_INK;
  c.lineWidth = 1.5;
  c.stroke();
  trace(c, v, ahead, lift);
  c.setLineDash([1.5, 6]);
  c.strokeStyle = AHEAD_INK;
  c.lineWidth = 1.3;
  c.stroke();
  c.setLineDash([]);
  if (v.rise <= STEMS_FROM) return;
  for (const { foot, head } of pins) {
    c.beginPath();
    c.moveTo(foot[0], foot[1]);
    c.lineTo(head[0], head[1]);
    c.strokeStyle = STEM_INK;
    c.lineWidth = 1.2;
    c.stroke();
    c.beginPath();
    c.ellipse(foot[0], foot[1], 3.4, 3.4 * Math.max(0.35, v.cp), 0, 0, 7);
    c.fillStyle = FOOT_INK;
    c.fill();
  }
}

/** A ring of the radar `t` (0 to 1) of the way through its life: its points on the stage and its strength. */
export function radarRing(v: View, at: Spot, t: number): { points: XY[]; alpha: number } {
  const r = ((RADAR_R0 + (RADAR_R1 - RADAR_R0) * t) / Math.sqrt(v.s)) * RADAR_SCALE;
  const z = liftOf(at.n, v.rise) + trailLift(v);
  const points: XY[] = [];

  for (let a = 0; a <= RADAR_POINTS; a++) {
    const turn = (a / RADAR_POINTS) * Math.PI * 2;

    points.push(project(v, at.x + Math.cos(turn) * r, at.y + Math.sin(turn) * r, z));
  }

  return { points, alpha: 0.95 * (1 - t) };
}

/** How far through its life each of the two rings is at `now` (milliseconds): the second is half a life behind. */
export const radarPhases = (now: number): [number, number] => [(now / RADAR_MS) % 1, (now / RADAR_MS + 0.5) % 1];

/** The side of the radar's canvas, in CSS pixels, for a stage's scale (screen pixels for each map unit at zoom 1): enough for the biggest ring in either state. */
export function radarSide(baseScale: number): number {
  return 2 * Math.ceil(RADAR_REACH * baseScale) + 8;
}

/** The foot of "now" on the stage: the middle of the radar. */
export function radarFoot(v: View, at: Spot): XY {
  return project(v, at.x, at.y, liftOf(at.n, v.rise) + trailLift(v));
}

/**
 * The radar's two rings on a canvas that is `side` pixels across with its middle on `foot` (from `radarFoot`). The canvas is
 * cleared first. `phases` are the rings' places in their life.
 */
export function drawRadar(c: CanvasRenderingContext2D, v: View, at: Spot, foot: XY, side: number, dpr: number, phases: readonly number[]): void {
  const half = side / 2;

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, side, side);
  c.lineWidth = 1.6;
  for (const t of phases) {
    const { points, alpha } = radarRing(v, at, t);

    c.beginPath();
    points.forEach(([x, y], i) => {
      if (i) c.lineTo(x - foot[0] + half, y - foot[1] + half);
      else c.moveTo(x - foot[0] + half, y - foot[1] + half);
    });
    c.strokeStyle = `rgba(252, 76, 0, ${alpha})`;
    c.stroke();
  }
}
