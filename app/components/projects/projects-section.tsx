import {
  layout,
  surfaces,
  textStyles,
} from "../../config/ui";
import type {
  SiteReachOutSection,
  SiteProjectsSection,
  SiteTechStackSection,
  SiteWorkExperienceSection,
} from "../../types";
import { cn } from "../../utils/cn";
import EmberBackground from "./ember-background";
import ProjectCard from "./project-card";
import ReachOutSection from "./reach-out-section";
import TechStackSection from "./tech-stack-section";
import TimelineScrubber from "./timeline-scrubber";
import WorkClock from "./work-clock";
import Reveal from "../ui/reveal";
import SectionHeadingRow from "../ui/section-heading-row";

interface ProjectsSectionProps {
  projects: SiteProjectsSection;
  reachOut: SiteReachOutSection;
  techStack: SiteTechStackSection;
  workExperience: SiteWorkExperienceSection;
}

export default function ProjectsSection({
  projects,
  reachOut,
  techStack,
  workExperience,
}: ProjectsSectionProps) {
  return (
    <section
      id="projects"
      className="relative isolate min-h-screen overflow-hidden text-fog [--ledger-accent:#FC4C00]"
    >
      <EmberBackground />

      <div className={`${layout.pageContainer} relative z-10`}>
        <Reveal>
          <header className={surfaces.workHeader}>
            <div className={textStyles.headerMeta}>
              <p className="text-fog">
                reel / output
              </p>
              <p className="hidden text-center sm:block">play / scrub</p>
              <p className="sm:text-right">
                <WorkClock /> IST
              </p>
            </div>

            <div className="grid items-end gap-4 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-20">
              <div>
                <p className={textStyles.sectionKicker}>
                  clients, channels and cuts
                </p>
                <h1 className={textStyles.displayTitle}>
                  reel
                </h1>
              </div>
              <div className="mb-2 flex flex-col items-end gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-fog/60 lg:mb-4 sm:text-[0.7rem] sm:tracking-[0.28em]">
                <p>6+ yrs</p>
                <p>300+ edits</p>
                <p>mumbai / remote</p>
              </div>
            </div>
          </header>
        </Reveal>

        <Reveal delayMs={140} className="py-4 lg:py-6">
          <TechStackSection content={techStack} />
        </Reveal>

        <Reveal delayMs={240} className="py-4 lg:py-6">
          <TimelineScrubber
            title={workExperience.sectionTitle}
            timelineStart={workExperience.timelineStart}
            items={workExperience.items}
          />
        </Reveal>

        <div className="grid gap-6 py-4 lg:grid-cols-2 lg:gap-8 lg:py-6">
          <Reveal delayMs={340} className="min-w-0">
            <div
              className={cn(
                surfaces.workPanel,
                "motion-safe:[animation-delay:-6.2s] motion-safe:[animation-duration:13.4s]",
              )}
            >
              <SectionHeadingRow
                label="edit log / long-form"
                labelClassName={textStyles.giltLabel}
                title={projects.longForm.sectionTitle}
                titleClassName={textStyles.panelTitle}
              />

              <div className="mt-6 grid gap-3">
                {projects.longForm.items.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    serial={String(index + 1).padStart(2, "0")}
                    aspect="16:9"
                  />
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={400} className="min-w-0">
            <div
              className={cn(
                surfaces.workPanel,
                "motion-safe:[animation-delay:-3.4s] motion-safe:[animation-duration:12.1s]",
              )}
            >
              <SectionHeadingRow
                label="edit log / short-form"
                labelClassName={textStyles.giltLabel}
                title={projects.shortForm.sectionTitle}
                titleClassName={textStyles.panelTitle}
              />

              <div className="mt-6 grid gap-3">
                {projects.shortForm.items.map((project, index) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    serial={String(index + 1).padStart(2, "0")}
                    aspect="9:16"
                  />
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={480} className="py-8 lg:py-10">
          <ReachOutSection content={reachOut} />
        </Reveal>
      </div>
    </section>
  );
}
