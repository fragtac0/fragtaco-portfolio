/**
 * The SVG filters for the glass front's bend, rendered once in the root. They sit unused (zero size, hidden from assistive
 * technology) until glass.css puts them on the view transition's two pictures (`html[data-glass="bend"]`), and glass-run.ts
 * moves their pieces each frame.
 *
 * As in the tenth preview, each picture is pushed on its own: the old page by the push at its place and the new page by minus
 * the push (R58: both whole, `BEND_NEW` is 1), before the soft mask mixes them (CSS applies a filter before a mask), and each colour
 * is pushed by its own share (`SPLIT`, the hero painting's: red 1.4 times green, blue 1/1.4 times) so the glass shows a red and blue
 * fringe. The push is the hero's liquid, a noise gradient with a wake behind the front (R58, glass-noise.ts; the 17 November design),
 * where it was a radial lens. So each filter makes the displacement map from two pictures, multiplies them (R129: the direction picture
 * is the hero's noise gradient fixed on the screen and damped to neutral towards the screen's edges, glass-vignette.ts, a displacement
 * filter reading nothing from outside the picture, so a push there would cut the page off along the edge; the tile for the front holds
 * only the strength, glass-texture.ts), pushes the picture three times, keeps one colour of each push and adds them.
 * `color-interpolation-filters` is sRGB so grey stays exactly neutral.
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

/**
 * The map's arithmetic composite: result = k1 * strength * direction + k2 * strength + k3 * direction + k4 (all 0 to 1).
 * R130: the direction picture's neutral is the byte 128 (128 / 255, not 1/2: the vignette and the displacement both work on bytes), so
 * k2 is minus that, and a neutral direction gives exactly 1/2 (the displacement map's no-push value) whatever the strength. With
 * k2 = -1/2 each push was offset by 0.00196 times its scale, half a pixel once the red scale passed 255.
 */
export const MAP_K = { k1: 1, k2: -128 / 255, k3: 0, k4: 0.5 } as const;
/** What the composite makes of a strength and a direction (both 0 to 1), as the filter computes it. */
export const mapValue = (strength: number, direction: number) => MAP_K.k1 * strength * direction + MAP_K.k2 * strength + MAP_K.k3 * direction + MAP_K.k4;

function Bend({ id }: { id: GlassFilterId }) {
  return (
    <filter id={id} x="0" y="0" width="1" height="1" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feImage id={mapId(id)} x="0" y="0" width="0" height="0" preserveAspectRatio="none" result="strength" />
      <feImage id={vignetteId(id)} x="0" y="0" width="0" height="0" preserveAspectRatio="none" result="direction" />
      {/* strength * direction - strength * 128 / 255 + 1 / 2: 1/2 plus the direction about its neutral byte (128) times the strength (R130; a strength of 0 is neutral) */}
      <feComposite in="strength" in2="direction" operator="arithmetic" k1={MAP_K.k1} k2={MAP_K.k2} k3={MAP_K.k3} k4={MAP_K.k4} result="map" />
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
