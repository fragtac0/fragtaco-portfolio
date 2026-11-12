/**
 * The radar ping at the end of the route (spec 9.3): a ring that grows and fades every 2.4 s round the orange
 * "now" dot. Reduced motion: a still ring (map-layers.css). Decoration only.
 */
export default function NowPing() {
  return (
    <span className="now-ping" aria-hidden="true">
      <span className="now-ping-ring" />
    </span>
  );
}
