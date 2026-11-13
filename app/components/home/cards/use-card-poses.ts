import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { cardPose, focusDelay, slidesBetween, type Mode, type Side } from "./card-pose";
import { modeOf } from "./card-shell";
import type { NavInput, NavState } from "./hero-nav";
import { prefersReducedMotion } from "../hero/hero-runtime";

export type HotState = Record<Side, boolean>;
export const NO_HOT: HotState = { left: false, right: false };

export type Pose = { x: number; s: number };
export type Els = Record<Side, HTMLElement>;

export const SIDES: Side[] = ["left", "right"];

/**
 * The latest values the input listeners read. The listeners are added once, so they go through
 * these refs instead of closing over props. `draggingRef` is written by the touch drag and read
 * here, so a pose never overwrites a card under the finger.
 */
export type CardLive = {
  navRef: MutableRefObject<NavState>;
  hotRef: MutableRefObject<HotState>;
  dispatchRef: MutableRefObject<(input: NavInput) => void>;
  draggingRef: MutableRefObject<boolean>;
};

export function measure(el: HTMLElement, side: Side, mode: Mode, hot: boolean): Pose {
  const rail = el.querySelector<HTMLElement>(".rail");
  return cardPose({
    side,
    mode,
    // the hero's own width: with a classic scrollbar the window is wider than the page by its width
    vw: el.parentElement?.clientWidth || window.innerWidth,
    width: el.offsetWidth,
    rail: rail?.offsetWidth ?? 0,
    hot,
  });
}

export function place(el: HTMLElement, { x, s }: Pose) {
  el.style.transform = `translate3d(${x}px, -50%, 0) scale(${s})`;
  el.style.setProperty("--card-scale", String(s)); // the rail label divides by it to stay at 13 px
}

/**
 * Writes both cards' poses. A card moving into or out of `open` is marked `data-slide` so it takes the panel's 700 ms
 * (cards.css); every other write clears the mark, so the hover nudge keeps the quick ease. `slide = false` is for a
 * drag that ends: the card carries on from the finger's place on the quick ease.
 */
export function placeAll(els: Els, nav: NavState, hot: HotState, slide = true) {
  for (const side of SIDES) {
    const el = els[side];
    const mode = modeOf(nav, side);
    if (slide && slidesBetween(el.dataset.pose as Mode | undefined, mode)) el.dataset.slide = "";
    else delete el.dataset.slide;
    el.dataset.pose = mode;
    place(el, measure(el, side, mode, hot[side] && nav === "hero"));
  }
}

type Options = {
  leftRef: RefObject<HTMLElement>;
  rightRef: RefObject<HTMLElement>;
  nav: NavState;
  hot: HotState;
  setHot: Dispatch<SetStateAction<HotState>>;
  dispatch: (input: NavInput) => void;
};

/**
 * Where the cards sit, and what follows from the navigation state: the transforms written
 * straight to the elements, the hover nudge reset, focus into the open card (and back to its
 * rail unless focus is elsewhere), the page lock while a card is open, and the pose recompute on a resize. No React state
 * changes per frame. Returns the refs the input hook reads.
 */
export function useCardPoses({
  leftRef,
  rightRef,
  nav,
  hot,
  setHot,
  dispatch,
}: Options): CardLive {
  const navRef = useRef(nav);
  const hotRef = useRef(hot);
  const dispatchRef = useRef(dispatch);
  const draggingRef = useRef(false);
  const prevNavRef = useRef(nav);

  // ---- poses: whenever nav or hot changes (a resize is handled below)
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
      }, focusDelay(prefersReducedMotion()));
      return () => window.clearTimeout(id);
    }
    if (prev === "left" || prev === "right") {
      const card = (prev === "right" ? rightRef : leftRef).current;
      // Back to the rail only when focus was in the card (or nowhere, after a click on the scrim):
      // a close that came from the dock's home tab leaves focus on the tab that was pressed.
      const at = document.activeElement;
      if (!at || at === document.body || card?.contains(at)) {
        card?.querySelector<HTMLElement>(".rail")?.focus({ preventScroll: true });
      }
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

  // ---- rotation or a resize: poses depend on the viewport width, so recompute them
  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;
    const els: Els = { left, right };
    const onResize = () => {
      if (!draggingRef.current) placeAll(els, navRef.current, hotRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [leftRef, rightRef]);

  return { navRef, hotRef, dispatchRef, draggingRef };
}
