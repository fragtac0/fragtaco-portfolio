import { useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent, PointerEvent, ReactElement } from "react";
import { coverUrl } from "../../content/work-media";
import ClientSocials from "./client-socials";
import { labelSide } from "./ring-layout";
import type { RingEntry } from "./ring-entries";
import type { RingId } from "./ring-math";
import type { Box, ViewId } from "./view-layout";

/** Where an item sits in its ring. Items that fit in no ring have none: they show only in a picked view. */
export interface RingSlotPlace {
  /** Degrees round the ring. */
  angle: number;
  width: number;
  height: number;
}

interface WorkItemProps {
  entry: RingEntry;
  ring: RingId;
  /** Position in the ring's list, which sets how late its caption appears in a picked view. */
  index: number;
  place?: RingSlotPlace;
  /** Where it goes in a picked view (the stack's still row, or the kind's brick layout). */
  box: Box;
  /** Width the caption may use in a picked view. */
  capW: number;
  onPickView: (view: ViewId) => void;
}

// Which side the label opens on is read from where the item is when the pointer or focus arrives.
// The ring is paused by then, so this runs once per hover, not per frame.
function pointLabel(e: PointerEvent<HTMLLIElement> | FocusEvent<HTMLLIElement>) {
  const box = e.currentTarget.getBoundingClientRect();
  e.currentTarget.dataset.side = labelSide(box.left + box.width / 2, window.innerWidth);
}

/**
 * One item. In the rings the `li` is placed on its ring from CSS variables (--a, and --r from the
 * ring); `.work-item-turn` turns the other way to the ring so the item stays upright; in a picked
 * view the page's CSS places it at --vx, --vy instead (see work-views.css). `.work-item-face` is
 * what is drawn and what grows on hover. Stack marks are plain; videos are links; clients are
 * buttons (they open the clients view from a ring, and their link from the clients view).
 */
export default function WorkItem({ entry, ring, index, place, box, capW, onPickView }: WorkItemProps) {
  const size = Math.round(place?.width ?? box.w);
  const tall = Math.round(place?.height ?? box.h);
  const [open, setOpen] = useState(false); // a tapped client's socials are showing
  const touched = useRef(false);
  const item = useRef<HTMLLIElement>(null);

  // A tap anywhere else puts the socials away again (a tap on this item, its avatar or its links, does not).
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!(e.target instanceof Node && item.current?.contains(e.target))) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  let face: ReactElement;
  let caption: ReactElement | null = null;
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
    caption = (
      <span className="work-caption" aria-hidden="true">
        <span className="work-caption-title">{v.title}</span>
        <span className="work-caption-sub">
          {v.for}, {v.year}
        </span>
      </span>
    );
  } else {
    const c = entry.item;
    label = c.name;
    id = c.id;
    const onAvatar = (e: MouseEvent<HTMLButtonElement>) => {
      const page = e.currentTarget.closest<HTMLElement>("[data-view]");
      if (page?.dataset.view !== "clients") {
        onPickView("clients");
      } else if (touched.current && !open) {
        setOpen(true); // on touch the first tap shows the socials and the second opens the link
      } else {
        window.open(c.url, "_blank", "noopener,noreferrer");
      }
    };
    face = (
      <button
        type="button"
        className="work-item-face work-avatar"
        aria-label={c.name}
        onPointerDown={(e) => {
          touched.current = e.pointerType === "touch";
        }}
        onKeyDown={() => {
          touched.current = false;
        }}
        onClick={onAvatar}
      >
        <img src={c.avatar} width={size} height={tall} alt="" loading="lazy" decoding="async" />
      </button>
    );
    caption = (
      <span className="work-caption">
        <span className="work-caption-title" aria-hidden="true">
          {c.name}
        </span>
        <span className="work-caption-sub" aria-hidden="true">
          {c.handle}
        </span>
        <ClientSocials client={c} />
      </span>
    );
  }

  const vars: Record<`--${string}`, string> = {
    "--vx": `${box.x}px`,
    "--vy": `${box.y}px`,
    "--vw": `${box.w}px`,
    "--vh": `${box.h}px`,
    "--vcap": `${capW}px`,
    "--i": String(index),
  };
  if (place) {
    vars["--a"] = `${place.angle.toFixed(3)}deg`;
    vars["--w"] = `${size}px`;
    vars["--h"] = `${tall}px`;
  }

  return (
    <li
      ref={item}
      className="work-item"
      data-id={id}
      data-kind={entry.kind}
      data-ring={ring}
      data-extra={place ? undefined : ""}
      data-open={open ? "" : undefined}
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
        {caption}
      </div>
    </li>
  );
}
