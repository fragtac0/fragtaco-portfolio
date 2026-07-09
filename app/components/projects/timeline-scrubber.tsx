import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { surfaces, textStyles } from "../../config/ui";
import type { SiteWorkExperience, WorkExperienceKind } from "../../types";
import { cn } from "../../utils/cn";
import GlassSheen from "../ui/glass-sheen";
import SectionHeadingRow from "../ui/section-heading-row";

interface TimelineScrubberProps {
  title: string;
  items: SiteWorkExperience[];
}

const HOUSE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const KIND_EDGE_CLASS: Record<WorkExperienceKind, string> = {
  education: "border-t-verdigris",
  "self-taught": "border-t-gilt",
  job: "border-t-fog/40",
  freelance: "border-t-accent",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function TimelineScrubber({
  title,
  items,
}: TimelineScrubberProps) {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const defaultItem =
    items.find((item) => item.yearEnd === null) ?? items[items.length - 1];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Until the user first interacts with the track, the playhead sweeps with
  // scroll progress through the section — a wink at the NLE metaphor. Any
  // click/hover/keyboard interaction hands permanent control to selection.
  const [hasInteracted, setHasInteracted] = useState(false);

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? defaultItem;

  const { rulerStart, rulerEnd, years } = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const starts = items.map((item) => item.yearStart);
    const ends = items.map((item) => item.yearEnd ?? nowYear);
    const start = Math.min(...starts);
    const end = Math.max(nowYear, ...ends);
    const list: number[] = [];
    for (let year = start; year <= end; year += 1) {
      list.push(year);
    }

    return { rulerStart: start, rulerEnd: end, years: list };
  }, [items]);

  const span = rulerEnd - rulerStart || 1;
  const pctForYear = (year: number) =>
    clamp(((year - rulerStart) / span) * 100, 0, 100);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.85", "end 0.35"],
  });
  const scrollYear = useTransform(scrollYProgress, [0, 1], [rulerStart, rulerEnd]);
  const [liveScrollYear, setLiveScrollYear] = useState(rulerStart);

  useMotionValueEvent(scrollYear, "change", (latest) => {
    if (!hasInteracted) {
      setLiveScrollYear(latest);
    }
  });

  const markInteracted = useCallback(() => {
    setHasInteracted(true);
  }, []);

  const activeYear = hoveredId
    ? items.find((item) => item.id === hoveredId)?.yearStart ?? null
    : selectedId
      ? (items.find((item) => item.id === selectedId)?.yearStart ?? null)
      : null;
  const playheadPct =
    reducedMotion || hasInteracted
      ? (activeYear === null ? 100 : pctForYear(activeYear))
      : pctForYear(liveScrollYear);

  const focusIndex = (index: number) => {
    const clampedIndex = clamp(index, 0, items.length - 1);
    const target = items[clampedIndex];
    markInteracted();
    setSelectedId(target.id);
    buttonRefs.current[clampedIndex]?.focus();
  };

  return (
    <section
      ref={sectionRef}
      className={cn(
        surfaces.workPanel,
        "motion-safe:[animation-delay:-3.7s] motion-safe:[animation-duration:12.9s]",
      )}
    >
      <GlassSheen className="left-[-45%] bg-fog/[0.035] motion-safe:[animation-delay:-7.1s] motion-safe:[animation-duration:12.4s]" />
      <SectionHeadingRow
        label="film strip"
        labelClassName={textStyles.giltLabel}
        title={title}
        titleClassName={textStyles.panelTitle}
      />

      <div className="mt-6 overflow-x-auto pb-2" data-lenis-prevent>
        <div className="relative min-w-[40rem] w-full">
          {/* Ruler: year ticks from the earliest entry to the current year */}
          <div className="relative h-7 border-b border-fog/12">
            {years.map((year) => (
              <div
                key={year}
                className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${pctForYear(year)}%` }}
              >
                <span className="font-metric text-[0.58rem] tracking-[0.04em] text-fog/50">
                  {year}
                </span>
                <span className="mt-1 h-2 w-px bg-fog/30" />
              </div>
            ))}
            {years.slice(0, -1).map((year) => (
              <span
                key={`minor-${year}`}
                aria-hidden="true"
                className="absolute bottom-0 h-1.5 w-px -translate-x-1/2 bg-fog/14"
                style={{ left: `${pctForYear(year + 0.5)}%` }}
              />
            ))}
          </div>

          {/* Track + playhead */}
          <div className="relative mt-3 h-[72px]">
            <div className="absolute inset-0 rounded-[0.85rem] bg-black/30 ring-1 ring-fog/10" />

            {items.map((item, index) => {
              const leftPct = pctForYear(item.yearStart);
              const widthPct = pctForYear(item.yearEnd ?? rulerEnd) - leftPct;
              const isSelected = selectedItem.id === item.id;

              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    buttonRefs.current[index] = node;
                  }}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${item.role}, ${item.company}, ${item.periodLabel}`}
                  onClick={() => {
                    markInteracted();
                    setSelectedId(item.id);
                  }}
                  onMouseEnter={() => {
                    markInteracted();
                    setHoveredId(item.id);
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => {
                    markInteracted();
                    setHoveredId(item.id);
                  }}
                  onBlur={() => setHoveredId(null)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      focusIndex(index + 1);
                    } else if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      focusIndex(index - 1);
                    }
                  }}
                  className={cn(
                    "absolute top-0 min-w-[44px] overflow-hidden rounded-[0.6rem] border-t-[3px] bg-black/40 px-2.5 py-2 text-left ring-1 ring-fog/10 backdrop-blur-sm transition-colors duration-200 hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70",
                    KIND_EDGE_CLASS[item.kind],
                    isSelected && "bg-black/60 ring-gilt/60",
                  )}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    height: "100%",
                  }}
                >
                  <span className="block truncate font-mono text-[0.56rem] uppercase tracking-[0.12em] text-fog/80 sm:text-[0.62rem]">
                    {item.role}
                  </span>
                </button>
              );
            })}

            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 z-10 h-full"
              initial={false}
              animate={{ left: `${playheadPct}%` }}
              transition={{
                duration: reducedMotion ? 0 : 0.5,
                ease: HOUSE_EASE,
              }}
              style={{ transform: "translateX(-50%)" }}
            >
              <span className="absolute -top-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-accent" />
              <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-accent shadow-[0_0_10px_rgba(252,76,0,0.6)]" />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 min-h-[9rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedItem.id}
            initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, transition: { duration: 0.15, ease: HOUSE_EASE } }
            }
            transition={{ duration: reducedMotion ? 0 : 0.4, ease: HOUSE_EASE }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gilt">
              <span>{selectedItem.periodLabel}</span>
              {selectedItem.location ? (
                <span className="text-fog/40">{selectedItem.location}</span>
              ) : null}
            </div>
            <h3 className="mt-2 font-doto text-[1.6rem] font-black uppercase leading-none tracking-section text-fog sm:text-[2.2rem]">
              {selectedItem.role}
            </h3>
            <p className="mt-1 font-mono text-[0.8rem] text-fog/82">
              {selectedItem.company}
            </p>
            <p className="mt-4 max-w-[70ch] font-mono text-[0.78rem] leading-[1.75] text-fog/58">
              {selectedItem.summary}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
