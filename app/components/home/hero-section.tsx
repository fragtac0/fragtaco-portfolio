import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { layout, styleUnlessReduced, surfaces, textStyles } from "../../config/ui";
import type { SiteHeroPainting } from "../../types";
import { cn } from "../../utils/cn";
import StaggerText from "../react-bits/stagger-text";

interface HeroSectionProps {
  title: string;
  subtitle: string;
  paintings: SiteHeroPainting[];
}

const SESSION_KEY = "heroRecentPaintings";
const RECENT_LIMIT = 3;

function readRecentPaintingIds(): string[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default function HeroSection({
  title,
  subtitle,
  paintings,
}: HeroSectionProps) {
  const heroRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();

  // SSR renders the first manifest entry; the client swaps to a random pick
  // (avoiding the previous visit's choice) before the gated fade-in completes,
  // so there is no visible image swap flash.
  const serverDefault = paintings[0];
  const pickedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Track which painting has actually finished loading so the fade-in reveals
  // the correct image — and so a cached image (where `onLoad` never fires after
  // hydration) is still detected via the ref callback's `complete` check.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const painting =
    paintings.find((item) => item.id === selectedId) ?? serverDefault;

  useEffect(() => {
    if (pickedRef.current || paintings.length === 0) return;
    pickedRef.current = true;

    const recent = readRecentPaintingIds();
    const pool = paintings.filter((item) => !recent.includes(item.id));
    const safePool = pool.length > 0 ? pool : paintings;
    const pick = safePool[Math.floor(Math.random() * safePool.length)];

    try {
      const nextRecent = [...recent, pick.id].slice(-RECENT_LIMIT);
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextRecent));
    } catch {
      /* sessionStorage unavailable — pick still applies for this visit */
    }

    setSelectedId(pick.id);
  }, [paintings]);

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
      {/* Painting with slow Ken Burns drift + scroll push-in.
          Gated fade-in on load hides the client-side random swap. */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="h-full w-full will-change-transform"
          style={styleUnlessReduced(reducedMotion, {
            scale: imageScale,
            y: imageY,
          })}
        >
          <img
            key={painting.id}
            ref={(node) => {
              if (node && node.complete && node.naturalWidth > 0) {
                setLoadedId(painting.id);
              }
            }}
            src={`/paintings/${painting.file}`}
            alt={`${painting.title} by ${painting.artist}`}
            decoding="async"
            onLoad={() => setLoadedId(painting.id)}
            style={
              {
                objectPosition: painting.focal,
                // Feeds the ken-burns keyframes' scale() so each painting can
                // be pulled back (zoom < 1) or pushed in (zoom > 1) without
                // touching the shared breathing animation itself.
                "--painting-zoom": painting.zoom ?? 1,
                // The animation is motion-safe-only, so reduced motion needs
                // its own static application of the same zoom.
                transform: reducedMotion
                  ? `scale(${painting.zoom ?? 1})`
                  : undefined,
              } as CSSProperties
            }
            className={`h-full w-full object-cover transition-opacity duration-700 ease-out motion-safe:animate-ken-burns motion-reduce:transition-none ${
              loadedId === painting.id ? "opacity-100" : "opacity-0"
            }`}
          />
        </motion.div>
      </div>

      {/* Warm cinematic vignette + letterbox gradients */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(5,4,3,0.62)_0%,rgba(5,4,3,0.12)_30%,rgba(5,4,3,0.16)_52%,rgba(5,4,3,0.72)_84%)]"
        style={reducedMotion ? { opacity: 0.75 } : { opacity: vignetteOpacity }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_28%_78%,rgba(5,4,3,0.68),transparent_52%)]"
      />

      {/* Seamless hero → content fade: the bottom ~34% resolves to pure ink so
          there is no detectable seam where the about section begins. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[34%] bg-[linear-gradient(180deg,transparent_0%,rgba(5,4,3,0.55)_55%,#050403_100%)]"
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

      {/* Painting caption, bottom-right — the whole HUD row above it is
          gone. Shares the containerX axis with the nav dock and the
          editorial lockup below, so its right margin lands on exactly
          the same line as their edges rather than an independent inset. */}
      <motion.div
        aria-hidden="true"
        className={cn(
          layout.containerX,
          "pointer-events-none absolute inset-x-0 bottom-4 z-[6] hidden sm:block sm:bottom-7",
        )}
        style={styleUnlessReduced(reducedMotion, { opacity: hudOpacity })}
      >
        <p className="text-right font-mono text-[0.6rem] uppercase tracking-[0.24em] text-fog/58 sm:text-[0.66rem]">
          {painting.title} — {painting.artist}, {painting.year}
        </p>
      </motion.div>

      {/* Editorial lockup, lower-left on the rule-of-thirds line — shares the
          same horizontal axis as the HUD/nav/page container above. */}
      <div
        className={cn(
          layout.containerX,
          "relative z-10 flex min-h-[100svh] items-end pb-28 sm:pb-32 lg:pb-36",
        )}
      >
        <motion.div
          className="max-w-4xl"
          style={styleUnlessReduced(reducedMotion, {
            opacity: textOpacity,
            y: textY,
          })}
        >
          <motion.p
            className={cn(
              surfaces.glassChip,
              "mb-5 font-mono text-[0.62rem] uppercase tracking-[0.3em] text-gilt sm:text-[0.72rem]",
            )}
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block h-px w-6 bg-gilt/70 sm:w-8" />
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
