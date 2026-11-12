import type { CSSProperties } from "react";
import type { ExperienceMoment } from "../../types";
import { StruckTitle } from "./experience-plain";
import type { JourneyMoment } from "./journey";
import NowPing from "./now-ping";

type Props = {
  moment: ExperienceMoment;
  spot: JourneyMoment;
  active: boolean;
  now: boolean;
  onPick: () => void;
  onKeyFocus: () => void;
};

/**
 * A moment on the route: a button. In the overview it is a small dot with the year beside it; in explore (the
 * page's `data-mode`) it is a card with the date, the title and, for the one the visitor is at, the line. A press
 * flies to it. The struck part of a title is in `<s>`. On phones the card is not drawn here: the active moment's
 * words open in the sheet above the dock (`MapSheet`). Positioned in the pins layer from the view's variables.
 */
export default function MomentMarker({ moment, spot, active, now, onPick, onKeyFocus }: Props) {
  return (
    <div
      className="moment"
      data-side={spot.placement}
      data-active={active ? "" : undefined}
      data-now={now ? "" : undefined}
      style={{ "--x": spot.x.toFixed(1), "--y": spot.y.toFixed(1), "--s": spot.s.toFixed(4) } as CSSProperties}
    >
      {now ? <NowPing /> : null}
      <button
        type="button"
        className="moment-button"
        data-map-hit=""
        aria-label={`${moment.label}: ${moment.title}`}
        aria-current={active ? "true" : undefined}
        onClick={onPick}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) onKeyFocus();
        }}
      >
        <span className="moment-dot" />
        <span className="moment-year">{spot.year}</span>
        <span className="moment-card">
          <span className="moment-date">{moment.label}</span>
          <span className="moment-title">
            <StruckTitle moment={moment} />
          </span>
          <span className="moment-line">{moment.line}</span>
        </span>
      </button>
    </div>
  );
}
