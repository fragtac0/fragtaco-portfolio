import type { Book, ShelfScene } from "./shelf-scene";
import { dropProgress, DROP_FALL, easeOut, openPhases, spring, WALLZ } from "./shelf-math";

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
  /** 1 while the shelf is fully shown, fading to 0 as a book is opened. */
  keep: number;
  animate: Animate;
};

/**
 * One frame of every book: the drop-in, hover lift, the open-book path, and the soft wall shadow a
 * lifted book casts (none while a book stands in the row). Moves the three.js objects only; the
 * springs live in each book's `anim`. Returns whether anything is still moving.
 */
export function poseBooks(s: ShelfScene, f: PoseInput): boolean {
  let busy = false;
  const { el, dt, now, reduced, keep, animate } = f;
  const { tmpV: p, tmpQ: q } = s;
  for (const b of s.books) {
    const k = reduced ? 1 : dropProgress(el, b.order);
    const e = easeOut(k);
    const a = b.anim;
    if (animate(a, "hover", b === f.hover || b === f.focused ? 1 : 0, 9, dt)) busy = true;
    if (animate(a, "open", b === f.opened ? 1 : 0, 5, dt)) busy = true;
    p.copy(b.base);
    p.y += a.hover * HOVER_LIFT + (1 - e) * DROP_FALL;
    // two phases: slide straight out of the shelf (+z), clear of the neighbours, then travel and turn
    const { pull, present } = a.open > 0.001 ? openPhases(a.open) : { pull: 0, present: 0 };
    p.z += pull * (b.W + 0.12);
    if (present > 0) p.lerp(b.openPos, present);
    b.g.position.copy(p);
    b.g.scale.setScalar(1 + (b.openScale - 1) * present);
    q.copy(b.baseQ);
    if (present > 0) {
      q.slerp(s.qOpen, present);
      if (!reduced) {
        q.premultiply(s.tmpQ2.setFromAxisAngle(s.yAxis, Math.sin(now / 1500) * 0.06 * present));
      }
    }
    b.g.quaternion.copy(q);
    const op = a.open > 0.01 ? 1 : keep * Math.min(1, k * 2.2);
    if (b.mats[0].opacity !== op) {
      for (let m = 0; m < b.mats.length; m++) b.mats[m].opacity = b.litMats[m].opacity = op;
    }
    s.setLit(b, a.open > 0.001); // only the book that is open is lit
    b.g.visible = op > 0.004;
    // a lifted book has a soft, neutral shadow on the ground behind it; one standing in the row has none
    const lift = Math.min(1, a.hover * 0.6 + a.open);
    const sc = b.g.scale.x;
    b.wallSh.position.set(p.x + 0.04 * sc, p.y - 0.05 * sc, WALLZ);
    b.wallSh.scale.set((b.T / 0.53) * sc + 0.1, (b.H / 0.77) * sc + 0.1, 1);
    b.wallSh.material.opacity = 0.5 * lift * e * (a.open > 0.01 ? 1 : keep);
    b.wallSh.visible = b.wallSh.material.opacity > 0.004;
  }
  return busy;
}
