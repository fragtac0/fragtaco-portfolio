/**
 * The dark ground of /work: two very large, soft glows drifting on slow loops (moved with transforms
 * only), under the site's dot screen and grain, which stay still. Decorative.
 */
export default function WorkBackground() {
  return (
    <div className="work-bg" aria-hidden="true">
      <div className="work-glow work-glow-ember" />
      <div className="work-glow work-glow-accent" />
      <div className="work-tex" />
    </div>
  );
}
