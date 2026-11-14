// The camera along the trail (spec 9.4). `settle` says where it should sit for a milestone: where it is, while the
// milestone is comfortably in the middle of the view; otherwise the nearest place along the trail from which it is.
// `springStep` moves it toward its goal like a weight on a critically damped spring.
import { STEM, viewOf, project, type Cam, type Stage } from "./view";
import { liftOf } from "./heights";
import { clamp } from "./map-math";
import type { TrailPoint } from "./trail";

/** The middle of the view: 25% to 75% across, 40% to 80% down. */
export const MIDDLE = { x0: 0.25, x1: 0.75, y0: 0.4, y1: 0.8 };
/** The spring's natural frequency, per second. */
export const OMEGA = 2.1;
/** How far the search for a place steps along the trail, and how much further it goes once a place is found. */
export const SEARCH_STEP = 0.02;
export const SEARCH_MARGIN = 0.05;
/** The longest step of time the spring takes at once, in seconds (a stalled tab must not throw the camera). */
export const MAX_DT = 0.05;

/** A milestone as the camera sees it: its place on the trail (map units, the ground's height there) and its share of the trail. */
export type Milestone = Pick<TrailPoint, "x" | "y" | "n"> & { u: number };

/** Whether the milestone's head is in the middle of the view with the camera at u in My climb. */
export function inMiddle(cam: Cam, m: Milestone, u: number, stage: Stage): boolean {
  const v = viewOf(cam, 1, u, stage);
  const [x, y] = project(v, m.x, m.y, liftOf(m.n, 1) + STEM);

  return x > stage.w * MIDDLE.x0 && x < stage.w * MIDDLE.x1 && y > stage.h * MIDDLE.y0 && y < stage.h * MIDDLE.y1;
}

/** Where the camera should be (a share of the trail) to show a milestone, when it is now at `goalU`. */
export function settle(cam: Cam, goalU: number, m: Milestone, stage: Stage): number {
  if (inMiddle(cam, m, goalU, stage)) return goalU;

  const dir = Math.sign(m.u - goalU) || 1;

  for (let cu = goalU; dir > 0 ? cu <= 1 : cu >= 0; cu += dir * SEARCH_STEP) {
    if (inMiddle(cam, m, cu, stage)) return clamp(cu + dir * SEARCH_MARGIN);
  }

  return m.u;
}

/**
 * One step of `dt` seconds (at most `MAX_DT`: a longer one, after a stalled tab, counts as that) of a critically
 * damped spring: the place and speed afterwards. From rest it does not overshoot its goal, whatever the step.
 * A goal set just ahead of a camera that is already moving toward it may be overshot a little, as in the
 * preview the owner chose (Ruling R98): a spring cannot stop in less than its stopping distance.
 */
export function springStep(u: number, vel: number, goal: number, dt: number): [number, number] {
  const w = OMEGA;
  const d = u - goal;
  const t = Math.min(Math.max(dt, 0), MAX_DT);
  // The exact solution of x'' = -w^2 x - 2 w x' over dt (no overshoot for any dt, unlike a plain Euler step).
  const e = Math.exp(-w * t);
  const c = vel + w * d;
  const next = goal + (d + c * t) * e;
  const speed = (vel - w * c * t) * e;

  return [next, speed];
}
