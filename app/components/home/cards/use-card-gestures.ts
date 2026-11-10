import { useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { HeroHandle } from "../hero/hero";
import { SETTLE_AT, cardPose, dragProgress, type Mode, type Side } from "./card-pose";
import { modeOf } from "./card-shell";
import type { NavContext, NavInput, NavState } from "./hero-nav";

export type HotState = Record<Side, boolean>;
export const NO_HOT: HotState = { left: false, right: false };

type Pose = { x: number; s: number };
type Els = Record<Side, HTMLElement>;

type Options = {
  hero: RefObject<HeroHandle>;
  leftRef: RefObject<HTMLElement>;
  rightRef: RefObject<HTMLElement>;
  scrimRef: RefObject<HTMLElement>;
  nav: NavState;
  hot: HotState;
  setHot: Dispatch<SetStateAction<HotState>>;
  dispatch: (input: NavInput) => void;
  /** Shared with the reducer's caller: this hook writes `heroVisible`. */
  ctx: MutableRefObject<NavContext>;
};

const SIDES: Side[] = ["left", "right"];
const FOCUS_DELAY_MS = 500;
const WHEEL_TRIGGER = 60;
const WHEEL_IDLE_MS = 160;
const WHEEL_LOCK_MS = 750;
const DRAG_SLOP = 10;

function measure(el: HTMLElement, side: Side, mode: Mode, hot: boolean): Pose {
  const rail = el.querySelector<HTMLElement>(".rail");
  return cardPose({
    side,
    mode,
    vw: window.innerWidth,
    width: el.offsetWidth,
    rail: rail?.offsetWidth ?? 0,
    hot,
  });
}

function place(el: HTMLElement, { x, s }: Pose) {
  el.style.transform = `translate3d(${x}px, -50%, 0) scale(${s})`;
}

function placeAll(els: Els, nav: NavState, hot: HotState) {
  for (const side of SIDES) {
    place(els[side], measure(els[side], side, modeOf(nav, side), hot[side] && nav === "hero"));
  }
}

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
 * Everything that moves the cards: the pose effect (transforms written straight to the elements),
 * window keys, trackpad swipe, touch drag, hover nudge, clicks, scrim, focus, and the page lock.
 * Ported from the mockup's `Cards`. No React state changes per frame: a drag writes the transform
 * on each pointermove, and only the release dispatches.
 */
export function useCardGestures({
  hero,
  leftRef,
  rightRef,
  scrimRef,
  nav,
  hot,
  setHot,
  dispatch,
  ctx,
}: Options) {
  // The listeners are added once; they read the latest values through these refs.
  const navRef = useRef(nav);
  const hotRef = useRef(hot);
  const dispatchRef = useRef(dispatch);
  const draggingRef = useRef(false);
  const prevNavRef = useRef(nav);

  // ---- poses: whenever nav or hot changes (resize is handled with the listeners below)
  useEffect(() => {
    navRef.current = nav;
    hotRef.current = hot;
    dispatchRef.current = dispatch;
    const left = leftRef.current;
    const right = rightRef.current;
    if (left && right && !draggingRef.current) placeAll({ left, right }, nav, hot);
  }, [nav, hot, dispatch, leftRef, rightRef]);

  // ---- a new navigation state clears the hover nudge, as the mockup's `go` does
  useEffect(() => {
    setHot(NO_HOT);
  }, [nav, setHot]);

  // ---- focus: into the open card after its slide, back to its rail on close
  useEffect(() => {
    const prev = prevNavRef.current;
    prevNavRef.current = nav;
    if (nav === "left" || nav === "right") {
      const card = (nav === "right" ? rightRef : leftRef).current;
      const id = window.setTimeout(() => {
        card?.querySelector<HTMLElement>(".card-scroll")?.focus({ preventScroll: true });
      }, FOCUS_DELAY_MS);
      return () => window.clearTimeout(id);
    }
    if (prev === "left" || prev === "right") {
      const card = (prev === "right" ? rightRef : leftRef).current;
      card?.querySelector<HTMLElement>(".rail")?.focus({ preventScroll: true });
    }
  }, [nav, leftRef, rightRef]);

  // ---- the page does not scroll while a card is open: html and body stop scrolling (see cards.css),
  // which also covers the dock, the keyboard and a dragged scrollbar. The cards' own scroll areas
  // still scroll. Removed on close and on unmount.
  const isOpen = nav === "left" || nav === "right";
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    html.classList.add("cards-open");
    return () => html.classList.remove("cards-open");
  }, [isOpen]);

  // ---- listeners
  useEffect(() => {
    const root = hero.current?.root();
    const left = leftRef.current;
    const right = rightRef.current;
    const scrim = scrimRef.current;
    if (!root || !left || !right || !scrim) return;
    const els: Els = { left, right };
    const go = (to: "hero" | "left" | "right") => dispatchRef.current({ kind: "go", to });
    const gated = () => !ctx.current.heroVisible || ctx.current.layerOpen;

    // the hero counts as in view above 60% (so the keys and swipes ignore a half-scrolled hero)
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) ctx.current.heroVisible = last.intersectionRatio > 0.6;
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(root);

    // keyboard (window): ArrowLeft / ArrowRight / Escape through the reducer
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // keep Back / Forward and friends
      const key = e.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Escape") return;
      if (navRef.current === "hidden" || gated()) return;
      if (key !== "Escape") e.preventDefault();
      dispatchRef.current({ kind: "key", key });
    };
    window.addEventListener("keydown", onKeyDown);

    // trackpad: horizontal wheel on the hero, accumulated, then locked; vertical is blocked while open
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

    // touch drag: the card follows the finger; mouse never drags
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
      const next = how === "settle" && d.p > SETTLE_AT ? d.target : d.origin;
      if (how === "settle") go(next);
      // going back to where it started changes no state, so put the cards back by hand
      placeAll(els, how === "settle" ? next : navRef.current, how === "settle" ? NO_HOT : hotRef.current);
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

    // clicks: at the hero a card opens; open, its rail closes it; the scrim closes
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

    // hover (mouse at the hero): the card nudges in 14 px
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

    // rotation or a resize: poses depend on the viewport width, so recompute them
    const onResize = () => {
      if (!draggingRef.current) placeAll(els, navRef.current, hotRef.current);
    };
    window.addEventListener("resize", onResize);

    return () => {
      io.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(accTimer);
      window.clearTimeout(lockTimer);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerEnd);
      root.removeEventListener("pointercancel", onPointerEnd);
      scrim.removeEventListener("click", onScrimClick);
      for (const [side, fn] of clicks) els[side].removeEventListener("click", fn);
      for (const [side, enter, leave] of enters) {
        els[side].removeEventListener("pointerenter", enter);
        els[side].removeEventListener("pointerleave", leave);
      }
      endDrag("abort");
    };
  }, [hero, leftRef, rightRef, scrimRef, setHot, ctx]);
}
