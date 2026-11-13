/**
 * Back and Forward. Split out of page-change.ts; it uses the change machinery from there (`open`, the
 * transition captures, `planNow`) and the commit state from change-state.ts.
 */
import { committedPathname, captureNextTransition, onCommit } from "./change-state";
import { FAILSAFE_MS, captureRouterTransition, open, planNow, skipHold, startOwnTransition, type Change } from "./page-change";

/** The slice of Remix's router (`window.__remixRouter`) that Back and Forward use. */
export interface RouterLike {
  subscribe(
    fn: (
      state: { navigation: { state: string }; location: { pathname: string } },
      info?: { viewTransitionOpts?: unknown },
    ) => void,
  ): () => void;
}

/**
 * A move inside one page that the router may still animate (it does so on a POP whenever the page's
 * address was ever changed with a transition): take its transition and skip it, so in-page moves (a
 * layer's hash, the work view) never crossfade the whole page. The wrapper goes after the next commit.
 */
function skipRouterTransition() {
  skipHold.end?.();
  const restore = captureNextTransition((t) => {
    t.ready.catch(() => undefined);
    t.updateCallbackDone.catch(() => undefined);
    t.finished.catch(() => undefined);
    t.skipTransition();
  });
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    if (skipHold.end === end) skipHold.end = null;
    window.clearTimeout(timer);
    offCommit();
    restore();
  };
  skipHold.end = end;
  const timer = window.setTimeout(end, 4000);
  const offCommit = onCommit(end);
}

/**
 * Back and Forward: the change opens at the popstate (marks, busy). Once the router has the
 * destination's data (a state with no navigation pending, at the new address) it either starts the
 * view transition itself, which it does on a POP when the same pair of pages was changed with a
 * transition before (`viewTransitionOpts`; then this takes that transition, the same as for a click),
 * or it does not, and then this starts one whose update step holds only the commit. The same
 * reveal as a click. A move inside one page (the work view, a hash) gets no change, and a
 * transition the router would start for it is skipped. A second popstate that lands back on the
 * committed page ends a change still waiting for data. Returns the function that stops watching.
 */
export function watchHistory(): () => void {
  if (typeof window === "undefined") return () => undefined;
  let stopWaiting = () => {};
  let popChange: Change | null = null;
  /** Calls `ready` with the router's info once it has the data for `path` (idle, at that address). */
  const whenRouterHasData = (router: RouterLike, path: string, ready: (info?: { viewTransitionOpts?: unknown }) => void) => {
    const off = router.subscribe((state, info) => {
      if (state.navigation.state !== "idle" || state.location.pathname !== path) return;
      stopWaiting();
      ready(info);
    });
    const timer = window.setTimeout(() => stopWaiting(), FAILSAFE_MS);
    stopWaiting = () => {
      window.clearTimeout(timer);
      off();
      stopWaiting = () => {};
    };
  };
  const onPop = () => {
    stopWaiting();
    const path = window.location.pathname;
    const router = (window as { __remixRouter?: RouterLike }).__remixRouter;
    if (path === committedPathname()) {
      // back on the page that is shown (an in-page move, or a Back that undoes a Back still loading):
      // a change still waiting for data is over, and the router's own transition, if any, is skipped
      if (popChange && !popChange.hasTransition()) popChange.over();
      popChange = null;
      // The router's own popstate listener has run before this point (it has the new state already, so
      // there is nothing to wait for), and it starts its transition a few effects later: be ready for it.
      if (router && "startViewTransition" in document) skipRouterTransition();
      return;
    }
    const plan = planNow(committedPathname() ?? "", path);
    if (plan.kind === "none") return;
    const c = open(plan);
    popChange = c;
    if (!router) {
      startOwnTransition(c);
      return;
    }
    whenRouterHasData(router, path, (info) => {
      if (info?.viewTransitionOpts) captureRouterTransition(c);
      else startOwnTransition(c);
    });
    // a newer change, or the end of this one, stops the wait
    c.onCleanup(() => stopWaiting());
    // a commit with no transition of any kind ends the change
    c.onCleanup(onCommit(() => !c.hasTransition() && c.over()));
  };
  // capture: ahead of the router's own listener
  window.addEventListener("popstate", onPop, { capture: true });
  return () => {
    stopWaiting();
    window.removeEventListener("popstate", onPop, { capture: true });
  };
}
