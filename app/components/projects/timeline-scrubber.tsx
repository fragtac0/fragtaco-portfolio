import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { surfaces, textStyles } from "../../config/ui";
import type { SiteWorkExperience } from "../../types";
import { cn } from "../../utils/cn";
import GlassSheen from "../ui/glass-sheen";
import SectionHeadingRow from "../ui/section-heading-row";

interface TimelineScrubberProps {
  title: string;
  timelineStart: number;
  items: SiteWorkExperience[];
}

const HOUSE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SESSION_KEY = "timelineKeyframes";
const AUTO_SELECT_THROTTLE_MS = 250;
const MOBILE_BREAKPOINT = 640;
const TRACK_HEIGHT = 64;
const TRACK_GAP = 10;
const LABEL_MIN_WIDTH_PX = 90;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clipMidpoint(item: SiteWorkExperience, nowYear: number) {
  return (item.yearStart + (item.yearEnd ?? nowYear)) / 2;
}

function readStoredKeyframes(): Record<string, number[]> {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number[]>) : {};
  } catch {
    return {};
  }
}

function writeStoredKeyframes(map: Record<string, number[]>) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(map));
  } catch {
    /* sessionStorage unavailable — drag still works for this visit */
  }
}

function useMeasuredWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export default function TimelineScrubber({
  title,
  timelineStart,
  items,
}: TimelineScrubberProps) {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackWrapperRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const defaultItem =
    items.find((item) => item.yearEnd === null) ?? items[items.length - 1];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"scroll" | "manual">("scroll");
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<string | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === selectedId) ?? defaultItem;
  const trackWidthPx = useMeasuredWidth(trackWrapperRef);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    // Client-only breakpoint check (matchMedia isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const span = nowYear - timelineStart || 1;
  const pctForYear = useCallback(
    (year: number) => clamp(((year - timelineStart) / span) * 100, 0, 100),
    [timelineStart, span],
  );

  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = timelineStart; year <= nowYear; year += 1) list.push(year);
    return list;
  }, [timelineStart, nowYear]);

  // Keyframe diamond positions: seeded from content, overridable by a prior
  // visit's drag (sessionStorage), purely decorative/cosmetic.
  const [keyframePositions, setKeyframePositions] = useState<Record<string, number[]>>(() => {
    const base: Record<string, number[]> = {};
    for (const item of items) base[item.id] = [...item.keyframes];
    return base;
  });

  useEffect(() => {
    const stored = readStoredKeyframes();
    if (Object.keys(stored).length === 0) return;
    // Restoring a prior visit's dragged keyframe positions client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeyframePositions((prev) => {
      const merged = { ...prev };
      for (const item of items) {
        const storedForItem = stored[item.id];
        if (Array.isArray(storedForItem) && storedForItem.length === item.keyframes.length) {
          merged[item.id] = storedForItem;
        }
      }
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeStoredKeyframes(keyframePositions);
  }, [keyframePositions]);

  // Refs mirror the mode/isMobile state so the high-frequency scroll callback
  // below always reads the current value without needing to be recreated
  // every render (and without pulling those state values into its own
  // re-render path).
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const scrollYear = useTransform(scrollYProgress, [0, 1], [timelineStart, nowYear]);

  // The playhead's position lives in a MotionValue, not React state: scroll
  // updates it via `.set()` (no re-render) instead of `setState` (which was
  // forcing a full re-render of this whole tree on every scroll frame and
  // causing visible stutter on fast scroll). Starts at "now" (100%), the
  // resting/default position, until the first scroll-progress tick moves it.
  const playheadPctMV = useMotionValue(100);
  const playheadLeftMV = useMotionTemplate`${playheadPctMV}%`;

  const lastAutoSelectAt = useRef(0);
  const lastAutoSelectedId = useRef<string | null>(null);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Re-arm scroll mode once the section is fully out of view in either direction.
    if (modeRef.current === "manual" && (latest <= 0 || latest >= 1)) {
      modeRef.current = "scroll";
      setMode("scroll");
    }
  });

  useMotionValueEvent(scrollYear, "change", (latest) => {
    if (reducedMotion || isMobileRef.current || modeRef.current !== "scroll") return;
    playheadPctMV.set(pctForYear(latest));

    const matched = items.find(
      (item) => latest >= item.yearStart && latest <= (item.yearEnd ?? nowYear),
    );
    if (matched && matched.id !== lastAutoSelectedId.current) {
      const now = Date.now();
      if (now - lastAutoSelectAt.current >= AUTO_SELECT_THROTTLE_MS) {
        lastAutoSelectedId.current = matched.id;
        lastAutoSelectAt.current = now;
        setSelectedId(matched.id);
      }
    }
  });

  const selectClip = useCallback(
    (id: string) => {
      modeRef.current = "manual";
      setMode("manual");
      lastAutoSelectedId.current = id;
      setSelectedId(id);

      // Reduced motion: playhead stays fixed at "now" — only the readout changes.
      if (reducedMotion) return;

      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      const targetPct = pctForYear(clipMidpoint(item, nowYear));
      animate(playheadPctMV, targetPct, { duration: 0.5, ease: HOUSE_EASE });
    },
    [items, nowYear, pctForYear, playheadPctMV, reducedMotion],
  );

  const focusIndex = (index: number) => {
    const clampedIndex = clamp(index, 0, items.length - 1);
    const target = items[clampedIndex];
    selectClip(target.id);
    buttonRefs.current[clampedIndex]?.focus();
  };

  const handleKeyframePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    itemId: string,
    index: number,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingKeyframe(`${itemId}-${index}`);
  };

  const handleKeyframePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    itemId: string,
    index: number,
  ) => {
    if (draggingKeyframe !== `${itemId}-${index}`) return;
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    setKeyframePositions((prev) => {
      const next = { ...prev, [itemId]: [...(prev[itemId] ?? [])] };
      next[itemId][index] = fraction;
      return next;
    });
  };

  const handleKeyframePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDraggingKeyframe(null);
  };

  const trackTwoItems = items.filter((item) => item.track === 2);
  const trackOneItems = items.filter((item) => item.track === 1);

  const renderClip = (item: SiteWorkExperience, index: number) => {
    const leftPct = pctForYear(item.yearStart);
    const widthPct = pctForYear(item.yearEnd ?? nowYear) - leftPct;
    const isSelected = selectedItem.id === item.id;
    const isHovered = hoveredClipId === item.id;
    const widthPx = trackWidthPx !== null ? (widthPct / 100) * trackWidthPx : null;
    const showLabel = widthPx === null || widthPx >= LABEL_MIN_WIDTH_PX;

    const shadows: string[] = [`inset 0 0 0 1px ${rgba(item.clipColor, isHovered ? 0.9 : 0.45)}`];
    if (isHovered) {
      shadows.unshift(
        `0 0 24px 2px ${rgba(item.clipColor, 0.35)}`,
        `0 0 6px ${rgba(item.clipColor, 0.55)}`,
      );
    } else if (isSelected) {
      shadows.unshift(
        `0 0 12px 1px ${rgba(item.clipColor, 0.18)}`,
        `0 0 3px ${rgba(item.clipColor, 0.28)}`,
      );
    }

    return (
      <button
        key={item.id}
        ref={(node) => {
          buttonRefs.current[index] = node;
        }}
        type="button"
        aria-pressed={isSelected}
        aria-label={`${item.role}, ${item.company}, ${item.periodLabel}`}
        onClick={() => selectClip(item.id)}
        onMouseEnter={() => setHoveredClipId(item.id)}
        onMouseLeave={() => setHoveredClipId(null)}
        onFocus={() => setHoveredClipId(item.id)}
        onBlur={() => setHoveredClipId(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            focusIndex(index + 1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusIndex(index - 1);
          }
        }}
        className="absolute top-0 min-w-[44px] overflow-hidden rounded-[6px] text-left transition-[box-shadow,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          height: "100%",
          backgroundColor: rgba(item.clipColor, isHovered || isSelected ? 0.24 : 0.16),
          boxShadow: shadows.join(", "),
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: item.clipColor }}
        />
        {isSelected ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-fog/80"
          />
        ) : null}
        {showLabel ? (
          <span className="absolute inset-x-2 bottom-1.5 truncate font-mono text-[0.68rem] uppercase tracking-[0.08em] text-fog/85">
            {item.role}
          </span>
        ) : null}
      </button>
    );
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
        <div ref={trackWrapperRef} className="relative min-w-[720px] w-full">
          <div className="relative">
            {/* Ruler: year ticks from timelineStart to the current year */}
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

            {/* Tracks — V2 above V1, NLE convention */}
            <div
              className="relative mt-[10px]"
              style={{ height: TRACK_HEIGHT * 2 + TRACK_GAP }}
            >
              <div className="absolute inset-x-0 top-0" style={{ height: TRACK_HEIGHT }}>
                {trackTwoItems.map((item) =>
                  renderClip(item, items.indexOf(item)),
                )}
              </div>
              <div
                className="absolute inset-x-0"
                style={{ top: TRACK_HEIGHT + TRACK_GAP, height: TRACK_HEIGHT }}
              >
                {trackOneItems.map((item) =>
                  renderClip(item, items.indexOf(item)),
                )}
              </div>
            </div>

            {/* Keyframe lane — decorative, draggable */}
            <div
              ref={laneRef}
              className="relative mt-[10px] h-7 touch-none"
              aria-hidden="true"
            >
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox="0 0 100 28"
                preserveAspectRatio="none"
              >
                {items.flatMap((item) => {
                  const positions = keyframePositions[item.id] ?? item.keyframes;
                  const lines = [];
                  for (let i = 0; i < positions.length - 1; i += 1) {
                    const x1 = positions[i] * 100;
                    const x2 = positions[i + 1] * 100;
                    lines.push(
                      <path
                        key={`${item.id}-line-${i}`}
                        d={`M ${x1} 14 L ${x2} 14`}
                        stroke="rgba(245,239,230,0.15)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                      />,
                    );
                  }
                  return lines;
                })}
              </svg>

              {items.flatMap((item) => {
                const positions = keyframePositions[item.id] ?? item.keyframes;
                return positions.map((pos, index) => {
                  const key = `${item.id}-${index}`;
                  const isHovered = hoveredKeyframe === key;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize touch-none transition-transform duration-150",
                        !reducedMotion && isHovered && "scale-[1.4]",
                      )}
                      style={{
                        left: `${pos * 100}%`,
                        backgroundColor: item.clipColor,
                        opacity: 0.7,
                        boxShadow: isHovered
                          ? `0 0 8px 1px ${rgba(item.clipColor, 0.6)}`
                          : undefined,
                      }}
                      onPointerDown={(event) =>
                        handleKeyframePointerDown(event, item.id, index)
                      }
                      onPointerMove={(event) =>
                        handleKeyframePointerMove(event, item.id, index)
                      }
                      onPointerUp={handleKeyframePointerUp}
                      onPointerEnter={() => setHoveredKeyframe(key)}
                      onPointerLeave={() =>
                        setHoveredKeyframe((prev) => (prev === key ? null : prev))
                      }
                    >
                      <span className="absolute -inset-[7px]" />
                    </div>
                  );
                });
              })}
            </div>

            {/* Playhead — spans ruler through keyframe lane. Position is driven
                directly by a MotionValue (see playheadPctMV above) rather than
                React state, so scroll-tracking never triggers a re-render. */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 z-10 h-full"
              style={{ left: playheadLeftMV, transform: "translateX(-50%)" }}
            >
              <span className="absolute -top-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-accent" />
              <span className="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_12px_rgba(252,76,0,0.16)]" />
              <PlayheadTimecode
                pctMV={playheadPctMV}
                timelineStart={timelineStart}
                span={span}
              />
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
            <h3 className="mt-2 flex items-center gap-2.5 font-doto text-[1.6rem] font-black uppercase leading-none tracking-section text-fog sm:text-[2.2rem]">
              <span
                aria-hidden="true"
                className="inline-block h-[0.85em] w-[3px] shrink-0"
                style={{ backgroundColor: selectedItem.clipColor }}
              />
              {selectedItem.role}
            </h3>
            <p className="mt-1 font-mono text-[0.8rem] text-fog/82">
              {selectedItem.company}
            </p>
            <p className="mt-4 max-w-[60ch] font-serif text-[0.9rem] italic leading-[1.75] text-fog/85">
              {selectedItem.summary}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

interface PlayheadTimecodeProps {
  pctMV: MotionValue<number>;
  timelineStart: number;
  span: number;
}

// Isolated so the high-frequency scroll updates driving the playhead don't
// re-render the rest of the timeline — this only re-renders when the
// *rounded* year actually changes (roughly once per year crossed), not on
// every fractional pixel of scroll.
function PlayheadTimecode({ pctMV, timelineStart, span }: PlayheadTimecodeProps) {
  const pctToYear = useCallback(
    (pct: number) => Math.round(timelineStart + (pct / 100) * span),
    [timelineStart, span],
  );
  const [displayYear, setDisplayYear] = useState(() => pctToYear(pctMV.get()));

  useMotionValueEvent(pctMV, "change", (latest) => {
    const rounded = pctToYear(latest);
    setDisplayYear((prev) => (prev === rounded ? prev : rounded));
  });

  return (
    <span className="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap font-metric text-[0.6rem] text-accent">
      {displayYear}
    </span>
  );
}
