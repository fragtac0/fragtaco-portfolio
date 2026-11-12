export type Layer = "journey" | "places";

type Props = {
  layer: Layer;
  labels: { journey: string; places: string };
  onChange: (layer: Layer) => void;
};

/** The Journey / Places switch (spec 9.5), top right: two buttons, the pressed one filled. Counts as the map's own interface. */
export default function ModeSwitch({ layer, labels, onChange }: Props) {
  return (
    <div className="map-mode" role="group" aria-label={`${labels.journey} / ${labels.places}`} data-map-ui="">
      {(["journey", "places"] as const).map((key) => (
        <button key={key} type="button" className="map-mode-button" aria-pressed={layer === key} onClick={() => onChange(key)}>
          {labels[key]}
        </button>
      ))}
    </div>
  );
}
