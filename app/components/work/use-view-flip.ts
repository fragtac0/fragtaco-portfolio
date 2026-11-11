import { useEffect, type RefObject } from "react";
import { planFlip, REDUCED_MS, type FlipFade } from "./flip-plan";
import type { ViewId } from "./view-layout";

/** Marks the animations this file starts, so a newer change can finish them first. */
const FLIP_ID = "work-flip";
/** The other rings scale out (and back) over this long. */
const RINGS_MS = 350;
/** The arrival animation is over by this long after the page is live. */
const ARRIVAL_MS = 900;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface FlipOptions {
  reduced?: boolean;
  /** Which elements fade in or out instead of travelling (they have no place to travel from or to). */
  fade?: (el: HTMLElement) => FlipFade | undefined;
  /** The stagger position of an element (default: its position in the list). */
  order?: (el: HTMLElement, index: number) => number;
}

/**
 * FLIP: records where each element is, runs `change` (which must change the DOM at once, not later),
 * records where each is now, then plays each element from its old place to its new one with the Web
 * Animations API, on `translate` and `scale` only (they are transform properties and stay on the
 * compositor). Reduced motion swaps the travel for a 150 ms opacity crossfade. The promise settles
 * when every animation has ended or been cancelled. Nothing here runs per frame in JavaScript.
 */
export function flip(elements: HTMLElement[], change: () => void, opts: FlipOptions = {}): Promise<void> {
  const reduced = opts.reduced ?? prefersReducedMotion();
  const before = elements.map((el) => el.getBoundingClientRect());
  change();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const running: Animation[] = [];

  elements.forEach((el, i) => {
    if (typeof el.animate !== "function") return;
    const plan = planFlip(before[i], el.getBoundingClientRect(), {
      index: opts.order ? opts.order(el, i) : i,
      reduced,
      vw,
      vh,
      fade: opts.fade?.(el),
    });
    if (!plan) return;
    const anim = el.animate(plan.keyframes, {
      duration: plan.duration,
      delay: plan.delay,
      easing: plan.easing,
      fill: "backwards", // waits at its starting look through the stagger delay
    });
    anim.id = FLIP_ID;
    running.push(anim);
  });

  return Promise.allSettled(running.map((a) => a.finished)).then(() => undefined);
}

/** The rings that are not picked scale out and fade past the screen's edge, or come back. */
function moveRings(rings: HTMLElement[], entering: boolean, reduced: boolean) {
  for (const ring of rings) {
    if (typeof ring.animate !== "function") continue;
    const away: Keyframe = reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6 };
    const here: Keyframe = reduced ? { opacity: 1 } : { opacity: 1, scale: 1 };
    const anim = ring.animate(entering ? [here, away] : [away, here], {
      duration: reduced ? REDUCED_MS : RINGS_MS,
      easing: entering ? "ease-in" : "ease-out",
    });
    anim.id = FLIP_ID;
  }
}

function finishRunning(root: HTMLElement) {
  for (const a of root.getAnimations({ subtree: true })) if (a.id === FLIP_ID) a.finish();
}

/**
 * One change of view, between "all" and a picked view (see `changeView` for a change between two
 * picked views). Sets `data-view` on the page, which CSS turns into the flat layout (or back to the
 * rings), and flips the stack and the picked kind's items between their two layouts.
 */
function toggleView(root: HTMLElement, to: ViewId): Promise<void> {
  const entering = to !== "all";
  const picked = entering ? to : (root.dataset.view as ViewId);
  const reduced = prefersReducedMotion();
  const items = [...root.querySelectorAll<HTMLElement>(`.work-item[data-ring="${picked}"], .work-item[data-ring="stack"]`)];
  const turns = items.flatMap((li) => {
    const turn = li.querySelector<HTMLElement>(".work-item-turn");
    return turn ? [turn] : [];
  });
  const others = [...root.querySelectorAll<HTMLElement>(".work-ring-group")].filter(
    (g) => g.dataset.ring !== picked && g.dataset.ring !== "stack",
  );
  // Staggers count within the picked kind (its first item does not wait) and within the stack, each from 0.
  const orders = new Map<HTMLElement, number>();
  const seen = { stack: 0, picked: 0 };
  for (const turn of turns) {
    const isStack = turn.closest<HTMLElement>(".work-item")?.dataset.ring === "stack";
    orders.set(turn, isStack ? seen.stack++ : seen.picked++);
  }

  return flip(
    turns,
    () => {
      root.dataset.arrived = "";
      root.dataset.view = to;
      moveRings(others, entering, reduced);
    },
    {
      reduced,
      fade: (el) => (el.closest<HTMLElement>(".work-item")?.dataset.extra === undefined ? undefined : entering ? "in" : "out"),
      order: (el, i) => orders.get(el) ?? i,
    },
  );
}

/** Between two picked views, the first goes back into its ring and then the second comes out. */
async function changeView(root: HTMLElement, to: ViewId, stillWanted: () => boolean): Promise<void> {
  const from = root.dataset.view as ViewId;
  if (from === to) return;
  if (from !== "all" && to !== "all") {
    await toggleView(root, "all");
    // a newer request (Back, another tab) came in while the first view went away: do not bring `to` out
    if (!stillWanted()) return;
  }
  await toggleView(root, to);
}

/**
 * Keeps the page's `data-view` in step with the view the address names (`view`), playing the travel
 * when it changes. `data-view` is set here, by the DOM, and not by React: a change is measured,
 * applied and animated in one go, and React never rewrites it. Its first value is the view the page
 * was loaded with (set by the caller), which does no travel, so `/work?view=clients` opens laid out.
 * A newer request finishes the animations still running, then goes on from there.
 */
export function useViewFlip(rootRef: RefObject<HTMLElement | null>, view: ViewId) {
  // The arrival animation of the rings runs once; after it, CSS no longer applies it, so it does not
  // start over each time the rings come back.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root.dataset.view !== "all") {
      root.dataset.arrived = "";
      return;
    }
    const timer = window.setTimeout(() => {
      root.dataset.arrived = "";
    }, ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, [rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const state = stateFor(root);
    state.latest = view;
    if (state.busy) {
      finishRunning(root);
      return;
    }
    if (root.dataset.view === view) return;
    state.busy = true;
    void (async () => {
      while (root.isConnected && root.dataset.view !== state.latest) {
        const target = state.latest;
        await changeView(root, target, () => state.latest === target);
      }
      state.busy = false;
    })();
  }, [rootRef, view]);
}

interface Pending {
  latest: ViewId;
  busy: boolean;
}
const states = new WeakMap<HTMLElement, Pending>();
function stateFor(root: HTMLElement): Pending {
  let s = states.get(root);
  if (!s) {
    s = { latest: root.dataset.view as ViewId, busy: false };
    states.set(root, s);
  }
  return s;
}
