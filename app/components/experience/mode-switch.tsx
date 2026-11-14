import type { Mode } from "./climb-change";

type Props = {
  mode: Mode;
  labels: { overview: string; climb: string };
  onChange: (mode: Mode) => void;
};

/** The switch of the two states (spec 9), top right: Overview and My climb, the chosen one filled. */
export default function ModeSwitch({ mode, labels, onChange }: Props) {
  return (
    <div className="map-mode" role="group" aria-label={`${labels.overview} / ${labels.climb}`}>
      {(["overview", "climb"] as const).map((key) => (
        <button key={key} type="button" className="map-mode-button" aria-pressed={mode === key} onClick={() => onChange(key)}>
          {labels[key]}
        </button>
      ))}
    </div>
  );
}
