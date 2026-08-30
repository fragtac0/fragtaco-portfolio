import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { layout, surfaces, textStyles } from "../../config/ui";
import type { SiteCredits, SiteFactsSection } from "../../types";
import AboutCopy from "../about/about-copy";
import AboutPortrait from "../about/about-portrait";
import Reveal from "../ui/reveal";
import CreditsCard from "./credits-card";
import FactShuffler from "./fact-shuffler";
import PillPhysics from "./pill-physics";

interface AboutSectionProps {
  paragraphs: string[];
  facts: SiteFactsSection;
  credits: SiteCredits;
}

export default function AboutSection({
  paragraphs,
  facts,
  credits,
}: AboutSectionProps) {
  const reducedMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);

  return (
    <section
      id="about"
      className="relative isolate min-h-screen-nav overflow-hidden bg-ink font-mono text-fog"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-10 [background-image:radial-gradient(rgba(245,239,230,0.5)_0.62px,transparent_0.62px)] [background-size:6px_6px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_82%_10%,rgba(252,76,0,0.1),transparent_30%),radial-gradient(circle_at_14%_78%,rgba(217,164,65,0.07),transparent_32%)]"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/4 -z-10 h-[28rem] w-[28rem] rounded-full bg-accent/14 blur-3xl"
        initial={reducedMotion ? false : { opacity: 0, y: 30 }}
        whileInView={reducedMotion ? undefined : { opacity: 0.2, y: 0 }}
        viewport={{ amount: 0.2, once: true }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <div className={`${layout.homeContainer} relative z-10 grid gap-10`}>
        <Reveal>
          <header ref={headerRef} className={surfaces.aboutHeader}>
            <div className={textStyles.headerMeta}>
              <p className="text-fog/78">profile / fragtaco</p>
              <p className="hidden text-center sm:block">est. 2019</p>
              <p className="sm:text-right">mumbai, india</p>
            </div>

            <div className="relative z-0 grid items-end gap-4 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-20">
              <h2 className={textStyles.displayTitleStandalone}>
                the cut
              </h2>
              <p className="mb-2 max-w-[30ch] font-serif text-[0.95rem] italic leading-relaxed text-fog/60 lg:mb-4 lg:text-right">
                the person behind the timeline, in four paragraphs.
              </p>
            </div>

            {/* The six profile tags, previously a static chip row in the
                copy column, live here as draggable physics pills instead —
                see pill-physics.tsx for the engine. */}
            <PillPhysics panelRef={headerRef} />
          </header>
        </Reveal>

        <motion.main
          className="relative isolate min-w-0 w-full overflow-hidden rounded-[1.25rem_2.5rem_1.25rem_2.5rem] bg-white/[0.06] shadow-[0_24px_100px_rgba(0,0,0,0.44),0_0_64px_rgba(252,76,0,0.1),inset_0_1px_0_rgba(255,236,214,0.11)] ring-1 ring-white/12 backdrop-blur-2xl motion-safe:animate-glass-breathe motion-safe:[animation-delay:-2.8s] motion-safe:[animation-duration:12.2s] sm:rounded-[1.5rem_3rem_1.5rem_3rem]"
          initial={reducedMotion ? false : { opacity: 0.76, y: 36 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ amount: 0.2, once: true }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 opacity-[0.07] mix-blend-screen [background-image:linear-gradient(rgba(245,239,230,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(245,239,230,0.16)_1px,transparent_1px)] [background-size:30px_30px]"
          />
          <div className="grid gap-6 lg:min-h-[42rem] lg:grid-cols-[minmax(22rem,0.72fr)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(26rem,0.7fr)_minmax(0,1fr)] xl:gap-10">
            <aside className="min-h-[22rem] sm:min-h-[32rem] lg:min-h-full">
              <div className="relative h-full min-h-[22rem] overflow-hidden rounded-[1rem_2rem_1rem_2rem] bg-black/35 shadow-[0_30px_90px_rgba(0,0,0,0.4)] sm:min-h-[32rem] lg:min-h-full">
                <motion.div
                  className="absolute inset-[-8%] will-change-transform"
                  initial={reducedMotion ? false : { scale: 1.06, y: 24 }}
                  whileInView={reducedMotion ? undefined : { scale: 1, y: 0 }}
                  viewport={{ amount: 0.2, once: true }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                >
                  <AboutPortrait />
                </motion.div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_16%,rgba(255,236,214,0.16),transparent_30%),linear-gradient(180deg,rgba(255,236,214,0.06),transparent_32%,rgba(0,0,0,0.24))]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-4 pb-3 font-mono text-[0.56rem] uppercase tracking-[0.22em] text-fog/70">
                  <span>subject: a. bhoir</span>
                  <span className="text-gilt">frame 001</span>
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-col justify-center p-4 sm:p-7 lg:p-10 xl:p-12">
              <div className="max-w-[54rem]">
                <div className="max-w-[68ch] text-[0.92rem] leading-[1.9] text-fog/90 sm:text-[1rem]">
                  <AboutCopy paragraphs={paragraphs} />
                </div>
              </div>
            </div>
          </div>
        </motion.main>

        <motion.footer
          className="w-full"
          initial={reducedMotion ? false : { opacity: 0.72, y: 28 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ amount: 0.16, once: true }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          {/* Facts first in DOM order so mobile stacking (single column
              below lg) always puts them above the credits card. items-stretch
              makes both cards match the taller one's height at ≥1024px —
              the facts card (min-h-[16rem]) still sets the floor. */}
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-stretch">
            <FactShuffler content={facts} />
            <CreditsCard credits={credits} />
          </div>
        </motion.footer>
      </div>
    </section>
  );
}
