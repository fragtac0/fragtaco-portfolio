/**
 * The SVG filters for the glass front's bend, rendered once in the root. They sit unused (zero size, hidden from assistive
 * technology) until glass.css puts them on the view transition's two pictures (`html[data-glass="bend"]`), and glass-run.ts
 * moves their pieces each frame.
 *
 * As in the tenth preview, each picture is pushed on its own: the old page by the push at its place and the new page by minus
 * the push (and, R56, by half of it: `BEND_NEW`), before the soft mask mixes them (CSS applies a filter before a mask), and each colour
 * is pushed by its own share (`SPLIT`: red furthest, blue least) so the rim of the glass shows a fringe. So each filter makes the
 * displacement map, damps it to neutral towards the screen's edges (the vignette, glass-vignette.ts: a displacement filter reads nothing
 * from outside the picture, so a push there would cut the page off along the edge), pushes the picture three times, keeps one colour of
 * each push and adds them. `color-interpolation-filters` is sRGB so grey stays exactly neutral.
 *
 * R56: the map is ONE picture per filter: one `feImage` whose source is swapped to the tile for the front when the front moves on to the
 * next (glass-prepare.ts makes the tiles, glass-run.ts moves and sizes the picture each frame; a tile reaches past the screen's farthest
 * corner). It used to be 23 pictures in each filter, one in use at a time, all of them walked every frame: about two thirds of the
 * bend's cost. (One sheet of all the tiles with the picture sized to the sheet and moved so that one tile is over the screen cost more,
 * not less: a picture many screens wide is drawn at that size.) A filter has no neutral base under the map: it is only ever on while the
 * map is sized and the vignette is made for this screen (glass-run.ts does not switch the bend on otherwise).
 */
export const GLASS_IDS = {
  old: "ft-glass-old",
  new: "ft-glass-new",
} as const;
export type GlassFilterId = (typeof GLASS_IDS)[keyof typeof GLASS_IDS];

/** The ids of the pieces of a filter: its map picture, and its three pushes (red, green, blue). */
export const mapId = (filter: GlassFilterId) => `${filter}-map`;
export const pushId = (filter: GlassFilterId, channel: "r" | "g" | "b") => `${filter}-push-${channel}`;
/** The id of a filter's vignette image (sized to the screen once glass-prepare.ts has made it). */
export const vignetteId = (filter: GlassFilterId) => `${filter}-vignette`;

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
      <feImage id={mapId(id)} x="0" y="0" width="0" height="0" preserveAspectRatio="none" result="raw" />
      <feImage id={vignetteId(id)} x="0" y="0" width="0" height="0" preserveAspectRatio="none" result="damp" />
      {/* raw * damp - damp / 2 + 1 / 2: the push times the vignette about the neutral grey */}
      <feComposite in="raw" in2="damp" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="map" />
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
