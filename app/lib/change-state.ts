/**
 * The shared state under page-change.ts: whether a change is running (`usePageSettled` reads it),
 * the commits the root layout reports, and the capture of the transition the router starts.
 */

// ---- settled: false from the start of a change until it is over

let busy = false;
const listeners = new Set<() => void>();
export function setBusy(next: boolean) {
  if (busy === next) return;
  busy = next;
  listeners.forEach((l) => l());
}
export const subscribeSettled = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const isPageSettled = () => !busy;

// ---- the reveal: where the running change's reveal is, for a page that times its own arrival to it (my experience's entrance, round 7 second look spec 8)

/** "idle": no change; "hold": a change runs and its reveal has not started (the arriving page is being finished behind it); "run": the reveal is on; "over": the change ended. */
export type RevealPhase = "idle" | "hold" | "run" | "over";
export interface Reveal {
  phase: RevealPhase;
  /** `performance.now()` when the reveal started (the hold ended and the glass began); null before it. */
  at: number | null;
  /** The reveal's length in ms (2250, or the reduced-motion fade's 120). */
  ms: number;
  /** The change was ended early (a press, Back, a newer link) or never revealed: a page that was waiting for the reveal should show itself at once. */
  skipped: boolean;
}

const IDLE: Reveal = { phase: "idle", at: null, ms: 0, skipped: false };
let reveal: Reveal = IDLE;
const revealListeners = new Set<() => void>();
const setReveal = (next: Reveal) => {
  reveal = next;
  [...revealListeners].forEach((l) => l());
};
export const getReveal = (): Reveal => reveal;
export const subscribeReveal = (listener: () => void) => {
  revealListeners.add(listener);
  return () => void revealListeners.delete(listener);
};
/** A change opens (page-change.ts `open`): its reveal waits for the arriving page. */
export const beginReveal = (ms: number) => setReveal({ phase: "hold", at: null, ms, skipped: false });
/** The hold is over and the glass starts. */
export const startReveal = (at: number) => {
  if (reveal.phase === "hold") setReveal({ ...reveal, phase: "run", at });
};
/** The change is being cut short (a press, Back, a newer change): the reveal does not run its length. */
export const skipReveal = () => {
  if (reveal.phase === "hold" || reveal.phase === "run") reveal = { ...reveal, skipped: true };
};
/** The change is over. A reveal that ran less than nine tenths of its length, or never started, was cut short. */
export const endReveal = (now: number) => {
  if (reveal.phase === "idle" || reveal.phase === "over") return;

  const cut = reveal.skipped || reveal.at === null || now - reveal.at < reveal.ms * 0.9;

  setReveal({ ...reveal, phase: "over", skipped: cut });
};

// ---- commits: the router tells us when the new page is in the DOM

/** Longest a Back or Forward transition waits for the new page to commit, so it cannot hang. */
const COMMIT_TIMEOUT_MS = 4000;

let commitSeq = 0;
let committedPath: string | null = null;
const commitListeners = new Set<() => void>();

/** Called by the root layout in a layout effect each time the location changes: the new page is committed. */
export function pageCommitted(pathname: string) {
  commitSeq++;
  committedPath = pathname;
  for (const listener of [...commitListeners]) listener();
}
export const commitCount = () => commitSeq;
export const committedPathname = () => committedPath;

export function onCommit(listener: () => void): () => void {
  commitListeners.add(listener);
  return () => void commitListeners.delete(listener);
}

/** Resolves on the next commit (or after the timeout). `onWake` hands back a function that resolves it early. */
export function nextCommit(onWake: (wake: () => void) => void): Promise<void> {
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

// ---- capture

export type ViewTransitionLike = ReturnType<Document["startViewTransition"]>;

/**
 * Lets the next `document.startViewTransition` call through and hands its transition to `onCaptured`.
 * The router makes that call itself, once the destination's loaders are done, so the old page stays
 * live while data loads and the transition's update step holds only the React commit. Returns the
 * function that puts things back (also done by the first call).
 */
export function captureNextTransition(onCaptured: (t: ViewTransitionLike) => void): () => void {
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
