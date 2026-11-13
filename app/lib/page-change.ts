/**
 * The one owner of page changes. Every move between pages goes through `changePage` (the links use
 * `PageLink`, Back and Forward are caught by `watchHistory`). The router starts the view transition
 * itself once the destination's data is loaded (so the old page stays live during the network round trip
 * and the transition's update step holds only the React commit); this module captures that transition,
 * so it holds the transition's own promises and can tell the rest of the app when the change is over
 * (`usePageSettled`). Heavy work on the arriving page (starting WebGL, decoding the ring pictures,
 * starting the ring motion) waits for that, so it never lands inside the transition.
 *
 * Every change is the same reveal (round 7 spec 4): radial from the centre of the screen, 3.5 s, whatever the two pages
 * are and whatever was clicked. While it runs the browser shows pictures of the two pages and nothing under them can be
 * used, so the first press or key press during one finishes it (`finishChange`, wired by change-finish.ts).
 *
 * While a change runs, <html> carries `data-change-kind` and the origin as CSS variables
 * (`--change-x`, `--change-y`, `--change-r`, `--change-ms`) for glass.css and
 * page-transition.css; components/page-change/glass-run.ts draws the glass front on the transition. They are cleared
 * when the transition finishes, is skipped, or fails. Back and Forward (`watchHistory`) live in history-change.ts.
 */
import type { NavigateFunction } from "@remix-run/react";
import { GLASS, glassVars } from "../components/page-change/glass-math";
import { startGlass } from "../components/page-change/glass-run";
import { focusAfterFinish, focusInDock, restoreDockFocus } from "./dock-focus";
import {
  captureNextTransition,
  commitCount,
  isPageSettled,
  nextCommit,
  onCommit,
  setBusy,
  subscribeSettled,
  type ViewTransitionLike,
} from "./change-state";

export { isPageSettled, pageCommitted, subscribeSettled } from "./change-state";

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
}

/** The two lengths: the radial reveal (spec 4, 3500 ms) and the reduced-motion fade (120 ms). */
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
 * 3500 ms, or the 120 ms fade under reduced motion. No View Transitions support gives `none` (the page just changes).
 */
export function planChange(from: string, to: string, env: ChangeEnv): ChangePlan {
  void from;
  void to;
  const origin = { x: env.vw / 2, y: env.vh / 2 };
  const radius = Math.hypot(origin.x, origin.y);
  if (!env.supported) return { kind: "none", origin, radius, ms: 0 };
  const kind: ChangeKind = env.reduced ? "fade" : "radial";
  return { kind, origin, radius, ms: MS[kind] };
}

/**
 * Runs `fn` `quietMs` after the page is settled (that long after the change is over; at once plus the wait
 * when nothing is changing). For work that has no use during the arrival, such as warming a scene that is
 * below the fold. Returns the function that cancels it.
 */
export function afterSettled(quietMs: number, fn: () => void): () => void {
  let timer = 0;
  let off = () => {};
  const start = () => {
    off();
    timer = window.setTimeout(fn, quietMs);
  };
  if (!isPageSettled()) off = subscribeSettled(() => isPageSettled() && start());
  else start();
  return () => {
    off();
    window.clearTimeout(timer);
  };
}

/** Longest a change may keep the page unsettled, whatever the browser or the network does. A data wait
 * longer than this ends the change (marks cleared, page settled) before the router starts its transition;
 * that transition then runs unmarked, which is harmless. */
export const FAILSAFE_MS = 30000;

// ---- the change itself

interface Running {
  /** Skips the transition and frees what it waits for; its promise then resolves. */
  stop(): void;
  /** Skips the transition to its end (the new page is live); the change ends the usual way, when the transition has finished. */
  finish(): void;
  /** True once the browser is showing the two pictures (the transition exists): from then on nothing can be clicked. False again once `finish` has run, so a finish happens once. */
  showing(): boolean;
  /** Resolves when the change is over. */
  done: Promise<void>;
}
let current: Running | null = null;

/** The end of a pending skip of the router's own transition (history-change.ts sets it); a new change ends it first. */
export const skipHold: { end: (() => void) | null } = { end: null };

function mark(html: HTMLElement, plan: ChangePlan) {
  html.dataset.changeKind = plan.kind;
  html.style.setProperty("--change-x", `${plan.origin.x}px`);
  html.style.setProperty("--change-y", `${plan.origin.y}px`);
  html.style.setProperty("--change-r", `${plan.radius}px`);
  html.style.setProperty("--change-ms", `${plan.ms}ms`);
  for (const [name, value] of Object.entries(glassVars())) html.style.setProperty(name, value);
}
function unmark(html: HTMLElement) {
  delete html.dataset.changeKind;
  for (const name of ["--change-x", "--change-y", "--change-r", "--change-ms", ...Object.keys(glassVars())]) html.style.removeProperty(name);
}

/**
 * The state of one change: the marks on <html>, the busy state, the failsafe and the promise. A newer
 * change takes over the marks and the busy state; the older one only resolves its promise.
 */
