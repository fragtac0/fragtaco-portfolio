import type { Book, ShelfScene } from "./shelf-scene";
import { LINE_ALPHA } from "../../../styles/tokens";
import {
  dropProgress,
  DROP_FALL,
  easeOut,
  liftPhases,
  ROW_DIM,
  spring,
  stepOpen,
  WALLZ,
} from "./shelf-math";

/** How far a hovered or focused book rises (world units). */
const HOVER_LIFT = 0.1;

/** A spring, or a snap when motion is reduced. Returns whether it is still moving. */
export type Animate = (
  o: Record<string, number>,
  key: string,
  to: number,
  w: number,
  dt: number,
) => boolean;

/** The engine's springs: real ones, or a snap to the target when motion is reduced. */
export function createAnimate(reduced: boolean): Animate {
  return (o, key, to, w, dt) => {
    if (!reduced) return spring(o, key, to, w, dt);
    const moved = o[key] !== to;
    o[key] = to;
    o[key + "V"] = 0;
    return moved;
  };
}

export type PoseInput = {
  /** Seconds since the shelf started (a drop-in that is skipped starts long past its end). */
  el: number;
  dt: number;
  /** The frame's timestamp, for the open book's slow sway. */
  now: number;
  reduced: boolean;
  hover: Book | null;
  focused: Book | null;
  opened: Book | null;
  animate: Animate;
};

/** The wall shadow texture's rectangle, as a share of the plane (shelf-canvases.ts `softRectCanvas`). */
const SHADOW_RECT_W = 0.53;
const SHADOW_RECT_H = 0.77;

/**
 * One frame of every book: the drop-in, hover lift, the open path, the row's dimming and the light
 * on a lifted book, and the soft wall shadow a lifted book casts (none while a book stands in the
 * row). Opening runs on the steady `open` progress (620 ms, `stepOpen`): the book rises straight
 * up, then turns to its cover (`liftPhases`) and settles at the spot the open path worked out
 * (`openPos`, `openScale`); the other books stay where they are and dim to 70%. With reduced motion
 * nothing travels: the book is at its lifted place at once and its cover fades in. Moves the
 * three.js objects only; the springs live in each book's `anim`. Returns whether anything is
 * still moving.
 */
export function poseBooks(s: ShelfScene, f: PoseInput): boolean {
  let busy = false;
  const { el, dt, now, reduced, animate } = f;
  const { tmpV: p, tmpQ: q } = s;
  // first the progress of every book, so the row's dim and the light can follow the lifted one
  let risen = 0;
  for (const b of s.books) {
    const a = b.anim;
    const to = b === f.opened ? 1 : 0;
    if (animate(a, "hover", b === f.hover || b === f.focused ? 1 : 0, 9, dt)) busy = true;
    const o = reduced ? to : stepOpen(a.open, to, dt);
    if (o !== a.open) busy = true;
    a.open = o;
    if (reduced) {
      // nothing travels: the book fades in again each time it changes place
      if (a.openTo !== to) {
        a.openTo = to;
        a.show = a.showV = 0;
      }
      if (spring(a, "show", 1, 14, dt)) busy = true;
    }
    risen = Math.max(risen, liftPhases(a.open).rise);
  }
  const dim = 1 - (1 - ROW_DIM) * risen;
  if (s.lights.set(risen)) busy = true;
  for (const b of s.books) {
    const k = reduced ? 1 : dropProgress(el, b.order);
    const e = easeOut(k);
    const a = b.anim;
    const isOpen = a.open > 0.001;
    const { rise, turn } = isOpen ? liftPhases(a.open) : { rise: 0, turn: 0 };
    p.copy(b.base);
    p.y += a.hover * HOVER_LIFT + (1 - e) * DROP_FALL;
    // straight up, clear of the neighbours in depth (which a flat camera cannot see), then to the final place
    p.y += rise * b.lift;
    p.z += rise * (b.W + 0.12);
    if (isOpen) p.y = Math.min(p.y, b.yMax);
    if (turn > 0) p.lerp(b.openPos, turn);
    b.g.position.copy(p);
    const sc = 1 + (b.openScale - 1) * turn;
    b.g.scale.setScalar(sc);
    q.copy(b.baseQ);
    if (turn > 0) {
      q.slerp(s.qOpen, turn);
      if (!reduced) {
        q.premultiply(s.tmpQ2.setFromAxisAngle(s.yAxis, Math.sin(now / 1500) * 0.06 * turn));
      }
    }
    b.g.quaternion.copy(q);
    const show = reduced ? a.show : 1;
    const op = (a.open > 0.01 ? 1 : dim * Math.min(1, k * 2.2)) * show;
    if (b.mats[0].opacity !== op) {
      for (let m = 0; m < b.mats.length; m++) b.mats[m].opacity = b.litMats[m].opacity = op;
    }
    s.setLit(b, isOpen); // only a book that is lifted is lit
    b.g.visible = op > 0.004;
    // a lifted book has a soft, neutral shadow on the ground behind it, as wide as the book looks
    // from the front (its spine at first, its cover once turned); one standing in the row has none
    const lift = Math.min(1, a.hover * 0.6 + rise);
    const yaw = Math.PI / 2 + (0.3 - Math.PI / 2) * turn;
    const seen = b.W * Math.abs(Math.cos(yaw)) + b.T * Math.abs(Math.sin(yaw));
    b.wallSh.position.set(p.x + 0.04 * sc, p.y - 0.05 * sc, WALLZ);
    b.wallSh.scale.set((seen / SHADOW_RECT_W) * sc + 0.1, (b.H / SHADOW_RECT_H) * sc + 0.1, 1);
    b.wallSh.material.opacity = 0.5 * lift * e * (a.open > 0.01 ? 1 : dim) * show;
    b.wallSh.visible = b.wallSh.material.opacity > 0.004;
  }
  s.line.visible = dim > 0.004;
  s.line.material.opacity = LINE_ALPHA * dim;
  return busy;
}
