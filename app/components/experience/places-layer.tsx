import type { CSSProperties } from "react";
import type { ExperiencePlace } from "../../types";
import type { Point } from "./geo";
import { leaderOf } from "./places";

type Props = {
  places: ExperiencePlace[];
  /** Each place's dot, in picture pixels (on the cliff trace for a line feature). */
  points: Point[];
  active: number | null;
  onPick: (i: number) => void;
  onKeyFocus: (i: number) => void;
};

/** Where a label goes when the content file gives none: just to the right of its dot. */
const DEFAULT_LABEL = { dx: 14, dy: -4 };

/**
 * Places (spec 9.5): the named features as small rings with a leader line to a label (the name and one line). The
 * label's offset is in screen pixels and does not scale with the map, so the summit's crowd of craters keeps its
 * layout at every zoom. Buttons: a press flies to the feature. Shown instead of the route and the moments when the
 * switch is on Places. On phones the line shows in the sheet above the dock, not in the label.
 */
export default function PlacesLayer({ places, points, active, onPick, onKeyFocus }: Props) {
  return (
    <>
      {places.map((place, i) => {
        const { dx, dy } = place.label ?? DEFAULT_LABEL;
        const leader = leaderOf(dx, dy);

        return (
          <div
            key={place.id}
            className="place"
            data-active={active === i ? "" : undefined}
            data-h={dx < 0 ? "l" : "r"}
            data-v={Math.abs(dx) < 24 ? (dy < 0 ? "up" : "down") : "mid"}
            style={
              {
                "--x": points[i].x.toFixed(1),
                "--y": points[i].y.toFixed(1),
                "--dx": dx,
                "--dy": dy,
                "--len": leader.length.toFixed(1),
                "--ang": `${leader.angle.toFixed(1)}deg`,
              } as CSSProperties
            }
          >
            <i className="place-leader" aria-hidden="true" />
            <button
              type="button"
              className="place-button"
              data-map-hit=""
              aria-label={`${place.name}: ${place.line}`}
              aria-current={active === i ? "true" : undefined}
              onClick={() => onPick(i)}
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) onKeyFocus(i);
              }}
            >
              <span className="place-dot" />
              <span className="place-label">
                <span className="place-name">{place.name}</span>
                <span className="place-line">{place.line}</span>
              </span>
            </button>
          </div>
        );
      })}
    </>
  );
}
