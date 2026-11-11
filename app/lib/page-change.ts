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
 * (`--change-x`, `--change-y`, `--change-r`, `--change-ms`) for page-transition.css. They are cleared
 * when the transition finishes, is skipped, or fails.
 */
import type { NavigateFunction } from "@remix-run/react";

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

/** Longest a Back or Forward transition waits for the new page to commit, so it cannot hang. */
const COMMIT_TIMEOUT_MS = 4000;
/** Longest a change may keep the page unsettled, whatever the browser or the network does. */
const FAILSAFE_MS = 8000;

type ViewTransitionLike = ReturnType<Document["startViewTransition"]>;

let commitSeq = 0;
let committedPath: string | null = null;
const commitListeners = new Set<() => void>();

/** Called by the root layout in a layout effect each time the location changes: the new page is committed. */
export function pageCommitted(pathname: string) {
  commitSeq++;
  committedPath = pathname;
  for (const listener of [...commitListeners]) listener();
}

function onCommit(listener: () => void): () => void {
  commitListeners.add(listener);
  return () => void commitListeners.delete(listener);
}

/** Resolves on the next commit (or after the timeout). `onWake` hands back a function that resolves it early. */
function nextCommit(onWake: (wake: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    let timer = 0;
    let off = () => {};
    const wake = () => {
      window.clearTimeout(timer);
      off();
      resolve();
    };
    timer = window.setTimeout(wake, COMMIT_TIMEOUT_MS);
    off = onCommit(wake);
    onWake(wake);
  });
}

// ---- the change itself

interface Running {
  /** Skips the transition and frees what it waits for; its promise then resolves. */
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
 * The state of one change: the marks on <html>, the busy state, the failsafe and the promise. A newer
 * change takes over the marks and the busy state; the older one only resolves its promise.
 */
function open(plan: ChangePlan) {
  const prev = current;
  current = null;
  prev?.stop();
  const html = document.documentElement;
  let transition: ViewTransitionLike | null = null;
  let cleanup = () => {};
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
    onCleanup: (fn: () => void) => void (cleanup = fn),
    /** Follows a view transition: the change is over when it finishes, whatever way. */
    adopt(t: ViewTransitionLike) {
      transition = t;
      t.ready.catch(() => undefined);
      t.updateCallbackDone.catch(() => undefined);
      t.finished.then(over, over);
    },
  };
}

/**
 * Lets the next `document.startViewTransition` call through and hands its transition to `onCaptured`.
 * The router makes that call itself, once the destination's loaders are done, so the old page stays
 * live while data loads and the transition's update step holds only the React commit. Returns the
 * function that puts things back (also done by the first call).
 */
function captureNextTransition(onCaptured: (t: ViewTransitionLike) => void): () => void {
  const doc = document;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- called back with `doc` as `this`
  const original = doc.startViewTransition;
  const hadOwn = Object.prototype.hasOwnProperty.call(doc, "startViewTransition");
  const wrapped = ((...args: Parameters<Document["startViewTransition"]>) => {
    restore();
    const t = original.apply(doc, args);
    onCaptured(t);
    return t;
  }) as Document["startViewTransition"];
  function restore() {
    if (doc.startViewTransition !== wrapped) return;
    if (hadOwn) doc.startViewTransition = original;
    else delete (doc as { startViewTransition?: unknown }).startViewTransition;
  }
  doc.startViewTransition = wrapped;
  return restore;
}

/** A click: the router does the navigation with `viewTransition` and starts the transition when it commits. */
function runRouted(plan: ChangePlan, go: () => void): Promise<void> {
  const c = open(plan);
  const restore = captureNextTransition((t) => c.adopt(t));
  // a commit with no transition (a redirect, the same place, a failed load) ends the change
  const offCommit = onCommit(() => {
    if (!c.hasTransition()) c.over();
  });
  c.onCleanup(() => {
    restore();
    offCommit();
  });
  try {
    go();
  } catch (err) {
    console.error("page change: could not start the navigation", err);
    c.over();
  }
  return c.done;
}

/** Back and Forward, once the router has its data: the update step holds until the new page is committed. */
function runUpdate(plan: ChangePlan): Promise<void> {
  const c = open(plan);
  const seq = commitSeq;
  let wake = () => {};
  const update = async () => {
    // the router may have committed already (before the browser took its picture)
    if (commitSeq !== seq) return;
    await nextCommit((w) => (wake = w));
  };
  c.onCleanup(() => wake());
  try {
    c.adopt(document.startViewTransition(update));
  } catch {
    void update().then(c.over, c.over);
  }
  return c.done;
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
  const go = (viewTransition: boolean) =>
    void Promise.resolve(navigate(to, { viewTransition })).catch(() => undefined);
  if (typeof document === "undefined") {
    go(false);
    return Promise.resolve();
  }
  const plan = planNow(opts.kind, opts.origin);
  if (plan.kind === "none") {
    current?.stop();
    go(false);
    return Promise.resolve();
  }
  return runRouted(plan, () => go(true));
}

/** The slice of Remix's router (`window.__remixRouter`) that Back and Forward use. */
interface RouterLike {
  subscribe(fn: (state: { navigation: { state: string }; location: { pathname: string } }) => void): () => void;
}

/**
 * Back and Forward: the router handles the navigation itself and has no transition option for it, so
 * this waits until the router has the destination's data (a state with no navigation pending, at the
 * new address) and then starts the transition, whose update step holds only the commit: a radial
 * reveal from the centre of the screen. A move inside one page (the work view, a hash) is left to that
 * page. Returns the function that stops watching.
 */
export function watchHistory(): () => void {
  if (typeof window === "undefined") return () => undefined;
  let stopWaiting = () => {};
  const onPop = () => {
    stopWaiting();
    if (window.location.pathname === committedPath) return;
    const plan = planNow("radial");
    if (plan.kind === "none") return;
    const router = (window as { __remixRouter?: RouterLike }).__remixRouter;
    if (!router) {
      void runUpdate(plan);
      return;
    }
    const path = window.location.pathname;
    let timer = 0;
    const off = router.subscribe((state) => {
      if (state.navigation.state !== "idle" || state.location.pathname !== path) return;
      stopWaiting();
      void runUpdate(plan);
    });
    timer = window.setTimeout(() => stopWaiting(), FAILSAFE_MS);
    stopWaiting = () => {
      window.clearTimeout(timer);
      off();
      stopWaiting = () => {};
    };
  };
  // capture: ahead of the router's own listener
  window.addEventListener("popstate", onPop, { capture: true });
  return () => {
    stopWaiting();
    window.removeEventListener("popstate", onPop, { capture: true });
  };
}
