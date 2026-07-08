import { staggerDelay, surfaces, textStyles } from "../../config/ui";
import type { SiteWorkExperience } from "../../types";
import { cn } from "../../utils/cn";
import GlassSheen from "../ui/glass-sheen";
import SectionHeadingRow from "../ui/section-heading-row";

interface WorkExperienceColumnProps {
  title: string;
  items: SiteWorkExperience[];
}

function SprocketRail() {
  return (
    <div
      aria-hidden="true"
      className="hidden w-5 shrink-0 flex-col items-center justify-around self-stretch rounded-full bg-theme-black/40 py-2 ring-1 ring-fog/8 sm:flex"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="h-2.5 w-2 rounded-[3px] bg-fog/22"
        />
      ))}
    </div>
  );
}

export default function WorkExperienceColumn({
  title,
  items,
}: WorkExperienceColumnProps) {
  return (
    <section
      className={cn(surfaces.workPanel, "motion-safe:[animation-delay:-3.7s] motion-safe:[animation-duration:12.9s]")}
    >
      <GlassSheen className="left-[-45%] bg-fog/[0.035] motion-safe:[animation-delay:-7.1s] motion-safe:[animation-duration:12.4s]" />
      <SectionHeadingRow
        label="film strip"
        labelClassName={textStyles.giltLabel}
        title={title}
        titleClassName={textStyles.panelTitle}
      />

      <div className="mt-6 grid gap-3">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="flex gap-3 rounded-[1rem_1.75rem_1rem_1.75rem] bg-theme-black/34 px-4 py-4 font-mono text-[0.82rem] leading-5 text-fog/62 shadow-[0_12px_38px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,236,214,0.07)] ring-1 ring-fog/8 transition-transform duration-300 ease-out motion-safe:animate-cut-reveal motion-safe:hover:-translate-y-0.5 sm:text-[0.88rem]"
            style={{ animationDelay: staggerDelay(index, 120, 70) }}
          >
            <SprocketRail />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-gilt">
                  {item.periodLabel}
                </p>
                {item.location ? (
                  <p className="text-[0.6rem] uppercase tracking-[0.14em] text-fog/40">
                    {item.location}
                  </p>
                ) : null}
              </div>

              <h3 className="mt-2 font-mono text-[0.96rem] font-semibold text-fog sm:text-[1.02rem]">
                {item.role}
              </h3>
              <p className="mt-1 text-fog/82">{item.company}</p>
              <p className="mt-3 text-[0.74rem] leading-6 text-fog/52">
                {item.summary}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
