/**
 * What the reveal of a page change waits for (round 7 change-arrival spec 5.1). A page that mounts while a change runs
 * says what it needs before it may be seen (`holdFor`: the sharp painting, the ring pictures, the wall's tiles, the map's
 * picture, the ground's still); page-change.ts keeps the reveal at its first frame, the page being left held still, until all
 * of them have settled or the cap has passed (`whenArrivalReady`), whichever comes first. A part that comes after the cap
 * is late: the page fades it in over `LATE_FADE_MS` and moves nothing else. Lateness belongs to the hold (`holdFor` returns it),
 * not to the change: a part that settles after the change has ended is still late, and still fades.
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

/**
 * What `holdFor` gives back: one held thing. `late` becomes true when the reveal began while it was still pending, and stays
 * true (the change may be over by the time the part comes: it still fades in, it never pops).
 */
export interface Hold {
  readonly label: string;
  readonly late: boolean;
}
interface Entry extends Held {
  hold: { label: string; late: boolean };
  settled: boolean;
}
let items: Entry[] = [];

/** Called when a change begins: forgets the last change's list and starts recording. (A hold the last change gave keeps its own `late`.) */
export function resetArrival(): void {
  items = [];
  phase = "holding";
}

/** Called when a change is over (however it ends): nothing is recorded until the next one. */
export function endArrival(): void {
  items = [];
  phase = "idle";
}

/**
 * Called by a page that mounts during a change, once per thing the reveal should wait for. Returns null when no change is
 * waiting for its page (a first load, or after the reveal has begun); otherwise the hold, whose `late` says whether this thing
 * missed the reveal, whenever it settles.
 */
export function holdFor(label: string, ready: Promise<unknown>): Hold | null {
  if (phase !== "holding") return null;
  const entry: Entry = { label, ready, hold: { label, late: false }, settled: false };
  const done = () => void (entry.settled = true);
  Promise.resolve(ready).then(done, done);
  items.push(entry);
  return entry.hold;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves when everything given to `holdFor` since the change began has settled, or `capMs` after this call, whichever
 * comes first, with the labels still pending. Things given while it waits are waited for too (inside the same cap). An
 * `abort` (the change ended, or a press finished it) resolves it at once with nothing reported late. Marks the reveal as begun,
 * and marks as late every hold still pending (however the wait ended: the reveal is going ahead without it).
 */
export async function whenArrivalReady(capMs: number, signal?: AbortSignal): Promise<{ late: string[] }> {
  const deadline = performance.now() + capMs;
  const mine = items; // a newer change replaces the list; this wait marks only its own
  const aborted = new Promise<{ late: string[] }>((resolve) => {
    if (!signal) return;
    if (signal.aborted) return resolve({ late: [] });
    signal.addEventListener("abort", () => resolve({ late: [] }), { once: true });
  });
  const wait = async (): Promise<{ late: string[] }> => {
    for (;;) {
      const batch = mine.slice();
      const result = await raceAll(batch, deadline - performance.now(), realSleep);
      if (result.late.length > 0 || mine.length === batch.length) return result;
    }
  };
  const result = await Promise.race([wait(), aborted]);
  for (const entry of mine) if (!entry.settled) entry.hold.late = true;
  // an aborted wait belongs to a change that is over or replaced: it must not mark the next one's reveal as begun
  if (phase === "holding" && mine === items && !signal?.aborted) phase = "revealed";
  return result;
}
