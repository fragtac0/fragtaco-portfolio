import { useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { HeroHandle } from "../hero/hero";
import { dragProgress, settlesOnTarget, type Side } from "./card-pose";
import type { NavContext } from "./hero-nav";
import {
  NO_HOT,
  SIDES,
  measure,
  place,
  placeAll,
  type CardLive,
  type Els,
  type HotState,
  type Pose,
} from "./use-card-poses";

type Options = {
  hero: RefObject<HeroHandle>;
  leftRef: RefObject<HTMLElement>;
  rightRef: RefObject<HTMLElement>;
  scrimRef: RefObject<HTMLElement>;
  setHot: Dispatch<SetStateAction<HotState>>;
  /** Shared with the reducer's caller: this hook writes `heroVisible`. */
  ctx: MutableRefObject<NavContext>;
  live: CardLive;
};

const WHEEL_TRIGGER = 60;
const WHEEL_IDLE_MS = 160;
const WHEEL_LOCK_MS = 750;
const DRAG_SLOP = 10;

const mix = (a: Pose, b: Pose, p: number): Pose => ({
  x: a.x + (b.x - a.x) * p,
  s: a.s + (b.s - a.s) * p,
});

type Drag = {
  el: HTMLElement;
  sign: 1 | -1;
  from: Pose;
  to: Pose;
  target: "hero" | Side;
  origin: "hero" | Side;
  p: number;
};

/**
 * Everything the user does to the cards: window keys, trackpad swipe, touch drag, hover nudge,
 * clicks and the scrim, plus the hero's visibility gate. One effect per input, each adding its
 * listeners once. Ported from the mockup's `Cards`. A drag writes the transform on each
 * pointermove, and only the release dispatches.
 */
export function useCardInput({ hero, leftRef, rightRef, scrimRef, setHot, ctx, live }: Options) {
  const { navRef, hotRef, dispatchRef, draggingRef } = live;

  // the hero counts as in view above 60% (so the keys and swipes ignore a half-scrolled hero)
  useEffect(() => {
    const root = hero.current?.root();
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) ctx.current.heroVisible = last.intersectionRatio > 0.6;
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [hero, ctx]);

  // keyboard (window): ArrowLeft / ArrowRight / Escape through the reducer
  useEffect(() => {
    const gated = () => !ctx.current.heroVisible || ctx.current.layerOpen;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // keep Back / Forward and friends
      const key = e.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Escape") return;
      if (navRef.current === "hidden" || gated()) return;
      if (key !== "Escape") e.preventDefault();
      dispatchRef.current({ kind: "key", key });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navRef, dispatchRef, ctx]);

  // trackpad: horizontal wheel on the hero, accumulated, then locked; vertical is blocked while open
  useEffect(() => {
    const root = hero.current?.root();
    if (!root) return;
    let acc = 0;
    let locked = false;
    let accTimer = 0;
    let lockTimer = 0;
    const onWheel = (e: WheelEvent) => {
      const current = navRef.current;
      if (current === "hidden") return;
      const target = e.target instanceof Element ? e.target : null;
      const isOpen = current !== "hero";
      // vertical wheel is not ours: while a card is open the document lock (cards-open) stops the page
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (isOpen && target?.closest(".card-body")) return;
      e.preventDefault();
      if (locked) return;
      acc += e.deltaX;
      window.clearTimeout(accTimer);
      accTimer = window.setTimeout(() => {
        acc = 0;
      }, WHEEL_IDLE_MS);
      if (Math.abs(acc) > WHEEL_TRIGGER) {
        const dir = acc > 0 ? "left" : "right"; // positive deltaX moves forward, like a swipe left
        acc = 0;
        locked = true;
        lockTimer = window.setTimeout(() => {
          locked = false;
        }, WHEEL_LOCK_MS);
        dispatchRef.current({ kind: "swipe", dir });
      }
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.clearTimeout(accTimer);
      window.clearTimeout(lockTimer);
      root.removeEventListener("wheel", onWheel);
    };
  }, [hero, navRef, dispatchRef]);

  // touch drag: the card follows the finger; mouse never drags
  useEffect(() => {
    const root = hero.current?.root();
    const left = leftRef.current;
    const right = rightRef.current;
    if (!root || !left || !right) return;
    const els: Els = { left, right };
    const go = (to: "hero" | "left" | "right") => dispatchRef.current({ kind: "go", to });
    const gated = () => !ctx.current.heroVisible || ctx.current.layerOpen;
    let t0: { x: number; y: number } | null = null;
    let drag: Drag | null = null;
    let pointerId: number | null = null;
    /**
     * The one place a drag ends. It always clears the drag state (so the pose effect and resize
     * work again), releases the pointer and drops the dragging flag. `settle` also commits the
     * result: the target past SETTLE_AT, else back to the origin; `abort` puts the cards back.
     */
    const endDrag = (how: "settle" | "abort") => {
      const d = drag;
      const id = pointerId;
      t0 = null;
      drag = null;
      pointerId = null;
      draggingRef.current = false;
      if (id !== null) {
        try {
          if (root.hasPointerCapture(id)) root.releasePointerCapture(id);
        } catch {
          /* the pointer is already gone */
        }
      }
      if (!d) return;
      delete d.el.dataset.dragging;
      const next = how === "settle" && settlesOnTarget(d.p) ? d.target : d.origin;
      if (how === "settle") go(next);
      // going back to where it started changes no state, so put the cards back by hand
      placeAll(els, how === "settle" ? next : navRef.current, how === "settle" ? NO_HOT : hotRef.current, false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return; // a second finger or a palm never takes over a drag
      endDrag("abort"); // a drag that lost its end event must not strand the cards
      if (e.pointerType === "mouse" || navRef.current === "hidden" || gated()) return;
      t0 = { x: e.clientX, y: e.clientY };
      pointerId = e.pointerId;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!t0 || !e.isPrimary || e.pointerId !== pointerId) return;
      const dx = e.clientX - t0.x;
      const dy = e.clientY - t0.y;
      if (!drag) {
        if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        const current = navRef.current;
        if (current === "hidden") return;
        const opening = current === "hero";
        const side: Side = current === "hero" ? (dx < 0 ? "right" : "left") : current;
        const el = els[side];
        drag = {
          el,
          sign: side === "right" ? (opening ? -1 : 1) : opening ? 1 : -1,
          from: measure(el, side, opening ? "rest" : "open", false),
          to: measure(el, side, opening ? "open" : "rest", false),
          target: opening ? side : "hero",
          origin: current,
          p: 0,
        };
        draggingRef.current = true;
        el.dataset.dragging = "";
        try {
          root.setPointerCapture(e.pointerId); // a release outside the hero still ends the drag
        } catch {
          /* not capturable: the pointerup on the hero still ends it */
        }
      }
      drag.p = dragProgress(dx, drag.el.offsetWidth, drag.sign);
      place(drag.el, mix(drag.from, drag.to, drag.p));
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      endDrag("settle");
    };
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", onPointerEnd);
    root.addEventListener("pointercancel", onPointerEnd);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerEnd);
      root.removeEventListener("pointercancel", onPointerEnd);
      endDrag("abort");
    };
  }, [hero, leftRef, rightRef, ctx, navRef, hotRef, dispatchRef, draggingRef]);

  // clicks: at the hero a card opens; open, its rail closes it; the scrim closes
  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    const scrim = scrimRef.current;
    if (!left || !right || !scrim) return;
    const els: Els = { left, right };
    const go = (to: "hero" | "left" | "right") => dispatchRef.current({ kind: "go", to });
    const clicks: Array<[Side, (e: MouseEvent) => void]> = SIDES.map((side) => [
      side,
      (e: MouseEvent) => {
        const current = navRef.current;
        if (current === "hero") go(side);
        else if (current === side && e.target instanceof Element && e.target.closest(".rail")) go("hero");
      },
    ]);
    for (const [side, fn] of clicks) els[side].addEventListener("click", fn);
    const onScrimClick = () => go("hero");
    scrim.addEventListener("click", onScrimClick);
    return () => {
      scrim.removeEventListener("click", onScrimClick);
      for (const [side, fn] of clicks) els[side].removeEventListener("click", fn);
    };
  }, [leftRef, rightRef, scrimRef, navRef, dispatchRef]);

  // hover (mouse at the hero): the card nudges in 14 px
  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;
    const els: Els = { left, right };
    const enters: Array<[Side, (e: PointerEvent) => void, () => void]> = SIDES.map((side) => [
      side,
      (e: PointerEvent) => {
        if (e.pointerType === "mouse" && navRef.current === "hero") {
          setHot((h) => (h[side] ? h : { ...h, [side]: true }));
        }
      },
      () => setHot((h) => (h[side] ? { ...h, [side]: false } : h)),
    ]);
    for (const [side, enter, leave] of enters) {
      els[side].addEventListener("pointerenter", enter);
      els[side].addEventListener("pointerleave", leave);
    }
    return () => {
      for (const [side, enter, leave] of enters) {
        els[side].removeEventListener("pointerenter", enter);
        els[side].removeEventListener("pointerleave", leave);
      }
    };
  }, [leftRef, rightRef, navRef, setHot]);
}
