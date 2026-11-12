import type { FocusEvent, PointerEvent } from "react";
import { coverUrl } from "../../content/work-media";
import { labelSide } from "./ring-layout";
import type { RingEntry } from "./ring-entries";
import type { RingId } from "./ring-math";

/** Where an item sits in its ring. */
export interface RingSlotPlace {
  /** Degrees round the ring. */
  angle: number;
  width: number;
  height: number;
}

interface WorkItemProps {
  entry: RingEntry;
  ring: RingId;
  place: RingSlotPlace;
}

// Which side the label opens on is read from where the item is when the pointer or focus arrives.
// The ring is paused by then, so this runs once per hover, not per frame.
function pointLabel(e: PointerEvent<HTMLLIElement> | FocusEvent<HTMLLIElement>) {
  const box = e.currentTarget.getBoundingClientRect();
  e.currentTarget.dataset.side = labelSide(box.left + box.width / 2, window.innerWidth);
}

/**
 * One item. The `li` is placed on its ring from CSS variables (--a, and --r from the ring);
 * `.work-item-turn` turns the other way to the ring so the item stays upright. `.work-item-face` is
 * what is drawn and what grows on hover. Stack marks are plain; videos are links.
 */
export default function WorkItem({ entry, ring, place }: WorkItemProps) {
  const size = Math.round(place.width);
  const tall = Math.round(place.height);

  let face;
  let label: string;
  let id: string;

  if (entry.kind === "stack") {
    label = entry.item.label;
    id = entry.item.id;
    face = (
      <span className="work-item-face work-mark" title={label}>
        <span aria-hidden="true">{entry.item.mark}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  } else {
    const v = entry.item;
    label = v.title;
    id = v.id;
    face = (
      <a
        className="work-item-face work-cover"
        href={v.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${v.title}, for ${v.for}, ${v.year}`}
      >
        <img src={coverUrl(v, entry.tall)} width={size} height={tall} alt="" loading="lazy" decoding="async" />
      </a>
    );
  }

  const vars: Record<`--${string}`, string> = {
    "--a": `${place.angle.toFixed(3)}deg`,
    "--w": `${size}px`,
    "--h": `${tall}px`,
  };

  return (
    <li
      className="work-item"
      data-id={id}
      data-kind={entry.kind}
      data-ring={ring}
      data-side="right"
      onPointerEnter={pointLabel}
      onFocus={pointLabel}
      style={vars}
    >
      <div className="work-item-turn">
        {face}
        <span className="work-label" aria-hidden="true">
          {label}
        </span>
      </div>
    </li>
  );
}
