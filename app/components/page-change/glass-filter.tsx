/**
 * The SVG filters for the glass front's bend, rendered once in the root. They sit unused (zero size,
 * hidden from assistive technology) until glass.css puts one on the view transition's picture pair
 * (`html[data-glass="bend"]`), and glass-run.ts moves their pieces each frame.
 *
 * The map the filter pushes the picture by is a small picture (set by glass-run.ts, see glass-texture.ts)
 * placed over a neutral grey, so the push is nil outside the band. Placed and sized per frame so it
 * follows the front. `color-interpolation-filters` is sRGB so grey stays exactly neutral.
 */
export const GLASS_IDS = {
  radial: { filter: "ft-glass-radial", image: "ft-glass-ring", push: "ft-glass-ring-push" },
  linear: { filter: "ft-glass-linear", image: "ft-glass-strip", push: "ft-glass-strip-push" },
} as const;

function Bend({ ids }: { ids: (typeof GLASS_IDS)[keyof typeof GLASS_IDS] }) {
  return (
    <filter
      id={ids.filter}
      x="0"
      y="0"
      width="1"
      height="1"
      primitiveUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      <feFlood floodColor="#808080" result="neutral" />
      <feImage id={ids.image} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="shape" />
      <feMerge result="map">
        <feMergeNode in="neutral" />
        <feMergeNode in="shape" />
      </feMerge>
      <feDisplacementMap id={ids.push} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

export default function GlassFilter() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <Bend ids={GLASS_IDS.radial} />
        <Bend ids={GLASS_IDS.linear} />
      </defs>
    </svg>
  );
}
