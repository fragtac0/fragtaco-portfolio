/**
 * The SVG filters for the glass front's bend, rendered once in the root. They sit unused (zero size, hidden from assistive
 * technology) until glass.css puts them on the view transition's two pictures (`html[data-glass="bend"]`), and glass-run.ts
 * moves their pieces each frame.
 *
 * As in the tenth preview, each picture is pushed on its own: the old page by the push at its place and the new page by minus
 * the push, before the soft mask mixes them (CSS applies a filter before a mask), and each colour is pushed by its own share
 * (`SPLIT`: red furthest, blue least) so the rim of the glass shows a fringe. So each filter makes the displacement map (a
 * neutral grey with the active tile of the bend's pictures laid over it: the tiles are separate images, all in the filter,
 * and only the active one has a size), pushes the picture three times, keeps one colour of each push and adds them.
 * `color-interpolation-filters` is sRGB so grey stays exactly neutral.
 */
import { BEND_TILES } from "./glass-field";

export const GLASS_IDS = {
  old: "ft-glass-old",
  new: "ft-glass-new",
} as const;
export type GlassFilterId = (typeof GLASS_IDS)[keyof typeof GLASS_IDS];

/** The ids of the pieces of a filter: its tile images, and its three pushes (red, green, blue). */
export const tileId = (filter: GlassFilterId, index: number) => `${filter}-tile-${index}`;
export const pushId = (filter: GlassFilterId, channel: "r" | "g" | "b") => `${filter}-push-${channel}`;

/** One colour of a pushed picture: the others zeroed (alpha kept). */
const KEEP: Record<"r" | "g" | "b", string> = {
  r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
};
const CHANNELS = ["r", "g", "b"] as const;

function Bend({ id }: { id: GlassFilterId }) {
  return (
    <filter id={id} x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feFlood floodColor="#808080" result="neutral" />
      {BEND_TILES.map((_, i) => (
        <feImage key={i} id={tileId(id, i)} x="0" y="0" width="0" height="0" preserveAspectRatio="none" result={`tile${i}`} />
      ))}
      <feMerge result="map">
        <feMergeNode in="neutral" />
        {BEND_TILES.map((_, i) => (
          <feMergeNode key={i} in={`tile${i}`} />
        ))}
      </feMerge>
      {CHANNELS.map((c) => (
        <feDisplacementMap
          key={c}
          id={pushId(id, c)}
          in="SourceGraphic"
          in2="map"
          scale="0"
          xChannelSelector="R"
          yChannelSelector="G"
          result={`push-${c}`}
        />
      ))}
      {CHANNELS.map((c) => (
        <feColorMatrix key={c} in={`push-${c}`} type="matrix" values={KEEP[c]} result={`keep-${c}`} />
      ))}
      <feComposite in="keep-r" in2="keep-g" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg" />
      <feComposite in="rg" in2="keep-b" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
    </filter>
  );
}

export default function GlassFilter() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <Bend id={GLASS_IDS.old} />
        <Bend id={GLASS_IDS.new} />
      </defs>
    </svg>
  );
}
