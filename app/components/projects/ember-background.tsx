import { useReducedMotion } from "motion/react";

const BASE_GRADIENT =
  "linear-gradient(168deg, #31100A 0%, #1A0800 55%, #0A0300 100%)";

// Positions are baked into left/top via calc() (percent of container minus
// half the blob's own size) so the self-running CSS keyframe animation is
// free to drift/scale without fighting a centering transform. No scroll
// linkage (R2) — these loop on their own regardless of page scroll.
export default function EmberBackground() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
    >
      <div className="absolute inset-0" style={{ background: BASE_GRADIENT }} />

      {/* Blob A — ember-400, ~20%/15%, 26s diagonal drift. Pre-blurred via a
          multi-stop radial gradient instead of filter:blur() — a real blur
          filter forces the compositor to re-rasterize the whole blob on
          every zoom-level change (the reel-page flicker culprit); a soft
          gradient falloff reads the same but costs nothing to zoom. */}
      <div
        className={`absolute h-[50rem] w-[50rem] rounded-full will-change-transform ${
          reducedMotion ? "" : "motion-safe:animate-ember-drift-a"
        }`}
        style={{
          left: "calc(20% - 25rem)",
          top: "calc(15% - 25rem)",
          background:
            "radial-gradient(circle, rgba(252,76,0,0.42) 0%, rgba(252,76,0,0.28) 18%, rgba(252,76,0,0.15) 36%, rgba(252,76,0,0.06) 55%, transparent 75%)",
          transform: reducedMotion
            ? "translate3d(6%,4%,0) scale(1.08)"
            : undefined,
        }}
      />

      {/* Blob B — ember-700, ~80%/40%, 34s opposite drift */}
      <div
        className={`absolute h-[54rem] w-[54rem] rounded-full will-change-transform ${
          reducedMotion ? "" : "motion-safe:animate-ember-drift-b"
        }`}
        style={{
          left: "calc(80% - 27rem)",
          top: "calc(40% - 27rem)",
          background:
            "radial-gradient(circle, rgba(122,37,4,0.45) 0%, rgba(122,37,4,0.3) 18%, rgba(122,37,4,0.16) 36%, rgba(122,37,4,0.06) 55%, transparent 75%)",
          transform: reducedMotion
            ? "translate3d(-5%,-6%,0) scale(1.05)"
            : undefined,
        }}
      />

      {/* Blob C — gilt @ 12% alpha, ~50%/85%, 40s slow pulse */}
      <div
        className={`absolute h-[58rem] w-[58rem] rounded-full will-change-transform ${
          reducedMotion ? "" : "motion-safe:animate-ember-pulse-c"
        }`}
        style={{
          left: "calc(50% - 29rem)",
          top: "calc(85% - 29rem)",
          background:
            "radial-gradient(circle, rgba(217,164,65,0.1) 0%, rgba(217,164,65,0.07) 25%, rgba(217,164,65,0.03) 50%, transparent 72%)",
          opacity: reducedMotion ? 0.7 : undefined,
          transform: reducedMotion ? "scale(1.12)" : undefined,
        }}
      />

      {/* Grain dither — fixed to the viewport (not the scrolling page), so
          it's one constant-size layer the compositor never has to
          re-rasterize relative to scroll position or zoom level. */}
      <div className="fixed inset-0 -z-20 opacity-[0.06] [background-image:radial-gradient(rgba(245,239,230,0.9)_0.6px,transparent_0.6px)] [background-size:4px_4px]" />

      {/* Top vignette — darken corners so glass panels pop */}
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_38%,rgba(5,4,3,0.55)_100%)]" />
    </div>
  );
}
