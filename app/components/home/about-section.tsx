import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { layout, surfaces, textStyles } from "../../config/ui";
import type { SiteCredits, SiteFactsSection } from "../../types";
import AboutCopy from "../about/about-copy";
import AboutPortrait from "../about/about-portrait";
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
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const pillBoundsRef = useRef<HTMLDivElement>(null);

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
        {/* One row, two columns at lg: portrait fills the left column,
            the right column carries the title lockup (with the pill-
            physics arena scoped to just that title block) and the copy
            beneath it. Below lg the columns stack with the copy panel
            first — read, then see. */}
        <motion.div
          className="grid gap-6 lg:grid-cols-[minmax(19rem,0.58fr)_minmax(0,1fr)] lg:items-stretch"
          initial={reducedMotion ? false : { opacity: 0.76, y: 36 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ amount: 0.2, once: true }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          <aside className="relative order-2 h-full min-h-[26rem] overflow-hidden rounded-[2.75rem_1.25rem_2.75rem_1.25rem] bg-black/35 shadow-[0_30px_90px_rgba(0,0,0,0.4)] lg:order-1 lg:min-h-[42rem]">
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
          </aside>

          <div
            ref={rightPanelRef}
            className={`order-1 flex h-full flex-col lg:order-2 ${surfaces.aboutHeader}`}
          >
            {/* The pill-physics arena is scoped to just this block (meta +
                title + caption), not the whole panel — its floor sits at
                the bottom of the italic line, so the resting pile never
                reaches the paragraphs below. */}
            <div ref={pillBoundsRef} className="relative isolate overflow-hidden">
              <div className={textStyles.headerMeta}>
                <p className="text-fog/78">profile / fragtaco</p>
                <p className="hidden text-center sm:block">est. 2019</p>
                <p className="sm:text-right">mumbai, india</p>
              </div>

              <div className="relative z-0 mt-8 sm:mt-10">
                {/* Hard break, not a natural wrap — "the cut" comfortably
                    fits on one line at this column's width on several
                    breakpoints, and the two-line reading is the point. */}
                <h2 className={textStyles.displayTitleColumn}>
                  the
                  <br />
                  cut
                </h2>
                <p className="mt-3 text-right font-serif text-[0.95rem] italic leading-relaxed text-fog/60">
                  the person behind the timeline, in four paragraphs.
                </p>
              </div>

              <PillPhysics boundsRef={pillBoundsRef} panelRef={rightPanelRef} />
            </div>

            <div aria-hidden="true" className="mt-8 h-px bg-fog/[0.08]" />

            <div className="mt-8 max-w-[62ch] text-[0.92rem] leading-[1.9] text-fog/90 sm:text-[1rem]">
              <AboutCopy paragraphs={paragraphs} />
            </div>
          </div>
        </motion.div>

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
