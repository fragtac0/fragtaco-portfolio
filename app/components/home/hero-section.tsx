import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { styleUnlessReduced, textStyles } from "../../config/ui";
import StaggerText from "../react-bits/stagger-text";
import HeroTimecode from "./hero-timecode";

interface HeroSectionProps {
  title: string;
  subtitle: string;
}

function FrameCorner({ position }: { position: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-7 w-7 border-fog/60 sm:h-10 sm:w-10 ${position}`}
    />
  );
}

export default function HeroSection({ title, subtitle }: HeroSectionProps) {
  const heroRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const vignetteOpacity = useTransform(scrollYProgress, [0, 1], [0.55, 0.92]);
  const textY = useTransform(scrollYProgress, [0, 0.85], [0, -130]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const hudOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);
  const glowX = useTransform(scrollYProgress, [0, 1], ["-12%", "18%"]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.2, 0.34, 0.1]);

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative isolate min-h-[100svh] overflow-hidden bg-ink"
    >
      {/* Painting with slow Ken Burns drift + scroll push-in */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="h-full w-full will-change-transform"
          style={styleUnlessReduced(reducedMotion, {
            scale: imageScale,
            y: imageY,
          })}
        >
          <img
            src="/hero-school-of-athens.jpg"
            alt="The School of Athens by Raphael"
            className="h-full w-full object-cover object-[50%_30%] motion-safe:animate-ken-burns"
          />
        </motion.div>
      </div>

      {/* Warm cinematic vignette + letterbox gradients */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(5,4,3,0.62)_0%,rgba(5,4,3,0.12)_30%,rgba(5,4,3,0.16)_58%,rgba(5,4,3,0.9)_100%)]"
        style={reducedMotion ? { opacity: 0.75 } : { opacity: vignetteOpacity }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_28%_78%,rgba(5,4,3,0.68),transparent_52%)]"
      />

      {/* Drifting warm glow, like a projector beam */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/4 z-[2] w-[46rem] rotate-[8deg] bg-[linear-gradient(90deg,transparent,rgba(252,76,0,0.16),rgba(217,164,65,0.12),transparent)] blur-3xl"
        style={
          reducedMotion ? { opacity: 0.12 } : { opacity: glowOpacity, x: glowX }
        }
      />

      {/* Film-grain dither */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[3] opacity-[0.07] [background-image:radial-gradient(rgba(245,239,230,0.9)_0.6px,transparent_0.6px)] [background-size:4px_4px]"
      />

      {/* Monitor HUD: frame guides, timecode, REC */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 z-[6] sm:inset-7"
        style={styleUnlessReduced(reducedMotion, { opacity: hudOpacity })}
      >
        <FrameCorner position="left-0 top-0 border-l-2 border-t-2" />
        <FrameCorner position="right-0 top-0 border-r-2 border-t-2" />
        <FrameCorner position="bottom-0 left-0 border-b-2 border-l-2" />
        <FrameCorner position="bottom-0 right-0 border-b-2 border-r-2" />

        <div className="absolute inset-x-0 top-1.5 flex items-center justify-between px-9 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-fog/76 sm:top-2.5 sm:px-14 sm:text-[0.68rem]">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent motion-safe:animate-rec-blink" />
            rec
          </span>
          <span className="hidden sm:block">fragtaco / raw_01.braw</span>
          <span>
            <HeroTimecode /> · 24fps
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-1.5 hidden items-center justify-between px-9 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-fog/58 sm:flex sm:bottom-2.5 sm:px-14 sm:text-[0.66rem]">
          <span>scene: school of athens — raphael, 1511</span>
          <span>iso 400 · f2.8 · 4k</span>
        </div>
      </motion.div>

      {/* Editorial lockup, lower-left on the rule-of-thirds line */}
      <div className="relative z-10 flex min-h-[100svh] items-end px-6 pb-28 sm:px-14 sm:pb-32 lg:px-20 lg:pb-36">
        <motion.div
          className="max-w-4xl"
          style={styleUnlessReduced(reducedMotion, {
            opacity: textOpacity,
            y: textY,
          })}
        >
          <motion.p
            className="mb-5 flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.3em] text-gilt sm:text-[0.72rem]"
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block h-px w-10 bg-gilt/70 sm:w-16" />
            aditya bhoir · portfolio
          </motion.p>

          <h1 className={textStyles.heroTitle}>
            <StaggerText text={title} delay={0.35} stagger={0.06} />
          </h1>

          <p className={textStyles.heroSubtitle}>
            <StaggerText text={subtitle} delay={1.15} stagger={0.018} />
          </p>

          <motion.p
            className="mt-7 max-w-[44ch] font-serif text-[0.92rem] italic leading-relaxed text-fog/72 sm:text-[1.02rem]"
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Six years of cutting stories out of raw footage — every frame earns
            its place.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
