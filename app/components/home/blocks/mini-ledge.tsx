import { ledgeLines, ledgeStroke, LEDGE_H } from "../reading/ledge";

/** The preview's 1000 unit wide drawing; the picture is stretched to the block's width, its strokes keep their pixel width. */
const W = 1000;
const LINES = ledgeLines(W, 0).map((line) => ({ d: line.d, ...ledgeStroke(line) }));

/**
 * The rock ledge under the home block's small shelf: the same ten lines as the 3D shelf's
 * (reading/ledge.ts), drawn as SVG so the layer poster, a copy of this block, shows it too. It grows
 * into the layer's ledge when the shelf opens. Not interactive and hidden from assistive technology.
 */
export default function MiniLedge() {
  return (
    <svg
      className="ms-ledge"
      viewBox={`0 0 ${W} ${LEDGE_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {LINES.map((l, i) => (
        <path
          key={i}
          d={l.d}
          fill="none"
          stroke={l.color}
          strokeWidth={l.width}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
