/**
 * The one owner of page changes. Every move between pages goes through `changePage` (the links use
 * `PageLink`, Back and Forward are caught by `watchHistory`), which calls `document.startViewTransition`
 * itself, so it holds the transition's own promises and can tell the rest of the app when the change
 * is over (`usePageSettled`). Heavy work on the arriving page (starting WebGL, decoding the ring
 * pictures, starting the ring motion) waits for that, so it never lands inside the transition.
 *
 * While a change runs, <html> carries `data-change-kind` and the origin as CSS variables
 * (`--change-x`, `--change-y`, `--change-r`, `--change-ms`) for page-transition.css. They are cleared
 * when the transition finishes, is skipped, or fails.
 */
import type { NavigateFunction } from "@remix-run/react";
import { flushSync } from "react-dom";

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
  ms: number;
}

/** Spec 5.1: the radial reveal 560 ms, the linear sweep 480 ms, the reduced-motion fade 120 ms. */
const MS: Record<ChangeKind, number> = { radial: 560, "linear-left": 480, "linear-right": 480, fade: 120 };

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
  if (!p.supported) return { kind: "none", origin, radius, ms: 0 };
  if (p.reduced) return { kind: "fade", origin, radius, ms: MS.fade };
  const kind = p.kind ?? "radial";
  return { kind, origin, radius, ms: MS[kind] };
}

// ---- settled: false from the start of a change until it is over

let busy = false;
const listeners = new Set<() => void>();
function setBusy(next: boolean) {
  if (busy === next) return;
  busy = next;
  listeners.forEach((l) => l());
}
export const subscribeSettled = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const isPageSettled = () => !busy;

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
  if (busy) off = subscribeSettled(() => busy || start());
  else start();
  return () => {
    off();
    window.clearTimeout(timer);
  };
}

// ---- commits: the router tells us when the new page is in the DOM

/** Longest the transition waits for the new page to commit (a slow or failed load), so it cannot hang. */
const COMMIT_TIMEOUT_MS = 4000;
/** Longest a change may keep the page unsettled, whatever the browser does with its promises. */
const FAILSAFE_MS = 8000;

let commitSeq = 0;
let committedPath: string | null = null;
const waiters = new Set<() => void>();

/** Called by the root layout in a layout effect each time the location changes: the new page is committed. */
export function pageCommitted(pathname: string) {
  commitSeq++;
  committedPath = pathname;
  for (const wake of [...waiters]) wake();
}

/** Resolves on the next commit (or after the timeout). `onWake` hands back a function that resolves it early. */
function nextCommit(onWake: (wake: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    let timer = 0;
    const wake = () => {
      window.clearTimeout(timer);
      waiters.delete(wake);
      resolve();
    };
    timer = window.setTimeout(wake, COMMIT_TIMEOUT_MS);
    waiters.add(wake);
    onWake(wake);
  });
}

// ---- the change itself

interface Running {
  /** Skips the transition and frees its wait; the change then ends as soon as the browser says so. */
  stop(): void;
}
let current: Running | null = null;

function mark(html: HTMLElement, plan: ChangePlan) {
  html.dataset.changeKind = plan.kind;
  html.style.setProperty("--change-x", `${plan.origin.x}px`);
  html.style.setProperty("--change-y", `${plan.origin.y}px`);
  html.style.setProperty("--change-r", `${plan.radius}px`);
  html.style.setProperty("--change-ms", `${plan.ms}ms`);
}
function unmark(html: HTMLElement) {
  delete html.dataset.changeKind;
  for (const name of ["--change-x", "--change-y", "--change-r", "--change-ms"]) html.style.removeProperty(name);
}

/**
 * Runs `begin` (which starts the navigation; null when the router already is) inside a view
 * transition whose update step lasts until the new page is committed. The promise resolves when the
 * change is over, whatever happened: finished, skipped by a newer change, or failed.
 */
function run(plan: ChangePlan, begin: (() => void) | null): Promise<void> {
  current?.stop();
  const html = document.documentElement;
  const seq = commitSeq;
  let wake: () => void = () => {};
  let transition: ReturnType<Document["startViewTransition"]> | null = null;
  let failsafe = 0;
  let over: () => void = () => {};
  const entry: Running = {
    stop() {
      wake();
      try {
        transition?.skipTransition();
      } catch {
        /* already over */
      }
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
      // a newer change has taken over the marks and the busy state: leave them to it
      if (current === entry) {
        current = null;
        unmark(html);
        setBusy(false);
      }
      resolve();
    };
  });
  failsafe = window.setTimeout(over, FAILSAFE_MS);

  const update = async () => {
    try {
      // the router may have committed already (Back and Forward start before the browser takes its picture)
      const committed = commitSeq !== seq ? Promise.resolve() : nextCommit((w) => (wake = w));
      if (begin) flushSync(begin);
      await committed;
    } catch (err) {
      console.error("page change: could not start the navigation", err);
    }
  };

  try {
    const started = document.startViewTransition(update);
    transition = started;
    started.ready.catch(() => undefined);
    started.updateCallbackDone.catch(() => undefined);
    started.finished.then(over, over);
  } catch {
    void update().then(over, over);
  }
  return done;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const planNow = (kind?: ChangeKind, origin?: Point) =>
  planChange({
    supported: "startViewTransition" in document,
    reduced: reduced(),
    kind,
    origin,
    vw: window.innerWidth,
    vh: window.innerHeight,
  });

/** Goes to `to` with the page change. Resolves when the change is over, whatever happened. */
export function changePage(
  navigate: NavigateFunction,
  to: string,
  opts: { origin?: Point; kind?: ChangeKind } = {},
): Promise<void> {
  const go = () => void Promise.resolve(navigate(to)).catch(() => undefined);
  if (typeof document === "undefined") {
    go();
    return Promise.resolve();
  }
  const plan = planNow(opts.kind, opts.origin);
  if (plan.kind === "none") {
    current?.stop();
    go();
    return Promise.resolve();
  }
  return run(plan, go);
}

/**
 * Back and Forward: the router handles the navigation itself, this only wraps it in the change (a
 * radial reveal from the centre of the screen). A move inside one page (the work view, a hash) is
 * left to that page. Returns the function that stops watching.
 */
export function watchHistory(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onPop = () => {
    if (window.location.pathname === committedPath) return;
    const plan = planNow("radial");
    if (plan.kind === "none") return;
    void run(plan, null);
  };
  // capture: ahead of the router's own listener, so the browser's picture of the old page comes first
  window.addEventListener("popstate", onPop, { capture: true });
  return () => window.removeEventListener("popstate", onPop, { capture: true });
}
