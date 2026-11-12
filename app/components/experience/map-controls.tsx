import type { MapState } from "./map-input";

type Props = {
  state: MapState;
  onIn: () => void;
  onOut: () => void;
  onFit: () => void;
};

const ICON = { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false } as const;

/**
 * The three map buttons at the lower right, above the dock: zoom in, zoom out, and the whole mountain (the fit
 * button, the way back to the overview). They count as the map's own interface (`data-map-ui`), so a press on
 * one never starts a drag. Zoom out and fit are off in the overview; zoom in is off at the native size.
 */
export default function MapControls({ state, onIn, onOut, onFit }: Props) {
  return (
    <div className="map-controls" role="group" aria-label="Map controls" data-map-ui="">
      <button type="button" className="map-button" aria-label="Zoom in" onClick={onIn} disabled={!state.canIn}>
        <svg {...ICON}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" className="map-button" aria-label="Zoom out" onClick={onOut} disabled={!state.canOut}>
        <svg {...ICON}>
          <path d="M5 12h14" />
        </svg>
      </button>
      <button type="button" className="map-button" aria-label="Show the whole mountain" onClick={onFit} disabled={state.mode === "overview"}>
        <svg {...ICON}>
          <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
        </svg>
      </button>
    </div>
  );
}
