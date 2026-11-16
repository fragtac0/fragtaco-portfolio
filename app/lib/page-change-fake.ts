// A document with a controllable view transition, for the page change tests (page-change.test.ts, history-change.test.ts, page-change-hold.test.ts).
import type { NavigateFunction } from "@remix-run/react";
import { vi } from "vitest";
import { pageCommitted } from "./page-change";

/** A document with a controllable view transition, enough for changePage. */
export function fakeEnvironment(opts: { supported?: boolean; finishedRejects?: boolean } = {}) {
  const props = new Map<string, string>();
  const html = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (k: string, v: string) => void props.set(k, v),
      removeProperty: (k: string) => void props.delete(k),
    },
  };
  const transitions: { skipped: boolean; finish: () => void; updated: boolean }[] = [];
  // querySelector, activeElement and body are read by dock-focus.ts when a change starts
  const doc: Record<string, unknown> = { documentElement: html, querySelector: () => null, activeElement: null, body: {} };
  if (opts.supported !== false) {
    doc.startViewTransition = (update: () => Promise<void> | void) => {
      let finish = () => {};
      const t = { skipped: false, finish: () => finish(), updated: false };
      const updateDone = Promise.resolve().then(update).then(() => void (t.updated = true));
      const finished = new Promise<void>((resolve, reject) => {
        finish = () => (opts.finishedRejects ? reject(new Error("aborted")) : resolve());
      });
      transitions.push(t);
      return {
        ready: Promise.resolve(),
        updateCallbackDone: updateDone,
        finished,
        skipTransition: () => {
          t.skipped = true;
          finish();
        },
      };
    };
  }
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false }),
    innerWidth: 1440,
    innerHeight: 900,
    location: { pathname: "/" },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  /** What the router does with `viewTransition`: once its data is loaded it starts the transition, whose update commits the page. */
  const router = (path: string) => {
    const calls: unknown[][] = [];
    const navigate = vi.fn((to: unknown, options?: { viewTransition?: boolean }) => {
      calls.push([to, options]);
      return Promise.resolve();
    }) as unknown as NavigateFunction;
    const dataArrives = () => {
      (doc.startViewTransition as (u: () => void) => unknown)(() => pageCommitted(path));
    };
    return { navigate, dataArrives, calls };
  };
  return { html, props, transitions, doc, router };
}

export const tick = () => new Promise<void>((r) => setTimeout(r, 0));
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
