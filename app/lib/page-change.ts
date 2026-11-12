/**
 * The one owner of page changes. Every move between pages goes through `changePage` (the links use
 * `PageLink`, Back and Forward are caught by `watchHistory`). The router starts the view transition
 * itself once the destination's data is loaded (so the old page stays live during the network round trip
 * and the transition's update step holds only the React commit); this module captures that transition,
 * so it holds the transition's own promises and can tell the rest of the app when the change is over
 * (`usePageSettled`). Heavy work on the arriving page (starting WebGL, decoding the ring pictures,
 * starting the ring motion) waits for that, so it never lands inside the transition.
 *
 * While a change runs, <html> carries `data-change-kind` and the origin as CSS variables
 * (`--change-x`, `--change-y`, `--change-r`, `--change-w`, `--change-ms`) for glass.css and
 * page-transition.css; components/page-change/glass-run.ts draws the glass front on the transition. They are cleared
 * when the transition finishes, is skipped, or fails. Back and Forward (`watchHistory`) live in history-change.ts.
 */
import type { NavigateFunction } from "@remix-run/react";
import { GLASS, glassVars } from "../components/page-change/glass-math";
import { startGlass } from "../components/page-change/glass-run";
import { focusInDock, restoreDockFocus } from "./dock-focus";
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

export type ChangeKind = "radial" | "linear-left" | "linear-right" | "fade";
export interface Point {
  x: number;
  y: number;
}
export interface ChangePlan {
  kind: ChangeKind | "none";
  origin: Point;
  /** Distance from the origin to the farthest corner of the screen. */
  radius: number;
  /** The viewport's width: the travel of a linear sweep. */
  width: number;
  ms: number;
}

/** Spec 5.1: the radial reveal 560 ms, the linear sweep 480 ms, the reduced-motion fade 120 ms. */
const MS: Record<ChangeKind, number> = { radial: GLASS.radialMs, "linear-left": GLASS.linearMs, "linear-right": GLASS.linearMs, fade: 120 };

/** Pure: what a change looks like on this screen. No View Transitions support gives `none` (the page just changes). */
export function planChange(p: {
  supported: boolean;
  reduced: boolean;
  kind?: ChangeKind;
  origin?: Point;
  vw: number;
  vh: number;
}): ChangePlan {
  const origin = p.origin ?? { x: p.vw / 2, y: p.vh / 2 };
  const radius = Math.hypot(Math.max(origin.x, p.vw - origin.x), Math.max(origin.y, p.vh - origin.y));
  const width = p.vw;
  if (!p.supported) return { kind: "none", origin, radius, width, ms: 0 };
  if (p.reduced) return { kind: "fade", origin, radius, width, ms: MS.fade };
  const kind = p.kind ?? "radial";
  return { kind, origin, radius, width, ms: MS[kind] };
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
}
let current: Running | null = null;

/** The end of a pending skip of the router's own transition (history-change.ts sets it); a new change ends it first. */
export const skipHold: { end: (() => void) | null } = { end: null };

function mark(html: HTMLElement, plan: ChangePlan) {
  html.dataset.changeKind = plan.kind;
  html.style.setProperty("--change-x", `${plan.origin.x}px`);
  html.style.setProperty("--change-y", `${plan.origin.y}px`);
  html.style.setProperty("--change-r", `${plan.radius}px`);
  html.style.setProperty("--change-w", `${plan.width}px`);
  html.style.setProperty("--change-ms", `${plan.ms}ms`);
  for (const [name, value] of Object.entries(glassVars())) html.style.setProperty(name, value);
}
function unmark(html: HTMLElement) {
  delete html.dataset.changeKind;
  for (const name of ["--change-x", "--change-y", "--change-r", "--change-w", "--change-ms", ...Object.keys(glassVars())]) html.style.removeProperty(name);
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
  const cleanups: Array<() => void> = [];
  const cleanup = () => cleanups.splice(0).forEach((fn) => fn());
  let failsafe = 0;
  let over = () => {};
  const entry: Running = {
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
export const planNow = (kind?: ChangeKind, origin?: Point) =>
  planChange({
    supported: "startViewTransition" in document,
    reduced: reduced(),
    kind,
    origin,
    vw: window.innerWidth,
    vh: window.innerHeight,
  });

/**
 * Goes to `to` with the page change. The navigation is the router's own, with `viewTransition`: it
 * loads the destination's data while the old page stays live and only then starts the view
 * transition, so rendering is never held for a network round trip. Resolves when the change is over,
 * whatever happened.
 */
export function changePage(
  navigate: NavigateFunction,
  to: string,
  opts: { origin?: Point; kind?: ChangeKind } = {},
): Promise<void> {
  const go = (viewTransition: boolean) => Promise.resolve(navigate(to, { viewTransition }));
  if (typeof document === "undefined") {
    void go(false).catch(() => undefined);
    return Promise.resolve();
  }
  const plan = planNow(opts.kind, opts.origin);
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
