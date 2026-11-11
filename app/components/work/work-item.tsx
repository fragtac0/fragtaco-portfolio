import type { CSSProperties, FocusEvent, PointerEvent, ReactElement } from "react";
import { coverUrl } from "../../content/work-media";
import { labelSide } from "./ring-layout";
import type { RingEntry } from "./ring-entries";
import type { ViewId } from "./view-layout";

interface WorkItemProps {
  entry: RingEntry;
  /** Degrees round its ring. */
  angle: number;
  width: number;
  height: number;
  onPickView: (view: ViewId) => void;
}

// Which side the label opens on is read from where the item is when the pointer or focus arrives.
// The ring is paused by then, so this runs once per hover, not per frame.
function pointLabel(e: PointerEvent<HTMLLIElement> | FocusEvent<HTMLLIElement>) {
  const box = e.currentTarget.getBoundingClientRect();
  e.currentTarget.dataset.side = labelSide(box.left + box.width / 2, window.innerWidth);
}

/**
 * One item in a ring. The `li` is placed on the ring from CSS variables (--a, --r from the ring);
 * `.work-item-turn` turns the other way to the ring so the item stays upright; `.work-item-face` is
 * what is drawn and what grows on hover. Stack marks are plain; videos are links; clients are buttons.
 */
export default function WorkItem({ entry, angle, width, height, onPickView }: WorkItemProps) {
  const size = Math.round(width);
  const tall = Math.round(height);
  let face: ReactElement;
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
  } else if (entry.kind === "video") {
    const v = entry.item;
    label = v.title;
    id = v.id;
    face = (
      <a
        className="work-item-face work-cover"
        href={v.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${v.title}, for ${v.for}, ${v.year}`}
      >
        <img src={coverUrl(v, entry.tall)} width={size} height={tall} alt="" loading="lazy" decoding="async" />
      </a>
    );
  } else {
    const c = entry.item;
    label = c.name;
    id = c.id;
    face = (
      <button
        type="button"
        className="work-item-face work-avatar"
        aria-label={c.name}
        onClick={() => onPickView("clients")}
      >
        <img src={c.avatar} width={size} height={tall} alt="" loading="lazy" decoding="async" />
      </button>
    );
  }

  return (
    <li
      className="work-item"
      data-id={id}
      data-kind={entry.kind}
      data-side="right"
      onPointerEnter={pointLabel}
      onFocus={pointLabel}
      style={
        {
          "--a": `${angle.toFixed(3)}deg`,
          "--w": `${size}px`,
          "--h": `${tall}px`,
        } as CSSProperties
      }
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
