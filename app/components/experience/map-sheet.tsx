import type { ReactNode } from "react";

/**
 * On phones the words of the moment or place the visitor is at open from the bottom, above the dock (spec 9.2).
 * It repeats what the marker's button already says, so it is hidden from a screen reader. Not drawn wider than a phone
 * (map-layers.css): there the card sits next to its marker.
 */
export default function MapSheet({ open, kicker, title, line }: { open: boolean; kicker?: string; title: ReactNode; line: string }) {
  return (
    <div className="map-sheet" data-open={open ? "" : undefined} aria-hidden="true">
      {kicker ? <span className="map-sheet-kicker">{kicker}</span> : null}
      <span className="map-sheet-title">{title}</span>
      <span className="map-sheet-line">{line}</span>
    </div>
  );
}
