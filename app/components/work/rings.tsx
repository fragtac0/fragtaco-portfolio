import type { CSSProperties } from "react";
import type { SiteWork } from "../../types";
import { entriesFor } from "./ring-entries";
import { layoutRings, RING_ORDER, type SubRingSpec } from "./ring-layout";
import type { RingId } from "./ring-math";
import { useStageSize } from "./use-stage-size";
import { pickedLayout, stackRow, type ViewId } from "./view-layout";
import Staged from "../staged";
import WorkItem from "./work-item";

interface RingsProps {
  work: SiteWork;
  onPickView: (view: ViewId) => void;
  /** False while the page change that brought this page is running: the rings mount after it, one by one. */
  arrived: boolean;
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
 * set when the page is live and again on resize. Every item also carries the place it takes in a
 * picked view (`pickedLayout`, `stackRow`), and the items that fit in no ring (`splitRing`'s hidden
 * ones) wait in a `<ul>` of their own that only a picked view shows. Which layout applies is the
 * page's `data-view` (work-views.css); this component does not know which view is picked.
 */
export default function Rings({ work, onPickView, arrived }: RingsProps) {
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

  const stackBoxes = stackRow(counts.stack, groups.get("stack")?.[0].width ?? 56, size.vw);
  const layouts = {
    long: pickedLayout("long", counts.long, size.vw),
    short: pickedLayout("short", counts.short, size.vw),
    clients: pickedLayout("clients", counts.clients, size.vw),
  };

  return (
    <div className="work-rings">
      {RING_ORDER.filter((id) => counts[id] > 0).map((id, turn) => {
        const subs = groups.get(id) ?? [];
        const layout = id === "stack" ? null : layouts[id];
        const slotted = subs.reduce((n, s) => n + s.slots.length, 0);
        const item = (index: number, spec?: SubRingSpec, angle = 0) => (
          <WorkItem
            key={entries[id][index].item.id}
            entry={entries[id][index]}
            ring={id}
            index={index}
            place={spec ? { angle, width: spec.width, height: spec.height } : undefined}
            box={layout ? layout.boxes[index] : stackBoxes[index]}
            capW={layout?.capW ?? 0}
            onPickView={onPickView}
          />
        );

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
                  {spec.slots.map((slot) => item(slot.index, spec, slot.angle))}
                </ul>
              ))}
              {slotted < counts[id] ? (
                <ul className="work-ring" data-ring={id} data-extra="" aria-label={`${LABEL[id]}, more`}>
                  {entries[id].slice(slotted).map((_, i) => item(slotted + i))}
                </ul>
              ) : null}
              {layout ? (
                <div className="work-view-end" aria-hidden="true" style={{ "--vy": `${layout.height}px` } as CSSProperties} />
              ) : null}
            </div>
          </Staged>
        );
      })}
    </div>
  );
}
