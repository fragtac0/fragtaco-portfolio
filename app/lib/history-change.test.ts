import { afterEach, describe, expect, it, vi } from "vitest";
import { watchHistory, type RouterLike } from "./history-change";
import { changePage, isPageSettled, pageCommitted } from "./page-change";
import { fakeEnvironment, sleep, tick } from "./page-change-fake";

describe("watchHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** The environment plus a popstate handler and a router stub that can report its state. */
  function setup() {
    const env = fakeEnvironment();
    const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
    let onPop: () => void = () => {};
    const location = { pathname: "/work" };
    win.location = location;
    win.addEventListener = (_: string, fn: () => void) => void (onPop = fn);
    let subscriber: Parameters<RouterLike["subscribe"]>[0] = () => {};
    win.__remixRouter = {
      subscribe: (fn: typeof subscriber) => {
        subscriber = fn;
        return () => {};
      },
    };
    pageCommitted("/work");
    const stop = watchHistory();
    return {
      ...env,
      stop,
      /** The browser goes Back to `path`. */
      pop(path: string) {
        location.pathname = path;
        onPop();
      },
      /** The router has the data for `path`; `opts` is what it passes when it will start the transition itself. */
      dataArrives(path: string, opts?: unknown, navigation = "idle") {
        subscriber({ navigation: { state: navigation }, location: { pathname: path } }, { viewTransitionOpts: opts });
      },
      routerStartsTransition() {
        // looked up now: the module may have put its capture in front of the document's own
        (env.doc.startViewTransition as (u: () => void) => unknown)(() => pageCommitted("/"));
      },
    };
  }

  it("takes the router's own transition on a POP it will animate, and starts none of its own", async () => {
    const w = setup();
    w.pop("/");
    // opened at the popstate: marked, unsettled, and rendering is not held (no transition yet)
    expect(w.html.dataset.changeKind).toBe("radial");
    expect(isPageSettled()).toBe(false);
    expect(w.transitions).toHaveLength(0);
    w.dataArrives("/", { currentLocation: {}, nextLocation: {} });
    expect(w.transitions).toHaveLength(0); // still none: the router makes it
    w.routerStartsTransition();
    expect(w.transitions).toHaveLength(1);
    await tick();
    // the commit inside the router's transition does not end the change; its finish does
    expect(isPageSettled()).toBe(false);
    expect(w.html.dataset.changeKind).toBe("radial");
    w.transitions[0].finish();
    await tick();
    expect(isPageSettled()).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.stop();
  });

  it("starts its own transition on a POP the router will not animate", async () => {
    const w = setup();
    w.pop("/");
    w.dataArrives("/"); // no viewTransitionOpts
    expect(w.transitions).toHaveLength(1);
    pageCommitted("/");
    await tick();
    w.transitions[0].finish();
    await tick();
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("ignores a state at another address", () => {
    const w = setup();
    w.pop("/work"); // same path as the committed page
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.pop("/");
    w.dataArrives("/work"); // a different address: not this navigation
    expect(w.transitions).toHaveLength(0);
    pageCommitted("/"); // a commit with no transition at all ends the change
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("waits while the router is still loading (a navigation pending)", () => {
    const w = setup();
    w.pop("/");
    w.dataArrives("/", { currentLocation: {} }, "loading");
    expect(w.transitions).toHaveLength(0);
    expect(w.html.dataset.changeKind).toBe("radial");
    w.dataArrives("/", undefined, "idle");
    expect(w.transitions).toHaveLength(1);
    w.transitions[0].finish();
    pageCommitted("/");
    w.stop();
  });

  it("ends the change when a second popstate lands back on the committed page before the data arrives", () => {
    const w = setup();
    w.pop("/"); // Back: opens the change
    expect(isPageSettled()).toBe(false);
    w.pop("/work"); // Forward again, before the router has the data for "/"
    expect(isPageSettled()).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.stop();
  });

  it("R59: a Back while a change shows its pictures ends it at once and runs no second reveal", async () => {
    const w = setup();
    w.pop("/"); // Back to home: the change opens
    w.dataArrives("/", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    await tick();
    expect(w.transitions).toHaveLength(1);
    expect(w.html.dataset.changeKind).toBe("radial");
    w.pop("/experience"); // another Back, while the pictures show
    expect(w.transitions[0].skipped).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    expect(isPageSettled()).toBe(true);
    // the router starts its own transition for this move: it is skipped, never adopted, no marks come back
    w.dataArrives("/experience", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    expect(w.transitions).toHaveLength(2);
    expect(w.transitions[1].skipped).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("R59: a Forward while a click's change is still loading its data ends that change with no second reveal", async () => {
    const w = setup();
    const r = w.router("/timeline");
    void changePage(r.navigate, "/timeline"); // the data has not arrived
    expect(w.html.dataset.changeKind).toBe("radial");
    w.pop("/experience");
    expect(w.html.dataset.changeKind).toBeUndefined();
    expect(isPageSettled()).toBe(true);
    // the router has its data for the history target, with a transition of its own: skipped
    w.dataArrives("/experience", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    expect(w.transitions.at(-1)?.skipped).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    await tick();
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("R59: a click's change that commits its own page a frame after a Back does not end the hold on the router's transition for the Back", async () => {
    const w = setup();
    const r = w.router("/timeline");
    void changePage(r.navigate, "/timeline"); // the change is about to commit /timeline
    w.pop("/experience"); // Back, a frame before that
    pageCommitted("/timeline"); // the click's own page commits after all: the hold must stay
    // the router has its data for the history target, with a transition of its own: still skipped, not run as a crossfade
    w.dataArrives("/experience", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    expect(w.transitions.at(-1)?.skipped).toBe(true);
    expect(w.html.dataset.changeKind).toBeUndefined();
    await tick();
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  it("a popstate with no change running keeps the radial change", () => {
    const w = setup();
    w.pop("/");
    expect(w.html.dataset.changeKind).toBe("radial");
    expect(isPageSettled()).toBe(false);
    w.stop();
  });

  it("takes and skips a transition the router starts for a move inside one page", () => {
    const w = setup();
    const original = w.doc.startViewTransition;
    w.pop("/work"); // same page: a hash or a view
    expect(w.html.dataset.changeKind).toBeUndefined();
    w.routerStartsTransition();
    expect(w.transitions).toHaveLength(1);
    expect(w.transitions[0].skipped).toBe(true);
    expect(w.doc.startViewTransition).toBe(original);
    expect(isPageSettled()).toBe(true);
    w.stop();
  });

  /** A <main> that takes focus, and a document whose focus is on <body>, as it is after the page the focus was on has gone (Task 20 M3). */
  function bodyFocus(w: ReturnType<typeof setup>) {
    class FakeMain {
      hasAttribute() {
        return true;
      }
      setAttribute() {}
      focus() {
        w.doc.activeElement = this;
      }
    }
    vi.stubGlobal("HTMLElement", FakeMain);
    const main = new FakeMain();
    w.doc.activeElement = w.doc.body;
    w.doc.querySelector = (sel: string) => (sel === "main" ? main : null);
    return main;
  }

  it("M3: when the change of a Back is over, focus that fell to <body> goes to the new page's <main>", async () => {
    const w = setup();
    const main = bodyFocus(w);
    w.pop("/");
    w.dataArrives("/", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    await tick();
    expect(w.doc.activeElement).toBe(w.doc.body); // still the change: nothing moved
    w.transitions[0].finish();
    await tick();
    expect(w.doc.activeElement).toBe(main);
    w.stop();
  });

  it("M3: a Back that ends a running change puts focus on <main> once the page it lands on is committed", async () => {
    const w = setup();
    const main = bodyFocus(w);
    w.pop("/");
    w.dataArrives("/", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    await tick();
    w.pop("/experience"); // ends the change; the router's own transition for this move is skipped
    await tick();
    w.doc.activeElement = w.doc.body; // the page that had focus went away with the change
    (w.doc.startViewTransition as (u: () => void) => unknown)(() => pageCommitted("/experience"));
    await sleep(5);
    expect(w.doc.activeElement).toBe(main);
    w.stop();
  });

  it("M3: focus the new page put somewhere on purpose is left alone", async () => {
    const w = setup();
    bodyFocus(w);
    const chosen = {};
    w.pop("/");
    w.dataArrives("/", { currentLocation: {}, nextLocation: {} });
    w.routerStartsTransition();
    await tick();
    w.doc.activeElement = chosen;
    w.transitions[0].finish();
    await tick();
    expect(w.doc.activeElement).toBe(chosen);
    w.stop();
  });
});
