import type { CSSProperties } from "react";
import type { SiteWork } from "../../types";
import { entriesFor } from "./ring-entries";
import { layoutRings, RING_ORDER, type SubRingSpec } from "./ring-layout";
import type { RingId } from "./ring-math";
import { useStageSize } from "./use-stage-size";
import Staged from "../staged";
import WorkItem from "./work-item";

interface RingsProps {
  work: SiteWork;
  /** False while the page change that brought this page is running: the rings mount after it, one by one. */
  arrived: boolean;
}

const LABEL: Record<RingId, string> = {
  stack: "Editing tools",
  long: "Long form",
  short: "Short form",
};

/**
 * The three rings, inside to outside. Each ring is a `<ul>` that turns by a CSS animation (nothing
 * runs in JavaScript per frame); its items turn back so they stay upright. A ring's sub-ring is a
 * second `<ul>` in the same `.work-ring-group`. Radii and item sizes are CSS variables from ring-math,
 * set when the page is live and again on resize. Items that fit in no ring are left out. Task 8 of
 * round 6 rebuilds these rings.
 */
export default function Rings({ work, arrived }: RingsProps) {
  const size = useStageSize();
  if (!size) return null;

  const entries = entriesFor(work);
  const counts = {
    stack: entries.stack.length,
    long: entries.long.length,
    short: entries.short.length,
  };
  const specs = layoutRings(counts, size.vw, size.vh);
  const groups = new Map<RingId, SubRingSpec[]>();
  for (const spec of specs) groups.set(spec.id, [...(groups.get(spec.id) ?? []), spec]);

  return (
    <div className="work-rings">
      {RING_ORDER.filter((id) => counts[id] > 0).map((id, turn) => {
        const subs = groups.get(id) ?? [];

        return (
          <Staged key={id} arrived={arrived} order={turn}>
            <div
              className="work-ring-group"
              data-ring={id}
              style={{ "--g": RING_ORDER.indexOf(id) } as CSSProperties}
            >
              {subs.map((spec) => (
                <ul
                  // Keyed by layout: when a resize moves items between this ring and its sub-ring, the ring
                  // is made afresh so it and its items start their turn together and items stay upright.
                  key={`${spec.sub}-${spec.slots.length}`}
                  className="work-ring"
                  data-ring={id}
                  data-sub={spec.sub}
                  aria-label={subs.length > 1 && spec.sub > 0 ? `${LABEL[id]}, more` : LABEL[id]}
                  style={
                    {
                      "--r": `${spec.radius.toFixed(2)}px`,
                      "--dur": `${spec.period}s`,
                      "--turn": `${spec.dir * 360}deg`,
                    } as CSSProperties
                  }
                >
                  {spec.slots.map((slot) => (
                    <WorkItem
                      key={entries[id][slot.index].item.id}
                      entry={entries[id][slot.index]}
                      ring={id}
                      place={{ angle: slot.angle, width: spec.width, height: spec.height }}
                    />
                  ))}
                </ul>
              ))}
            </div>
          </Staged>
        );
      })}
    </div>
  );
}