export function open(plan: ChangePlan) {
  skipHold.end?.(); // a pending skip must not take this change's transition
  const prev = current;
  current = null;
  prev?.stop();
  const html = document.documentElement;
  let transition: ViewTransitionLike | null = null;
  let finishing = false;
  const cleanups: Array<() => void> = [];
  const cleanup = () => cleanups.splice(0).forEach((fn) => fn());
  let failsafe = 0;
  let over = () => {};
  const done = new Promise<void>((resolve) => {
    let ended = false;
    over = () => {
      if (ended) return;
      ended = true;
      window.clearTimeout(failsafe);
      cleanup();
      if (current === entry) {
        current = null;
        unmark(html);
        setBusy(false);
      }
      resolve();
    };
  });
  const entry: Running = {
    done,
    finish() {
      finishing = true;
      try {
        transition?.skipTransition();
      } catch {
        /* already over */
      }
    },
    showing: () => transition !== null && !finishing,
    stop() {
      cleanup();
      try {
        transition?.skipTransition();
      } catch {
        /* already over */
      }
      over(); // a newer change owns the marks by now (see `current`): this only resolves the promise
    },
  };
  current = entry;
  mark(html, plan);
  setBusy(true);
  failsafe = window.setTimeout(over, FAILSAFE_MS);
  return {
    done,
    over,
    hasTransition: () => transition !== null,
    onCleanup: (fn: () => void) => void cleanups.push(fn),
    /** Follows a view transition: the change is over when it finishes, whatever way. */
    adopt(t: ViewTransitionLike) {
      transition = t;
      t.ready.catch(() => undefined);
      t.updateCallbackDone.catch(() => undefined);
      t.finished.then(over, over);
      cleanups.push(startGlass(t, plan)); // the glass front, from the transition's `ready`; stopped with the change
    },
  };
}
export type Change = ReturnType<typeof open>;

/**
 * The router will make the view transition itself (once the destination's loaders are done, with the
 * old page live): take it when it does. A commit with no transition (a redirect, the same place, a
 * failed load) ends the change.
 */
export function captureRouterTransition(c: Change) {
  const restore = captureNextTransition((t) => c.adopt(t));
  const offCommit = onCommit(() => {
    if (!c.hasTransition()) c.over();
  });
  c.onCleanup(() => {
    restore();
    offCommit();
  });
}

/** The router will not make a transition: make one whose update step holds until the new page is committed. */
export function startOwnTransition(c: Change) {
  const seq = commitCount();
  let wake = () => {};
  const update = async () => {
    // the router may have committed already (before the browser took its picture)
    if (commitCount() !== seq) return;
    await nextCommit((w) => (wake = w));
  };
  c.onCleanup(() => wake());
  try {
    c.adopt(document.startViewTransition(update));
  } catch {
    void update().then(c.over, c.over);
  }
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
 * transition at all, and when nothing is changing. For work that is only worth its cost under the 3.5 s reveal.
 */
export const isRadialChange = () => typeof document !== "undefined" && document.documentElement.dataset.changeKind === "radial";

/** True while the browser is showing the two pictures of a change (nothing under them can be used, so a press finishes it). */
export const isChangeShowing = () => current?.showing() ?? false;

/** True while a change runs, whether it is showing its pictures or still waiting for the data (the old page is live then). */
export const isChangeRunning = () => current !== null;

/**
 * Ends the running change at once, with nothing left behind (marks off, busy off, the transition skipped to its end),
 * and returns whether there was one. Back and Forward use it (R59): they land on the history target with no second reveal.
 */
export function endChange(): boolean {
  const c = current;
  if (!c) return false;
  c.stop();
  return true;
}

/**
 * Finishes the running change at once: its view transition is skipped to the end, so the new page is live and the
 * change ends the usual way (marks off, page settled). Does nothing when no change is showing its pictures yet (the old
 * page is still live while the data loads). Once the change is over, focus is put somewhere sensible on the new page
 * (`focusAfterFinish`) unless the new page has put it somewhere on purpose.
 */
export function finishChange(): void {
  const c = current;
  if (!c?.showing()) return;
  c.finish();
  void c.done.then(() => {
    if (current === null) focusAfterFinish();
  });
}

/**
 * Goes to `to` with the page change. The navigation is the router's own, with `viewTransition`: it
 * loads the destination's data while the old page stays live and only then starts the view
 * transition, so rendering is never held for a network round trip. Resolves when the change is over,
 * whatever happened.
 */
export function changePage(navigate: NavigateFunction, to: string): Promise<void> {
  const go = (viewTransition: boolean) => Promise.resolve(navigate(to, { viewTransition }));
  if (typeof document === "undefined") {
    void go(false).catch(() => undefined);
    return Promise.resolve();
  }
  const plan = planNow(window.location.pathname, to);
  if (plan.kind === "none") {
    current?.stop();
    void go(false).catch(() => undefined);
    return Promise.resolve();
  }
  const fromDock = focusInDock(); // a keyboard user who picked a dock tab keeps their place (dock-focus.ts)
  const c = open(plan);
  captureRouterTransition(c);
  try {
    // a navigation that fails ends the change now, not at the failsafe
    go(true).catch(() => c.over());
  } catch (err) {
    console.error("page change: could not start the navigation", err);
    c.over();
  }
  return fromDock
    ? c.done.then(() => {
        if (isPageSettled()) restoreDockFocus(); // not when a newer change has taken over
      })
    : c.done;
}
