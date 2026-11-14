import type { Mode } from "./climb-change";

type Props = {
  mode: Mode;
  labels: { overview: string; climb: string };
  onChange: (mode: Mode) => void;
  /** Until the heights are read the switch is quieter and cannot be pressed. */
  disabled?: boolean;
};

/** The switch of the two states (spec 9), top right: Overview and My climb, the chosen one filled. */
export default function ModeSwitch({ mode, labels, onChange, disabled = false }: Props) {
  return (
    <div className="map-mode" role="group" aria-label={`${labels.overview} / ${labels.climb}`}>
      {(["overview", "climb"] as const).map((key) => (
        <button key={key} type="button" className="map-mode-button" aria-pressed={mode === key} disabled={disabled} onClick={() => onChange(key)}>
          {labels[key]}
        </button>
      ))}
    </div>
  );
}
