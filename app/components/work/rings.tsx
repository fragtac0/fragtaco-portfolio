import { useEffect, useLayoutEffect, useRef, type CSSProperties, type FocusEvent } from "react";
import { holdImages, inWindow } from "../../lib/arrival-dom";
import type { SiteWork } from "../../types";
import { bringClearOfDock } from "./focus-clear";
import { entriesFor } from "./ring-entries";
import { layoutRings } from "./ring-layout";
import { RING_ORDER_MODE, type RingKind } from "./ring-math";
import { useStageSize } from "./use-stage-size";
import WorkItem from "./work-item";

// Layout effects warn on the server; the rings are only made on the client, but the module is also read there.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface RingsProps {
  work: SiteWork;
  /**
   * Set when the page was made during a page change (round 7 change-arrival spec 5.1): every item is mounted in the page's first
   * commit with its picture asked for at once (not lazily), and the reveal waits (`holdFor`) for the pictures of the items inside
   * the window to be in and decoded, so the reveal uncovers rings that are finished. Off on a first load, where the server's markup
   * and the hydration agree and the outer rings' pictures load only as they near the screen.
   */
  byChange?: boolean;
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
 * its first commit, all of them (R60 built them in batches during the reveal; since R56 the reveal waits until they are in, `byChange`),
 * and nothing runs per frame.
 */
export default function Rings({ work, byChange = false }: RingsProps) {
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
  // The reveal waits for the pictures the window shows. The rings are planned for the whole screen (R56.4: nothing is cut out round the dock), so the plan is
  // final in the first commit and the pictures are registered there. (The rings stand still until the change is over; the pictures' own fade-in is `fadeLate`,
  // `data-late` in work.css.)
  const root = useRef<HTMLDivElement>(null);
  const holding = useRef(false);
  const made = layout !== null;
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!byChange || !made || holding.current || !el) return;
    holding.current = true;
    holdImages("rings", [...el.querySelectorAll("img")].filter(inWindow));
  }, [byChange, made]);

  // A tile that gets keyboard focus while more than half of it is under the dock is brought clear (its ring is turned on, eased in and out, until it is);
  // a tile that is clear is not moved. A focused ring is held still by work.css. The turn ends when focus leaves, and with the page.
  const clearing = useRef<(() => void) | null>(null);
  const endClearing = () => {
    clearing.current?.();
    clearing.current = null;
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    endClearing();
    const face = e.target;
    if (face instanceof Element && face.matches(".work-item-face:focus-visible")) clearing.current = bringClearOfDock(face);
  };
  useEffect(() => endClearing, []);
  if (!size || !layout) return null;

  const seen: Record<RingKind, number> = { stack: 0, long: 0, short: 0 };

  return (
    <div className="work-rings" ref={root} onFocus={onFocus} onBlur={endClearing}>
      {layout.rings.map((ring) => {
        const nth = seen[ring.kind]++;
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
              {ring.slots.map((slot) => (
                <WorkItem
                  key={entries[ring.kind][slot.index].item.id}
                  entry={entries[ring.kind][slot.index]}
                  ring={ring.kind}
                  place={{ angle: slot.angle, width: ring.size.w, height: ring.size.h }}
                  lazy={!byChange}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
