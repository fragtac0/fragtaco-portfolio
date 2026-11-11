import type { Book, ShelfScene } from "./shelf-scene";
import { dropProgress, DROP_FALL, easeOut, openPhases, spring, WALLZ } from "./shelf-math";

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
 * One frame of every book: the drop-in, hover lift, the open-book path, and the contact and wall
 * shadows that stay behind on the plank and the wall while a book lifts away. Moves the three.js
 * objects only; the springs live in each book's `anim`. Returns whether anything is still moving.
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
    p.y += a.hover * 0.12 + (1 - e) * DROP_FALL;
    p.z += a.hover * 0.16;
    // two phases: slide straight out of the shelf (+z), clear of the neighbours, then travel and turn
    const { pull, present } = a.open > 0.001 ? openPhases(a.open) : { pull: 0, present: 0 };
    p.z += pull * (b.W + 0.12);
    if (present > 0) p.lerp(b.openPos, present);
    b.g.position.copy(p);
    q.copy(b.baseQ);
    if (present > 0) {
      q.slerp(s.qOpen, present);
      if (!reduced) {
        q.premultiply(s.tmpQ2.setFromAxisAngle(s.yAxis, Math.sin(now / 1500) * 0.06 * present));
      }
    }
    b.g.quaternion.copy(q);
    const op = a.open > 0.01 ? 1 : keep * Math.min(1, k * 2.2);
    if (b.mats[0].opacity !== op) for (const m of b.mats) m.opacity = op;
    b.g.visible = op > 0.004;
    // shadows are their own animation: they stay behind on the plank and the wall while the book lifts away
    const lift = Math.min(1, Math.max(1 - e, a.hover * 0.45, a.open));
    b.contact.position.set(b.base.x + 0.015, 0.003, b.base.z + 0.03 + a.hover * 0.12);
    b.contact.scale.set((b.T + 0.16) * (1 + 0.5 * lift), (b.W + 0.3) * (1 + 0.25 * lift), 1);
    b.contact.material.opacity = 0.85 * (1 - lift) * keep;
    b.wallSh.position.set(p.x + 0.07 + a.hover * 0.05, p.y + 0.02, WALLZ);
    b.wallSh.scale.set(
      (b.T * 2.2 + 0.32) * (1 + 0.3 * a.hover),
      (b.H * 1.15 + 0.26) * (1 + 0.12 * a.hover),
      1,
    );
    b.wallSh.material.opacity = 0.8 * e * (1 - 0.5 * a.hover) * (1 - a.open) * keep;
    b.contact.visible = b.contact.material.opacity > 0.004;
    b.wallSh.visible = b.wallSh.material.opacity > 0.004;
  }
  return busy;
}
