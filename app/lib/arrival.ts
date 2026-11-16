/**
 * What the reveal of a page change waits for (round 7 change-arrival spec 5.1). A page that mounts while a change runs
 * says what it needs before it may be seen (`holdFor`: the sharp painting, the ring pictures, the wall's tiles, the map's
 * picture, the ground's still); page-change.ts keeps the reveal at its first frame, the page being left held still, until all
 * of them have settled or the cap has passed (`whenArrivalReady`), whichever comes first. A part that comes after the cap
 * is late: the page fades it in over `LATE_FADE_MS` (`arrivalLate` says whether the reveal has begun) and moves nothing else.
 * A first load and a deep link have no change, so nothing is recorded and nothing is held.
 *
 * Pure (no DOM, no React): the page's side of it, which is images, is in arrival-dom.ts.
 */

/** The longest the reveal waits for the arriving page after its pictures are up (the radial reveal), in ms. */
export const HOLD_MS = 500;
/** The same under reduced motion, where the change is the 120 ms fade. */
export const HOLD_REDUCED_MS = 300;
/** How long a part that comes after the cap takes to fade in. */
export const LATE_FADE_MS = 200;

export interface Held {
  label: string;
  ready: Promise<unknown>;
}

/**
 * Resolves when every item has settled (a rejected one counts as settled: a picture that failed must not hold the page),
 * or after `capMs` on `sleep`, whichever comes first; `late` is the labels still pending then, in the order they were given.
 */
export async function raceAll(items: Held[], capMs: number, sleep: (ms: number) => Promise<void>): Promise<{ late: string[] }> {
  const pending = new Set(items.keys());
  const settled = items.map((item, i) =>
    Promise.resolve(item.ready).then(
      () => void pending.delete(i),
      () => void pending.delete(i),
    ),
  );
  await Promise.race([Promise.all(settled), sleep(Math.max(0, capMs))]);
  return { late: items.filter((_, i) => pending.has(i)).map((item) => item.label) };
}

/** "idle": no change (nothing is recorded); "holding": a change has begun and the reveal has not; "revealed": it has. */
type Phase = "idle" | "holding" | "revealed";
let phase: Phase = "idle";
let items: Held[] = [];

/** Called when a change begins: forgets the last change's list and starts recording. */
export function resetArrival(): void {
  items = [];
  phase = "holding";
}

/** Called when a change is over (however it ends): nothing is recorded or late until the next one. */
export function endArrival(): void {
  items = [];
  phase = "idle";
}

/**
 * Called by a page that mounts during a change, once per thing the reveal should wait for. Does nothing when no change is
 * waiting for its page (a first load, or after the reveal has begun). Returns whether it was recorded.
 */
export function holdFor(label: string, ready: Promise<unknown>): boolean {
  if (phase !== "holding") return false;
  items.push({ label, ready });
  return true;
}

/** True once the reveal of the running change has begun: a part that settles now is late and fades in over `LATE_FADE_MS`. */
export const arrivalLate = (): boolean => phase === "revealed";

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves when everything given to `holdFor` since the change began has settled, or `capMs` after this call, whichever
 * comes first, with the labels still pending. Things given while it waits are waited for too (inside the same cap). An
 * `abort` (the change ended, or a press finished it) resolves it at once with nothing late. Marks the reveal as begun.
 */
export async function whenArrivalReady(capMs: number, signal?: AbortSignal): Promise<{ late: string[] }> {
  const deadline = performance.now() + capMs;
  const aborted = new Promise<{ late: string[] }>((resolve) => {
    if (!signal) return;
    if (signal.aborted) return resolve({ late: [] });
    signal.addEventListener("abort", () => resolve({ late: [] }), { once: true });
  });
  const wait = async (): Promise<{ late: string[] }> => {
    for (;;) {
      const batch = items.slice();
      const result = await raceAll(batch, deadline - performance.now(), realSleep);
      if (result.late.length > 0 || items.length === batch.length) return result;
    }
  };
  const result = await Promise.race([wait(), aborted]);
  // an aborted wait belongs to a change that is over or replaced: it must not mark the next one's reveal as begun
  if (phase === "holding" && !signal?.aborted) phase = "revealed";
  return result;
}
