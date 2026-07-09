import { motion, useReducedMotion } from "motion/react";
import { FaArrowUpRightFromSquare, FaPlay } from "react-icons/fa6";
import { staggerDelay } from "../../config/ui";
import type { SiteProject } from "../../types";

interface ProjectCardProps {
  project: SiteProject;
  revealIndex?: number;
  serial?: string;
  aspect?: "16:9" | "9:16";
}

export default function ProjectCard({
  project,
  revealIndex = 0,
  serial,
  aspect = "16:9",
}: ProjectCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.article
      className="group grid gap-4 rounded-[1rem_1.75rem_1rem_1.75rem] bg-theme-black/26 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,236,214,0.07)] ring-1 ring-fog/6 motion-safe:animate-cut-reveal sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
      style={{ animationDelay: staggerDelay(revealIndex, 160, 80) }}
      whileHover={
        reducedMotion
          ? undefined
          : { y: -3, rotate: -0.35, transition: { duration: 0.25, ease: "easeOut" } }
      }
    >
      <div className="hidden pr-5 font-doto text-[1.6rem] font-black leading-none text-gilt/85 sm:block">
        {serial}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          {serial ? (
            <span className="font-doto text-[1.4rem] font-black leading-none text-gilt/85 sm:hidden">
              {serial}
            </span>
          ) : null}
          <h3 className="min-w-0 break-words font-doto text-[1.22rem] font-black uppercase leading-none tracking-section text-fog sm:text-[1.82rem]">
            {project.title}
          </h3>
          <span className="rounded-full bg-fog/10 px-2.5 py-0.5 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-fog/70 ring-1 ring-fog/12">
            {project.year} · {project.status}
          </span>
          <span className="rounded-full bg-fog/10 px-2.5 py-0.5 font-mono text-[0.54rem] uppercase tracking-[0.18em] text-fog/70 ring-1 ring-fog/12">
            {aspect === "9:16" ? "vertical / 9:16" : "16:9"}
          </span>
        </div>
        <p className="mt-3 max-w-[52ch] font-mono text-[0.74rem] leading-6 text-fog/58 sm:text-[0.8rem]">
          {project.summary}
        </p>
        <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gilt/80">
          {project.role} · {project.tech.join(" / ")}
        </p>
      </div>

      <div className="flex h-full items-center gap-3 self-center justify-end text-fog drop-shadow-[0_0_14px_rgba(255,236,214,0.18)] sm:justify-start">
        {project.liveUrl ? (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Watch ${project.title}`}
            className="grid h-11 w-11 place-items-center rounded-full bg-fog/10 ring-1 ring-fog/16 transition-colors duration-200 hover:bg-accent hover:text-theme-black"
          >
            <FaPlay className="h-4 w-4 translate-x-[1px]" />
          </a>
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-full bg-fog/6 ring-1 ring-fog/10 text-fog/40">
            <FaArrowUpRightFromSquare className="h-4 w-4" />
          </span>
        )}
      </div>
    </motion.article>
  );
}
