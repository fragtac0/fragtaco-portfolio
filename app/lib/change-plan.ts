/**
 * What a page change looks like on this screen (round 7 spec 4): pure, and the browser's answers it reads. Every change is the same reveal, radial from
 * the centre of the screen over `GLASS.ms` (2.25 s), or the 120 ms fade under reduced motion, or none where View Transitions are not supported. The
 * running of a change is in page-change.ts, which re-exports all of this.
 */
import { GLASS } from "../components/page-change/glass-math";

export type ChangeKind = "radial" | "fade";
export interface Point {
  x: number;
  y: number;
}
export interface ChangePlan {
  kind: ChangeKind | "none";
  origin: Point;
  /** Distance from the origin to the farthest corner of the screen. */
  radius: number;
  ms: number;
  /** The viewport's size (the pictures of a change are this big; the glass's bend is sized from the height). */
  vw: number;
  vh: number;
}

/** The two lengths: the radial reveal (`GLASS.ms`: 2250 ms) and the reduced-motion fade (120 ms). */
const MS: Record<ChangeKind, number> = { radial: GLASS.ms, fade: 120 };

/** What the screen is like: whether the browser can run View Transitions, reduced motion, and the viewport. */
export interface ChangeEnv {
  supported: boolean;
  reduced: boolean;
  vw: number;
  vh: number;
}

/**
 * Pure: what a change looks like on this screen. The same for every pair of pages (`from` and `to` are the addresses; they
 * are named so a call says what it is for, and the reveal does not depend on them): radial from the centre of the screen,
 * 2250 ms (`GLASS.ms`), or the 120 ms fade under reduced motion. No View Transitions support gives `none` (the page just changes).
 */
export function planChange(from: string, to: string, env: ChangeEnv): ChangePlan {
  void from;
  void to;
  const origin = { x: env.vw / 2, y: env.vh / 2 };
  const radius = Math.hypot(origin.x, origin.y);
  if (!env.supported) return { kind: "none", origin, radius, ms: 0, vw: env.vw, vh: env.vh };
  const kind: ChangeKind = env.reduced ? "fade" : "radial";
  return { kind, origin, radius, ms: MS[kind], vw: env.vw, vh: env.vh };
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const planNow = (from: string, to: string) =>
  planChange(from, to, {
    supported: "startViewTransition" in document,
    reduced: reduced(),
    vw: window.innerWidth,
    vh: window.innerHeight,
  });

/**
 * True while the radial reveal is the change that is running (the mark on <html>), false for the reduced-motion fade, no
 * transition at all, and when nothing is changing. For work that is only worth its cost under the 2.25 s reveal.
 */
export const isRadialChange = () => typeof document !== "undefined" && document.documentElement.dataset.changeKind === "radial";
