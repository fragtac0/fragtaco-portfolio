import type { CSSProperties } from "react";
import type { SiteWork } from "../../types";
import { layoutRings, type SubRingSpec } from "./ring-layout";
import type { RingId } from "./ring-math";
import { useStageSize } from "./use-stage-size";
import WorkItem, { type RingEntry } from "./work-item";
import type { ViewId } from "./view-layout";

interface RingsProps {
  work: SiteWork;
  onPickView: (view: ViewId) => void;
}

function entriesFor(work: SiteWork): Record<RingId, RingEntry[]> {
  return {
    stack: work.stack.map((item) => ({ kind: "stack", item })),
    long: work.longForm.map((item) => ({ kind: "video", item, tall: false })),
    short: work.shortForm.map((item) => ({ kind: "video", item, tall: true })),
    clients: work.clients.map((item) => ({ kind: "client", item })),
  };
}

const LABEL: Record<RingId, string> = {
  stack: "Editing tools",
  long: "Long form",
  short: "Short form",
  clients: "Clients",
};

/**
 * The four rings, inside to outside. Each ring is a `<ul>` that turns by a CSS animation (nothing
 * runs in JavaScript per frame); its items turn back so they stay upright. A ring's sub-ring is a
 * second `<ul>` in the same `.work-ring-group`. Radii and item sizes are CSS variables from ring-math,
 * set when the page is live and again on resize. Items that fit in no ring are left out.
 */
export default function Rings({ work, onPickView }: RingsProps) {
  const size = useStageSize();
  if (!size) return null;

  const entries = entriesFor(work);
  const counts = {
    stack: entries.stack.length,
    long: entries.long.length,
    short: entries.short.length,
    clients: entries.clients.length,
  };
  const specs = layoutRings(counts, size.vw, size.vh);
  const groups = new Map<RingId, SubRingSpec[]>();
  for (const spec of specs) groups.set(spec.id, [...(groups.get(spec.id) ?? []), spec]);

  return (
    <div className="work-rings">
      {[...groups].map(([id, subs]) => (
        <div
          key={id}
          className="work-ring-group"
          data-ring={id}
          style={{ "--g": subs[0].order } as CSSProperties}
        >
          {subs.map((spec) => (
            <ul
              key={spec.sub}
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
                  angle={slot.angle}
                  width={spec.width}
                  height={spec.height}
                  onPickView={onPickView}
                />
              ))}
            </ul>
          ))}
        </div>
      ))}
    </div>
  );
}
