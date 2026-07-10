import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { FaInstagram, FaYoutube } from "react-icons/fa6";
import { surfaces, textStyles } from "../../config/ui";
import type {
  SiteWorkExperience,
  WorkExperienceKeyframeType,
  WorkExperienceLink,
} from "../../types";
import { cn } from "../../utils/cn";
import SectionHeadingRow from "../ui/section-heading-row";

interface TimelineScrubberProps {
  title: string;
  timelineStart: number;
  items: SiteWorkExperience[];
}

const HOUSE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SESSION_KEY = "timelineKeyframes";
const TRACK_HEIGHT = 64;
const LANE_HEIGHT = 20;
const LANE_GAP = 4;
const GROUP_GAP = 8;
const LABEL_MIN_WIDTH_PX = 90;
const CLIP_INSET_PX = 1;

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

const LINK_ICONS: Record<WorkExperienceLink["type"], typeof FaInstagram> = {
  instagram: FaInstagram,
  youtube: FaYoutube,
};

// AE keyframe icon language: linear = diamond, bezier = ringed dot,
// ease (Easy Ease) = hourglass of two tip-to-tip triangles.
function KeyframeGlyph({
  type,
  color,
}: {
  type: WorkExperienceKeyframeType;
  color: string;
}) {
  if (type === "bezier") {
    return (
      <svg viewBox="0 0 10 10" className="h-full w-full">
        <circle cx="5" cy="5" r="4" fill="none" stroke="rgba(245,239,230,0.55)" strokeWidth="1" />
        <circle cx="5" cy="5" r="3" fill={color} />
      </svg>
    );
  }
  if (type === "ease") {
    return (
      <svg viewBox="0 0 10 10" className="h-full w-full">
        <path d="M0 0 L0 10 L5 5 Z" fill={color} />
        <path d="M10 0 L10 10 L5 5 Z" fill={color} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 10 10" className="h-full w-full">
      <path d="M5 0 L10 5 L5 10 L0 5 Z" fill={color} />
    </svg>
  );
}

export default function TimelineScrubber({
  title,
  timelineStart,
  items,
}: TimelineScrubberProps) {
  const reducedMotion = useReducedMotion();
  const trackWrapperRef = useRef<HTMLDivElement | null>(null);
  const tracksAreaRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const justDraggedRef = useRef(false);

  const defaultItem =
    items.find((item) => item.yearEnd === null) ?? items[items.length - 1];

  const [parkedId, setParkedId] = useState<string | null>(null);
  const [hoverClipId, setHoverClipId] = useState<string | null>(null);
  const [isHoverCapable, setIsHoverCapable] = useState(false);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<string | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === parkedId) ?? defaultItem;
  const trackWidthPx = useMeasuredWidth(trackWrapperRef);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    // Client-only pointer-capability check (matchMedia isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHoverCapable(mq.matches);
    const handler = (event: MediaQueryListEvent) => setIsHoverCapable(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const span = nowYear - timelineStart || 1;
  const pctForYear = useCallback(
    (year: number) => clamp(((year - timelineStart) / span) * 100, 0, 100),
    [timelineStart, span],
  );
  const yearForPct = useCallback(
    (pct: number) => timelineStart + (pct / 100) * span,
    [timelineStart, span],
  );

  const findClipAtYear = useCallback(
    (year: number) => {
      const matches = items.filter(
        (item) => year >= item.yearStart && year <= (item.yearEnd ?? nowYear),
      );
      if (matches.length === 0) return null;
      return matches.reduce((top, item) => (item.track > top.track ? item : top));
    },
    [items, nowYear],
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

  // Playhead position: never scroll-linked (R1). Defaults to the freelance
  // clip's midpoint; hover sweeps it (spring-smoothed) without touching the
  // readout; a click "parks" it and commits the selection.
  const initialParkedPct = pctForYear(clipMidpoint(defaultItem, nowYear));
  const targetPctMV = useMotionValue(initialParkedPct);
  const springPctMV = useSpring(targetPctMV, { duration: 0.12, bounce: 0 });
  const parkedPctRef = useRef(initialParkedPct);

  const rawLeftMV = useMotionTemplate`${targetPctMV}%`;
  const springLeftMV = useMotionTemplate`${springPctMV}%`;
  const displayPctMV = reducedMotion ? targetPctMV : springPctMV;
  const displayLeftMV = reducedMotion ? rawLeftMV : springLeftMV;

  const parkAt = useCallback(
    (pct: number, id: string | null) => {
      const clamped = clamp(pct, 0, 100);
      parkedPctRef.current = clamped;
      setParkedId(id);
      targetPctMV.set(clamped);
    },
    [targetPctMV],
  );

  const selectClip = useCallback(
    (item: SiteWorkExperience) => {
      parkAt(pctForYear(clipMidpoint(item, nowYear)), item.id);
    },
    [nowYear, parkAt, pctForYear],
  );

  const focusIndex = (index: number) => {
    const clampedIndex = clamp(index, 0, items.length - 1);
    const target = items[clampedIndex];
    selectClip(target);
    buttonRefs.current[clampedIndex]?.focus();
  };

  const handleTracksAreaMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isHoverCapable) return;
    const rect = tracksAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    targetPctMV.set(pct);
    const hovered = findClipAtYear(yearForPct(pct));
    setHoverClipId(hovered?.id ?? null);
  };

  const handleTracksAreaMouseLeave = () => {
    if (!isHoverCapable) return;
    targetPctMV.set(parkedPctRef.current);
    setHoverClipId(null);
  };

  const handleTracksAreaClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const rect = tracksAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    // A click landing on a clip button — mouse or keyboard (event.detail === 0)
    // — always selects that specific clip directly, even if a higher-track
    // clip's date range overlaps it at that x. "Topmost track wins" only
    // applies to clicks in empty tracks-area space below.
    const clipButton = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-clip-id]",
    );
    const clickedId = clipButton?.dataset.clipId;
    const clickedItem = clickedId
      ? items.find((candidate) => candidate.id === clickedId)
      : undefined;
    if (clickedItem) {
      if (event.detail === 0) {
        selectClip(clickedItem);
      } else {
        const pct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        parkAt(pct, clickedItem.id);
      }
      return;
    }
    if (event.detail === 0) return;

    const pct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const matched = findClipAtYear(yearForPct(pct));
    parkAt(pct, matched?.id ?? null);
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
    item: SiteWorkExperience,
    index: number,
  ) => {
    if (draggingKeyframe !== `${item.id}-${index}`) return;
    justDraggedRef.current = true;
    const laneEl = event.currentTarget.closest<HTMLElement>("[data-lane]");
    const rect = laneEl?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // Clamped to the owning clip's own x-range, not the full lane width.
    const minFraction = pctForYear(item.yearStart) / 100;
    const maxFraction = pctForYear(item.yearEnd ?? nowYear) / 100;
    const fraction = clamp(
      (event.clientX - rect.left) / rect.width,
      minFraction,
      maxFraction,
    );
    setKeyframePositions((prev) => {
      const next = { ...prev, [item.id]: [...(prev[item.id] ?? [])] };
      next[item.id][index] = fraction;
      return next;
    });
  };

  const handleKeyframePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDraggingKeyframe(null);
  };

  const trackThreeItems = items.filter((item) => item.track === 3);
  const trackTwoItems = items.filter((item) => item.track === 2);
  const trackOneItems = items.filter((item) => item.track === 1);

  const renderClip = (item: SiteWorkExperience, index: number) => {
    const leftPct = pctForYear(item.yearStart);
    const widthPct = pctForYear(item.yearEnd ?? nowYear) - leftPct;
    const isSelected = selectedItem.id === item.id;
    const isHovered = hoverClipId === item.id;
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
        data-clip-id={item.id}
        aria-pressed={isSelected}
        aria-label={`${item.role}, ${item.company}, ${item.periodLabel}`}
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
          left: `calc(${leftPct}% + ${CLIP_INSET_PX}px)`,
          width: `calc(${widthPct}% - ${CLIP_INSET_PX * 2}px)`,
          height: "100%",
          backgroundColor: rgba(item.clipColor, isHovered || isSelected ? 0.24 : 0.16),
          boxShadow: shadows.join(", "),
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: rgba(item.clipColor, item.topBarOpacity) }}
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
      className={cn(
        surfaces.workPanel,
        "motion-safe:[animation-delay:-3.7s] motion-safe:[animation-duration:12.9s]",
      )}
    >
      <SectionHeadingRow
        label="film strip"
        labelClassName={textStyles.giltLabel}
        title={title}
        titleClassName={textStyles.panelTitle}
      />

      <div className="mt-6 overflow-x-auto pb-2" data-lenis-prevent>
        <div ref={trackWrapperRef} className="relative min-w-[720px] w-full">
          {/* Click-anywhere-to-park is a mouse/touch convenience on top of the
              clip buttons below, which already provide full keyboard access
              (Tab + arrow keys + Enter/Space). */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            ref={tracksAreaRef}
            className="relative cursor-pointer"
            onMouseMove={handleTracksAreaMouseMove}
            onMouseLeave={handleTracksAreaMouseLeave}
            onClick={handleTracksAreaClick}
          >
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

            {/* Tracks — V3 top, V2 middle, V1 bottom, NLE convention. Each
                item owns its row exactly as given in content; never re-derived.
                Each track carries its own keyframe lane directly beneath its
                clips (AE-style: layer bar, then property keyframes). */}
            <div className="relative mt-[10px]">
              {[trackThreeItems, trackTwoItems, trackOneItems].map((trackItems, groupIndex) => (
                <div
                  key={`track-group-${trackItems[0]?.track ?? groupIndex}`}
                  style={{ marginTop: groupIndex === 0 ? 0 : GROUP_GAP }}
                >
                  <div className="relative" style={{ height: TRACK_HEIGHT }}>
                    {trackItems.map((item) => renderClip(item, items.indexOf(item)))}
                  </div>

                  <div
                    data-lane
                    className="relative touch-none"
                    style={{ marginTop: LANE_GAP, height: LANE_HEIGHT }}
                    aria-hidden="true"
                  >
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                      viewBox="0 0 100 20"
                      preserveAspectRatio="none"
                    >
                      {trackItems.flatMap((item) => {
                        const positions = keyframePositions[item.id] ?? item.keyframes;
                        const lines = [];
                        for (let i = 0; i < positions.length - 1; i += 1) {
                          const x1 = positions[i] * 100;
                          const x2 = positions[i + 1] * 100;
                          lines.push(
                            <path
                              key={`${item.id}-line-${i}`}
                              d={`M ${x1} 10 L ${x2} 10`}
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

                    {trackItems.flatMap((item) => {
                      const positions = keyframePositions[item.id] ?? item.keyframes;
                      return positions.map((pos, index) => {
                        const key = `${item.id}-${index}`;
                        const isHovered = hoveredKeyframe === key;

                        return (
                          <div
                            key={key}
                            className={cn(
                              "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none transition-transform duration-150",
                              !reducedMotion && isHovered && "scale-[1.4]",
                            )}
                            style={{
                              left: `${pos * 100}%`,
                              opacity: 0.85,
                              filter: isHovered
                                ? `drop-shadow(0 0 6px ${rgba(item.clipColor, 0.6)})`
                                : undefined,
                            }}
                            onPointerDown={(event) =>
                              handleKeyframePointerDown(event, item.id, index)
                            }
                            onPointerMove={(event) =>
                              handleKeyframePointerMove(event, item, index)
                            }
                            onPointerUp={handleKeyframePointerUp}
                            onPointerEnter={() => setHoveredKeyframe(key)}
                            onPointerLeave={() =>
                              setHoveredKeyframe((prev) => (prev === key ? null : prev))
                            }
                          >
                            <span className="absolute -inset-[7px]" />
                            <KeyframeGlyph type={item.keyframeType} color={item.clipColor} />
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Playhead — spans ruler through keyframe lane. Position is driven
                directly by MotionValues (spring-smoothed unless reduced
                motion), never by scroll. */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 z-10 h-full"
              style={{ left: displayLeftMV, transform: "translateX(-50%)" }}
            >
              <span className="absolute -top-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-accent" />
              <span className="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_12px_rgba(252,76,0,0.16)]" />
              <PlayheadTimecode
                pctMV={displayPctMV}
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
              {selectedItem.readoutTitle ?? selectedItem.role}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.8rem] text-fog/82">
              <span>{selectedItem.company}</span>
              {selectedItem.links.length > 0 ? (
                <span className="inline-flex items-center gap-2">
                  {selectedItem.links.map((link) => {
                    const Icon = LINK_ICONS[link.type];
                    return (
                      <a
                        key={link.type}
                        href={link.url}
                        target="_blank"
                        rel="noopener"
                        aria-label={`${selectedItem.company} on ${link.type}`}
                        className="text-fog/70 transition-colors duration-200"
                        onMouseEnter={(event) => {
                          event.currentTarget.style.color = selectedItem.clipColor;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.color = "";
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    );
                  })}
                </span>
              ) : null}
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

// Isolated so playhead position updates don't re-render the rest of the
// timeline — this only re-renders when the *rounded* year actually changes.
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
