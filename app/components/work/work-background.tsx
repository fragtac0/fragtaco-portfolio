interface WorkBackgroundProps {
  /** "half" is the timeline page's: the same ground with the glows at half strength. */
  strength?: "full" | "half";
}

/**
 * The dark ground of /work: two very large, soft glows drifting on slow loops (moved with transforms
 * only), under the site's dot screen and grain, which stay still. Decorative.
 */
export default function WorkBackground({ strength = "full" }: WorkBackgroundProps) {
  return (
    <div className={strength === "half" ? "work-bg work-bg-half" : "work-bg"} aria-hidden="true">
      <div className="work-glow work-glow-ember" />
      <div className="work-glow work-glow-accent" />
      <div className="work-tex" />
    </div>
  );
}
