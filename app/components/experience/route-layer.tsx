import type { Journey } from "./journey";

type Props = {
  journey: Journey;
  /** The moment the visitor is at (0 to 1 along the route): the line up to it is solid, the rest dashed. `null`: all of it solid. */
  travelled: number | null;
};

/**
 * The route (spec 9.3): one SVG path in picture pixels, inside the map plane, so it scales with the map. Its stroke
 * width is 2 screen pixels at every zoom (`2 / --map-s` picture pixels, in map-layers.css). Drawn under a darker casing so it
 * reads on the bright orange. It draws itself from the start over 1.6 s once the page is settled (`data-route="draw"` on the page).
 */
export default function RouteLayer({ journey, travelled }: Props) {
  const len = Math.max(1, journey.length);
  const dash = travelled === null ? len : Math.max(0, Math.min(1, travelled)) * len;

  return (
    <svg
      className="route"
      width={8192}
      height={8192}
      viewBox="0 0 8192 8192"
      aria-hidden="true"
      focusable="false"
      style={{ "--len": len.toFixed(1), "--dash": dash.toFixed(1) } as React.CSSProperties}
    >
      <path className="route-casing" d={journey.d} />
      <path className="route-ahead" d={journey.d} data-shown={travelled === null ? "no" : "yes"} />
      <path className="route-line" d={journey.d} />
    </svg>
  );
}
