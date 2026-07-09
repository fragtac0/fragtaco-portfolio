import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { styleUnlessReduced } from "../../config/ui";

const BASE_GRADIENT =
  "linear-gradient(168deg, #31100A 0%, #1A0800 55%, #0A0300 100%)";

// Positions are baked into left/top via calc() (percent of container minus
// half the blob's own size) so the animated `transform` is free to drift/
// scale without fighting a centering transform. Each blob sits in its own
// full-size `inset-0` wrapper carrying a slow scroll-linked `y` drift, kept
// separate from the inner div's own CSS keyframe transform so neither
// overwrites the other's `transform` property.
export default function EmberBackground() {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const driftA = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const driftB = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const driftC = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
    >
      <div className="absolute inset-0" style={{ background: BASE_GRADIENT }} />

      {/* Blob A — ember-400, ~20%/15%, 26s diagonal drift */}
      <motion.div
        className="absolute inset-0"
        style={styleUnlessReduced(reducedMotion, { y: driftA })}
      >
        <div
          className={`absolute h-[42rem] w-[42rem] rounded-full blur-[90px] will-change-transform ${
            reducedMotion ? "" : "motion-safe:animate-ember-drift-a"
          }`}
          style={{
            left: "calc(20% - 21rem)",
            top: "calc(15% - 21rem)",
            background:
              "radial-gradient(circle, rgba(252,76,0,0.6) 0%, transparent 70%)",
            opacity: 0.62,
            transform: reducedMotion
              ? "translate3d(6%,4%,0) scale(1.08)"
              : undefined,
          }}
        />
      </motion.div>

      {/* Blob B — ember-700, ~80%/40%, 34s opposite drift */}
      <motion.div
        className="absolute inset-0"
        style={styleUnlessReduced(reducedMotion, { y: driftB })}
      >
        <div
          className={`absolute h-[46rem] w-[46rem] rounded-full blur-[90px] will-change-transform ${
            reducedMotion ? "" : "motion-safe:animate-ember-drift-b"
          }`}
          style={{
            left: "calc(80% - 23rem)",
            top: "calc(40% - 23rem)",
            background:
              "radial-gradient(circle, rgba(122,37,4,0.65) 0%, transparent 70%)",
            opacity: 0.6,
            transform: reducedMotion
              ? "translate3d(-5%,-6%,0) scale(1.05)"
              : undefined,
          }}
        />
      </motion.div>

      {/* Blob C — gilt @ 12% alpha, ~50%/85%, 40s slow pulse */}
      <motion.div
        className="absolute inset-0"
        style={styleUnlessReduced(reducedMotion, { y: driftC })}
      >
        <div
          className={`absolute h-[50rem] w-[50rem] rounded-full blur-[90px] will-change-transform ${
            reducedMotion ? "" : "motion-safe:animate-ember-pulse-c"
          }`}
          style={{
            left: "calc(50% - 25rem)",
            top: "calc(85% - 25rem)",
            background:
              "radial-gradient(circle, rgba(217,164,65,0.12) 0%, transparent 70%)",
            opacity: reducedMotion ? 0.7 : undefined,
            transform: reducedMotion ? "scale(1.12)" : undefined,
          }}
        />
      </motion.div>

      {/* Fixed grain dither */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(rgba(245,239,230,0.9)_0.6px,transparent_0.6px)] [background-size:4px_4px]" />

      {/* Top vignette — darken corners so glass panels pop */}
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_38%,rgba(5,4,3,0.55)_100%)]" />
    </div>
  );
}
