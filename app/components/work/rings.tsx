import type { CSSProperties } from "react";
import type { SiteWork } from "../../types";
import { entriesFor } from "./ring-entries";
import { layoutRings } from "./ring-layout";
import { RING_ORDER_MODE, type RingKind } from "./ring-math";
import { useStageSize } from "./use-stage-size";
import Staged from "../staged";
import WorkItem from "./work-item";

interface RingsProps {
  work: SiteWork;
  /** False while the page change that brought this page is running: the rings mount after it, one by one. */
  arrived: boolean;
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
 * resize. Videos that fit in no ring are left out (they are all on the walls).
 */
export default function Rings({ work, arrived }: RingsProps) {
  const size = useStageSize();
  if (!size) return null;

  const entries = entriesFor(work);
  const layout = layoutRings(
    { stack: entries.stack.length, long: entries.long.length, short: entries.short.length },
    size.vw,
    size.vh,
    RING_ORDER_MODE,
  );
  const seen: Record<RingKind, number> = { stack: 0, long: 0, short: 0 };

  return (
    <div className="work-rings">
      {layout.rings.map((ring) => {
        const nth = seen[ring.kind]++;
        return (
          <Staged key={ring.id} arrived={arrived} order={ring.order} step={0}>
            <div className="work-ring-group" data-ring={ring.kind} style={{ "--g": ring.order } as CSSProperties}>
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
                {ring.slots.map((slot) => (
                  <WorkItem
                    key={entries[ring.kind][slot.index].item.id}
                    entry={entries[ring.kind][slot.index]}
                    ring={ring.kind}
                    place={{ angle: slot.angle, width: ring.size.w, height: ring.size.h }}
                  />
                ))}
              </ul>
            </div>
          </Staged>
        );
      })}
    </div>
  );
}
