import type { SiteWork, WorkClient, WorkStackItem, WorkVideo } from "../../types";
import type { RingId } from "./ring-math";

/** What one slot in a ring shows. */
export type RingEntry =
  | { kind: "stack"; item: WorkStackItem }
  | { kind: "video"; item: WorkVideo; tall: boolean }
  | { kind: "client"; item: WorkClient };

/** The work content as each ring's list of entries, in file order (tall covers for short form). */
export function entriesFor(work: SiteWork): Record<RingId, RingEntry[]> {
  return {
    stack: work.stack.map((item) => ({ kind: "stack", item })),
    long: work.longForm.map((item) => ({ kind: "video", item, tall: false })),
    short: work.shortForm.map((item) => ({ kind: "video", item, tall: true })),
    clients: work.clients.map((item) => ({ kind: "client", item })),
  };
}
