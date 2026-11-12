import "./edge-focus.css";

/**
 * The elliptical blur and darkening toward the screen's edges (spec 9.1): it keeps the eye on the mountain and
 * leaves calm ground for the heading and the caption. Screen-fixed: it does not move with the map. Two masked
 * `backdrop-filter` layers (a light blur from the ellipse's rim, a stronger one further out; stacked they come
 * to about 14 px at the corners) and a darkening gradient; where `backdrop-filter` is missing only the
 * darkening shows, a little stronger. The ellipse is clear of the overview's mountain on both axes (see
 * edge-focus.css), and the layer sits under the map's text, markers and the dock, so none of them is blurred.
 */
export default function EdgeFocus() {
  return (
    <div className="edge-focus" aria-hidden="true">
      <span className="edge-focus-blur edge-focus-blur-1" />
      <span className="edge-focus-blur edge-focus-blur-2" />
      <span className="edge-focus-dim" />
    </div>
  );
}
