import { useEffect, useState, type CSSProperties } from "react";
import type { SiteWork } from "../../types";
import { entriesFor } from "./ring-entries";
import { layoutRings, mountedIn } from "./ring-layout";
import { RING_ORDER_MODE, type RingKind } from "./ring-math";
import { useStageSize } from "./use-stage-size";
import WorkItem from "./work-item";

/** How a page that comes in through a change builds its rings: this many items at a time, this many ms apart. */
export interface RingBatches {
  items: number;
  ms: number;
}

interface RingsProps {
  work: SiteWork;
  /**
   * Set when the page was made during a page change: its items are mounted in batches (inner ring first), so no single
   * frame of the reveal builds them all. Off (null) on a first load, where everything renders at once and the server's
   * markup and the hydration agree.
   */
  batches?: RingBatches | null;
  /** True once the change is over: whatever is not yet mounted is mounted now, before the rings start to turn. */
  arrived?: boolean;
}

const LABEL: Record<RingKind, string> = {
  stack: "Editing tools",
  long: "Long form",
  short: "Short form",
};

/**
 * The rings, inside to outside: one of editing tools, then up to four of videos (see `ringPlan` in
 * ring-math for where they go and how many fit; they are larger than the screen on purpose). Each ring
 * is a `<ul>` that turns by a CSS animation (nothing runs in JavaScript per frame); its items turn back
 * so they stay upright. Radii and item sizes are CSS variables, set when the page is live and again on
 * resize. Videos that fit in no ring are left out (they are all on the walls). The rings are in the page from
 * its first commit, so a page change's reveal shows them, pictures included (R60): all of them within the first
 * half second of it (`stagger`), well before the reveal's edge reaches the stack ring, and nothing runs per frame.
 */
export default function Rings({ work, batches = null, arrived = true }: RingsProps) {
  const size = useStageSize();
  const entries = entriesFor(work);
  const layout = size
    ? layoutRings(
        { stack: entries.stack.length, long: entries.long.length, short: entries.short.length },
        size.vw,
        size.vh,
        RING_ORDER_MODE,
      )
    : null;
  const total = layout ? layout.rings.reduce((n, ring) => n + ring.slots.length, 0) : 0;
  // Batched: the first batch mounts on the first timer after the commit, each next one `ms` after the one before.
  // `count` is the items mounted so far; everything once the change is over or when not batched.
  const [count, setCount] = useState(batches ? 0 : Infinity);
  const shown = arrived ? Infinity : count;
  useEffect(() => {
    if (!batches || count >= total) return;
    const { items, ms } = batches;
    const timer = window.setTimeout(() => setCount((n) => n + items), count === 0 ? 0 : ms);
    return () => window.clearTimeout(timer);
  }, [count, total, batches]);
  if (!layout) return null;

  const seen: Record<RingKind, number> = { stack: 0, long: 0, short: 0 };
  // where each ring's items begin in the count of all items, inside to outside
  const firsts = layout.rings.map((_, i) => layout.rings.slice(0, i).reduce((n, ring) => n + ring.slots.length, 0));

  return (
    <div className="work-rings">
      {layout.rings.map((ring) => {
        const nth = seen[ring.kind]++;
        const mounted = mountedIn(shown, firsts[ring.order], ring.slots.length);
        if (mounted === 0) return null;
        return (
          <div key={ring.id} className="work-ring-group" data-ring={ring.kind} style={{ "--g": ring.order } as CSSProperties}>
            <ul
              // Keyed by count: when a resize moves items between rings, the ring is made afresh so it
              // and its items start their turn together and items stay upright.
              key={ring.slots.length}
              className="work-ring"
              data-ring={ring.kind}
              data-ring-id={ring.id}
              aria-label={nth > 0 ? `${LABEL[ring.kind]}, more` : LABEL[ring.kind]}
              style={
                {
                  "--r": `${ring.radius.toFixed(2)}px`,
                  "--dur": `${ring.periodS}s`,
                  "--turn": `${ring.dir * 360}deg`,
                } as CSSProperties
              }
            >
              {ring.slots.slice(0, mounted).map((slot) => (
                <WorkItem
                  key={entries[ring.kind][slot.index].item.id}
                  entry={entries[ring.kind][slot.index]}
                  ring={ring.kind}
                  place={{ angle: slot.angle, width: ring.size.w, height: ring.size.h }}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
