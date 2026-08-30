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
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { FaEye, FaInstagram, FaLock, FaYoutube } from "react-icons/fa6";
import { surfaces, textStyles } from "../../config/ui";
import type {
  SiteWorkExperience,
  SiteWorkMilestone,
  WorkExperienceKeyframeType,
  WorkExperienceLink,
  WorkMilestoneLink,
} from "../../types";
import { cn } from "../../utils/cn";
import SectionHeadingRow from "../ui/section-heading-row";

interface TimelineScrubberProps {
  title: string;
  timelineStart: number;
  items: SiteWorkExperience[];
  milestones: SiteWorkMilestone[];
}

const HOUSE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SESSION_KEY = "timelineKeyframes";
const TRACK_HEIGHT = 64;
const LANE_HEIGHT = 20;
const LANE_GAP = 4;
// Ruler-to-first-track and between-track-group gaps share one rhythm value
// (R13: they read mismatched at 10px/8px, with V3 hugging the ruler).
const GROUP_GAP = 12;
const LABEL_MIN_WIDTH_PX = 90;
const PERIOD_LABEL_MIN_WIDTH_PX = 160;
const CLIP_INSET_PX = 1;
const RULER_EDGE_MASK =
  "linear-gradient(to right, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)";
const RULER_HEIGHT_PX = 28; // matches the ruler's h-7
const CLIP_GROUP_HEIGHT = TRACK_HEIGHT + LANE_GAP + LANE_HEIGHT; // clip row + its keyframe lane
const CLIP_HEADER_STRIP_PX = 18;
const WAVEFORM_HEIGHT_PX = 14;
const MILESTONE_HEIGHT = 20;
const MILESTONE_SUBROW_GAP = 4;
const MILESTONE_MIN_WIDTH_PX = 88;
const MILESTONE_COLOR = "#E4E0D8";
const MILESTONE_TEXT_COLOR = "#141210";
// The two long-running clips get a waveform band — named explicitly per
// spec rather than derived from a duration heuristic.
const WAVEFORM_CLIP_IDS = new Set(["bharat-in-germany", "freelance"]);

const SPROCKET_GRADIENT =
  "repeating-linear-gradient(90deg, rgba(5,4,3,0.45) 0px, rgba(5,4,3,0.45) 2px, transparent 2px, transparent 10px)";

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

// Deliberately irregular stop widths (6/11/12/11px) rather than an evenly
// spaced pattern — reads as grain, not a mechanical tile.
function grainGradient(clipColor: string) {
  return `repeating-linear-gradient(90deg, ${rgba(clipColor, 0.14)} 0px, ${rgba(clipColor, 0.08)} 6px, ${rgba(clipColor, 0.11)} 6px, ${rgba(clipColor, 0.08)} 17px, ${rgba(clipColor, 0.13)} 17px, ${rgba(clipColor, 0.08)} 29px, ${rgba(clipColor, 0.09)} 29px, ${rgba(clipColor, 0.08)} 40px)`;
}

// Tiny seeded PRNG (mulberry32) over a string-hashed seed (FNV-1a) — pure
// computation, no browser APIs, so SSR and client produce byte-identical
// output for the same clip id.
function hashStringToSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A static (never animated) jagged polyline, seeded on the clip id — the
// same "waveform" every render, every visit.
function waveformPolyline(id: string) {
  const POINT_COUNT = 48;
  const rand = mulberry32(hashStringToSeed(id));
  const points: string[] = [];
  for (let i = 0; i < POINT_COUNT; i += 1) {
    const x = (i / (POINT_COUNT - 1)) * 100;
    const amplitude = (1 + rand() * 5.5) * (0.4 + rand() * 0.6);
    const y = clamp(7 + (i % 2 === 0 ? -amplitude : amplitude), 0.5, 13.5);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function clipMidpoint(item: SiteWorkExperience, nowYear: number) {
  return (item.yearStart + (item.yearEnd ?? nowYear)) / 2;
}

interface MilestoneLayoutEntry {
  milestone: SiteWorkMilestone;
  leftPct: number;
  widthPct: number;
  subRow: number;
}

// Greedy left-to-right sub-row packing: a milestone that would overlap the
// previously-placed one in a sub-row drops to the next sub-row. The lane's
// height falls straight out of this — never from hover/selection state.
function packMilestones(
  milestones: SiteWorkMilestone[],
  pctForYear: (year: number) => number,
  trackWidthPx: number,
  span: number,
): { entries: MilestoneLayoutEntry[]; subRowCount: number } {
  if (milestones.length === 0) return { entries: [], subRowCount: 0 };

  // Width in px: max(88px, one month at the current scale) — trackWidthPx
  // spans `span` years, so one year is trackWidthPx/span px, one month a
  // twelfth of that.
  const yearWidthPx = trackWidthPx / span;
  const widthPx = Math.max(MILESTONE_MIN_WIDTH_PX, yearWidthPx / 12);
  const widthPct = (widthPx / trackWidthPx) * 100;

  const sorted = [...milestones].sort((a, b) => a.date - b.date);
  const subRowEndPct: number[] = [];
  const entries: MilestoneLayoutEntry[] = [];

  for (const milestone of sorted) {
    const leftPct = pctForYear(milestone.date);
    let subRow = 0;
    while (subRow < subRowEndPct.length && leftPct < subRowEndPct[subRow]) {
      subRow += 1;
    }
    subRowEndPct[subRow] = leftPct + widthPct;
    entries.push({ milestone, leftPct, widthPct, subRow });
  }

  return { entries, subRowCount: subRowEndPct.length };
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

interface TrackHeaderRowProps {
  number: string;
  name: string;
  height: number;
}

// Track header column entry — purely a label mirroring the lane beside it.
// Never interactive: an eye toggle that actually hid a track would change
// lane heights, which R10 forbids above the fold.
function TrackHeaderRow({ number, name, height }: TrackHeaderRowProps) {
  return (
    <div
      className="flex items-center justify-between gap-1.5 pl-3 pr-2"
      style={{ height }}
    >
      <div className="min-w-0">
        <p className="font-metric text-[0.7rem] text-fog/70">{number}</p>
        <p className="truncate font-mono text-[0.54rem] uppercase tracking-[0.18em] text-fog/40">
          {name}
        </p>
      </div>
      <div aria-hidden="true" className="flex shrink-0 items-center gap-1 text-fog/25">
        <FaEye className="h-2.5 w-2.5" />
        <FaLock className="h-2.5 w-2.5" />
      </div>
    </div>
  );
}

export default function TimelineScrubber({
  title,
  timelineStart,
  items,
  milestones,
}: TimelineScrubberProps) {
  const reducedMotion = useReducedMotion();
  const trackWrapperRef = useRef<HTMLDivElement | null>(null);
  const tracksAreaRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const justDraggedRef = useRef(false);
  const isScrollingRef = useRef(false);
  const scrollSettleTimeoutRef = useRef<number | null>(null);
  const hoverRafIdRef = useRef<number | null>(null);
  const pendingHoverPctRef = useRef<number | null>(null);

  // Suspend hover-follow entirely while the page is scrolling — a stationary
  // cursor over the film strip otherwise sees elements slide beneath it,
  // firing pointer events that fight the scroll (the "film-strip glitch").
  // pointer-events:none is applied directly to the DOM (not via React state)
  // so it takes effect on the very next paint, not a render cycle later.
  useEffect(() => {
    const handleScroll = () => {
      isScrollingRef.current = true;
      if (tracksAreaRef.current) {
        tracksAreaRef.current.style.pointerEvents = "none";
      }
      if (scrollSettleTimeoutRef.current !== null) {
        window.clearTimeout(scrollSettleTimeoutRef.current);
      }
      scrollSettleTimeoutRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
        if (tracksAreaRef.current) {
          tracksAreaRef.current.style.pointerEvents = "";
        }
        scrollSettleTimeoutRef.current = null;
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollSettleTimeoutRef.current !== null) {
        window.clearTimeout(scrollSettleTimeoutRef.current);
      }
      if (hoverRafIdRef.current !== null) {
        cancelAnimationFrame(hoverRafIdRef.current);
      }
    };
  }, []);

  const defaultItem =
    items.find((item) => item.yearEnd === null) ?? items[items.length - 1];

  const [parkedId, setParkedId] = useState<string | null>(null);
  const [hoverClipId, setHoverClipId] = useState<string | null>(null);
  const [isHoverCapable, setIsHoverCapable] = useState(false);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<string | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null);

  // parkedId resolves against both pools — ids are unique across each, so
  // whichever one matches is the current selection; neither matching (the
  // initial null state) falls back to the default clip.
  const selectedMilestone = milestones.find((m) => m.id === parkedId);
  const selectedClipRaw = items.find((item) => item.id === parkedId);
  const readoutClip = selectedClipRaw ?? (selectedMilestone ? undefined : defaultItem) ?? defaultItem;
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

  // Milestone lane geometry — recomputed only when the data or the measured
  // track width changes, so hover/selection never touches it (no layout
  // shift from parking the playhead).
  const milestoneLayout = useMemo(
    () => packMilestones(milestones, pctForYear, trackWidthPx ?? 720, span),
    [milestones, pctForYear, trackWidthPx, span],
  );
  const milestoneLaneHeight =
    milestoneLayout.subRowCount > 0
      ? milestoneLayout.subRowCount * MILESTONE_HEIGHT +
        (milestoneLayout.subRowCount - 1) * MILESTONE_SUBROW_GAP
      : MILESTONE_HEIGHT;

  // Shared between the header column and the tracks column so both sides'
  // box models accumulate identically — applying the separator's
  // border+padding on one side only would drift the two out of alignment
  // by a couple px after the first group.
  const GROUP_COUNT = 4;
  const groupWrapperStyle = (groupIndex: number): CSSProperties => ({
    marginTop: groupIndex === 0 ? 0 : GROUP_GAP,
    paddingBottom: groupIndex === GROUP_COUNT - 1 ? 0 : 1,
    borderBottom:
      groupIndex === GROUP_COUNT - 1
        ? undefined
        : "1px solid rgba(245,239,230,0.06)",
  });

  const findMilestoneAtPct = useCallback(
    (pct: number) =>
      milestoneLayout.entries.find(
        (entry) => pct >= entry.leftPct && pct <= entry.leftPct + entry.widthPct,
      )?.milestone ?? null,
    [milestoneLayout],
  );

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

  const selectMilestone = useCallback(
    (milestone: SiteWorkMilestone) => {
      parkAt(pctForYear(milestone.date), milestone.id);
    },
    [parkAt, pctForYear],
  );

  const focusIndex = (index: number) => {
    const clampedIndex = clamp(index, 0, items.length - 1);
    const target = items[clampedIndex];
    selectClip(target);
    buttonRefs.current[clampedIndex]?.focus();
  };

  const handleTracksAreaMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isHoverCapable || isScrollingRef.current) return;
    const rect = tracksAreaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    // Milestone lane sits topmost — it wins over a clip whose date range
    // happens to span the same x, same "topmost track wins" precedent the
    // clip tracks already use against each other.
    const hoveredMilestone = findMilestoneAtPct(pct);
    const hoveredClip = hoveredMilestone ? null : findClipAtYear(yearForPct(pct));
    setHoverClipId(hoveredMilestone?.id ?? hoveredClip?.id ?? null);

    // Pointer-follow can fire well over 120Hz on some devices — coalesce to
    // at most one playhead update per animation frame instead of setting the
    // spring target on every raw pointermove.
    pendingHoverPctRef.current = pct;
    if (hoverRafIdRef.current === null) {
      hoverRafIdRef.current = requestAnimationFrame(() => {
        hoverRafIdRef.current = null;
        if (pendingHoverPctRef.current !== null) {
          targetPctMV.set(pendingHoverPctRef.current);
          pendingHoverPctRef.current = null;
        }
      });
    }
  };

  const handleTracksAreaMouseLeave = () => {
    if (!isHoverCapable) return;
    if (hoverRafIdRef.current !== null) {
      cancelAnimationFrame(hoverRafIdRef.current);
      hoverRafIdRef.current = null;
    }
    pendingHoverPctRef.current = null;
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

    // A click landing on a milestone or clip button — mouse or keyboard
    // (event.detail === 0) — always selects that specific item directly,
    // even if a clip's date range overlaps it at that x. "Topmost lane
    // wins" only applies to clicks in empty tracks-area space below.
    const target = event.target as HTMLElement;
    const milestoneButton = target.closest<HTMLElement>("[data-milestone-id]");
    const clickedMilestoneId = milestoneButton?.dataset.milestoneId;
    const clickedMilestone = clickedMilestoneId
      ? milestones.find((candidate) => candidate.id === clickedMilestoneId)
      : undefined;
    if (clickedMilestone) {
      if (event.detail === 0) {
        selectMilestone(clickedMilestone);
      } else {
        const pct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        parkAt(pct, clickedMilestone.id);
      }
      return;
    }

    const clipButton = target.closest<HTMLElement>("[data-clip-id]");
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
    const matchedMilestone = findMilestoneAtPct(pct);
    if (matchedMilestone) {
      parkAt(pct, matchedMilestone.id);
      return;
    }
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

  const laneBgClass = (groupIndex: number) =>
    groupIndex % 2 === 0 ? "bg-fog/[0.02]" : "bg-fog/[0.035]";

  const renderClip = (item: SiteWorkExperience, index: number) => {
    const leftPct = pctForYear(item.yearStart);
    const widthPct = pctForYear(item.yearEnd ?? nowYear) - leftPct;
    const isSelected = readoutClip.id === item.id && !selectedMilestone;
    const isHovered = hoverClipId === item.id;
    const widthPx = trackWidthPx !== null ? (widthPct / 100) * trackWidthPx : null;
    const showLabel = widthPx === null || widthPx >= LABEL_MIN_WIDTH_PX;
    const showPeriodLabel = widthPx === null || widthPx >= PERIOD_LABEL_MIN_WIDTH_PX;
    const hasWaveform = WAVEFORM_CLIP_IDS.has(item.id);
    const filmstripBottom = hasWaveform ? WAVEFORM_HEIGHT_PX : 0;

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

    const [fillTopAlpha, fillBottomAlpha] = isHovered
      ? [0.3, 0.15]
      : isSelected
        ? [0.26, 0.13]
        : [0.2, 0.1];

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
          backgroundImage: `linear-gradient(to bottom, ${rgba(item.clipColor, fillTopAlpha)}, ${rgba(item.clipColor, fillBottomAlpha)})`,
          boxShadow: shadows.join(", "),
        }}
      >
        {isSelected ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 z-10 h-px bg-fog/80"
          />
        ) : null}

        {/* Clip header strip — the clip's name lives here, Premiere-style,
            not floating over the body. */}
        {showLabel ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-2"
            style={{ height: CLIP_HEADER_STRIP_PX, backgroundColor: rgba(item.clipColor, 0.85) }}
          >
            <span className="truncate font-mono text-[0.66rem] text-white/90">
              {item.role}
            </span>
            <span className="shrink-0 rounded-sm px-1 font-mono text-[0.5rem] text-fog/60 ring-1 ring-fog/20">
              fx
            </span>
          </div>
        ) : null}

        {/* Clip body — filmstrip texture (+ waveform on the two long
            clips). Pure CSS repeating-gradients, no imagery and nothing
            that re-rasterizes on browser zoom (R11). */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 overflow-hidden"
          style={{ top: CLIP_HEADER_STRIP_PX, bottom: filmstripBottom }}
        >
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundImage: SPROCKET_GRADIENT }} />
          <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundImage: SPROCKET_GRADIENT }} />
          <div
            className="absolute inset-x-0 top-1 bottom-1"
            style={{ backgroundImage: grainGradient(item.clipColor) }}
          />
        </div>

        {hasWaveform ? (
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[14px] w-full"
            viewBox="0 0 100 14"
            preserveAspectRatio="none"
          >
            <polyline
              points={waveformPolyline(item.id)}
              fill={rgba(item.clipColor, 0.3)}
              stroke={rgba(item.clipColor, 0.55)}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}

        {showPeriodLabel ? (
          <span className="absolute right-2 bottom-1.5 shrink-0 whitespace-nowrap font-mono text-[0.56rem] uppercase tracking-[0.06em] text-fog/60 [text-shadow:0_1px_3px_rgba(5,4,3,0.85)]">
            {item.periodLabel}
          </span>
        ) : null}
      </button>
    );
  };

  const renderMilestone = (entry: MilestoneLayoutEntry) => {
    const { milestone, leftPct, widthPct, subRow } = entry;
    const isSelected = selectedMilestone?.id === milestone.id;
    const isHovered = hoverClipId === milestone.id;

    return (
      <button
        key={milestone.id}
        type="button"
        data-milestone-id={milestone.id}
        aria-pressed={isSelected}
        aria-label={`${milestone.monthLabel} — ${milestone.title}`}
        className="absolute overflow-hidden truncate rounded-[2px] text-left font-mono text-[0.6rem] tracking-[0.02em] transition-[box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          top: subRow * (MILESTONE_HEIGHT + MILESTONE_SUBROW_GAP),
          height: MILESTONE_HEIGHT,
          backgroundColor: `rgba(228, 224, 216, 0.92)`,
          color: MILESTONE_TEXT_COLOR,
          border: "1px solid rgba(20,18,16,0.35)",
          boxShadow: isHovered
            ? "0 0 10px 1px rgba(228,224,216,0.4)"
            : isSelected
              ? "0 0 6px 1px rgba(228,224,216,0.28)"
              : undefined,
        }}
      >
        <span className="px-1.5">{milestone.title}</span>
      </button>
    );
  };

  return (
    <section
      className={cn(
        surfaces.workPanel,
        "[overflow-anchor:none] motion-safe:[animation-delay:-3.7s] motion-safe:[animation-duration:12.9s]",
      )}
    >
      <SectionHeadingRow
        label="film strip"
        labelClassName={textStyles.giltLabel}
        title={title}
        titleClassName={textStyles.panelTitle}
      />

      <div className="mt-6 flex">
        {/* Track header column — fixed, does not scroll with the tracks.
            One row per lane, heights mirrored exactly from the tracks
            below via the same constants. Purely a label: no interaction,
            no hover state — an eye toggle that actually hid a track would
            change lane heights, which R10 forbids above the fold. */}
        <div
          className="w-[120px] shrink-0 border-r border-fog/10 sm:w-[140px]"
          style={{ backgroundColor: "#0b0908" }}
        >
          {/* Ruler-height spacer + the same ruler-to-first-group gap the
              tracks side applies via its groups container's own marginTop —
              folded in here so each row below can share groupWrapperStyle
              with the tracks side exactly, index-for-index. */}
          <div style={{ height: RULER_HEIGHT_PX + GROUP_GAP }} />
          <div style={groupWrapperStyle(0)}>
            <TrackHeaderRow number="M1" name="markers" height={milestoneLaneHeight} />
          </div>
          <div style={groupWrapperStyle(1)}>
            <TrackHeaderRow number="V3" name="freelance" height={CLIP_GROUP_HEIGHT} />
          </div>
          <div style={groupWrapperStyle(2)}>
            <TrackHeaderRow number="V2" name="bharat in germany" height={CLIP_GROUP_HEIGHT} />
          </div>
          <div style={groupWrapperStyle(3)}>
            <TrackHeaderRow number="V1" name="education" height={CLIP_GROUP_HEIGHT} />
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
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
              {/* Ruler: year ticks from timelineStart to the current year.
                  Edges are mask-faded so the half-cut first/last year reads as
                  an intentional fade, not a clipped label. Quarter ticks add
                  NLE tick density between the year labels. */}
              <div
                className="relative h-7 border-b border-fog/12"
                style={{
                  maskImage: RULER_EDGE_MASK,
                  WebkitMaskImage: RULER_EDGE_MASK,
                }}
              >
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
                {years.slice(0, -1).flatMap((year) =>
                  [0.25, 0.5, 0.75].map((frac) => (
                    <span
                      key={`quarter-${year}-${frac}`}
                      aria-hidden="true"
                      className="absolute bottom-0 h-1 w-px -translate-x-1/2 bg-fog/[0.08]"
                      style={{ left: `${pctForYear(year + frac)}%` }}
                    />
                  )),
                )}
              </div>

              {/* Lanes, top to bottom: milestones (M1), then V3/V2/V1, NLE
                  convention. Each clip owns its row exactly as given in
                  content; never re-derived. */}
              <div className="relative" style={{ marginTop: GROUP_GAP }}>
                {/* Vertical gridlines, one per year tick, behind everything —
                    first child in DOM order so normal stacking keeps it
                    under the rows below without needing an explicit z-index. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  {years.map((year) => (
                    <span
                      key={`grid-${year}`}
                      className="absolute inset-y-0 w-px bg-fog/[0.06]"
                      style={{ left: `${pctForYear(year)}%` }}
                    />
                  ))}
                </div>

                {/* Milestone lane */}
                <div style={groupWrapperStyle(0)}>
                  <div
                    className={cn("relative rounded-[4px]", laneBgClass(0))}
                    style={{ height: milestoneLaneHeight }}
                  >
                    {milestoneLayout.entries.map((entry) => renderMilestone(entry))}
                  </div>
                </div>

                {[trackThreeItems, trackTwoItems, trackOneItems].map((trackItems, groupOffset) => {
                  const groupIndex = groupOffset + 1; // milestone lane is group 0
                  return (
                    <div
                      key={`track-group-${trackItems[0]?.track ?? groupIndex}`}
                      style={groupWrapperStyle(groupIndex)}
                    >
                      <div
                        className={cn("relative rounded-[4px]", laneBgClass(groupIndex))}
                        style={{ height: TRACK_HEIGHT }}
                      >
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
                                  stroke="rgba(245,239,230,0.1)"
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
                  );
                })}
              </div>

              {/* Playhead — spans ruler through keyframe lane. Position is driven
                  directly by MotionValues (spring-smoothed unless reduced
                  motion), never by scroll. */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 z-10 h-full"
                style={{ left: displayLeftMV, transform: "translateX(-50%)" }}
              >
                {/* Core line reads as a sharp fog hairline with the accent glow
                    wrapped around it, rather than a solid accent bar. */}
                <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-fog/40 shadow-[0_0_2px_1px_rgba(252,76,0,0.55),0_0_14px_2px_rgba(252,76,0,0.3)]" />
                {/* Stem notch bridging the ruler triangle into the line. */}
                <span className="absolute -top-0.5 left-1/2 h-1 w-0.5 -translate-x-1/2 bg-accent" />
                <span className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[9px] border-x-transparent border-t-accent" />
                <PlayheadTimecode
                  pctMV={displayPctMV}
                  timelineStart={timelineStart}
                  span={span}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="mt-6 h-px bg-fog/[0.08]" />

      <div className="relative mt-4 min-h-[16rem] sm:min-h-[12rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedMilestone?.id ?? readoutClip.id}
            initial={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, transition: { duration: 0.15, ease: HOUSE_EASE } }
            }
            transition={{ duration: reducedMotion ? 0 : 0.4, ease: HOUSE_EASE }}
          >
            {selectedMilestone ? (
              <MilestoneReadout milestone={selectedMilestone} />
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gilt">
                <span>{readoutClip.periodLabel}</span>
                {readoutClip.location ? (
                  <span className="text-fog/40">{readoutClip.location}</span>
                ) : null}
              </div>
            )}
            {!selectedMilestone ? (
              <>
                <h3 className="mt-2 flex items-center gap-2.5 font-doto text-[1.6rem] font-black uppercase leading-none tracking-section text-fog sm:text-[2.2rem]">
                  <span
                    aria-hidden="true"
                    className="inline-block h-[0.85em] w-[3px] shrink-0"
                    style={{ backgroundColor: readoutClip.clipColor }}
                  />
                  {readoutClip.readoutTitle ?? readoutClip.role}
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.8rem] text-fog/82">
                  <span>{readoutClip.company}</span>
                  {readoutClip.links.length > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      {readoutClip.links.map((link) => {
                        const Icon = LINK_ICONS[link.type];
                        return (
                          <a
                            key={link.type}
                            href={link.url}
                            target="_blank"
                            rel="noopener"
                            aria-label={`${readoutClip.company} on ${link.type}`}
                            className="text-fog/70 transition-colors duration-200"
                            onMouseEnter={(event) => {
                              event.currentTarget.style.color = readoutClip.clipColor;
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
                <p className="mt-4 max-w-[60ch] font-serif text-[0.9rem] italic leading-[1.75] text-fog/80">
                  {readoutClip.summary}
                </p>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

interface MilestoneReadoutProps {
  milestone: SiteWorkMilestone;
}

function MilestoneReadout({ milestone }: MilestoneReadoutProps) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gilt">
        <span>{milestone.monthLabel}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[0.56rem] tracking-[0.14em]"
          style={{ backgroundColor: "rgba(228,224,216,0.92)", color: MILESTONE_TEXT_COLOR }}
        >
          milestone
        </span>
      </div>
      <h3 className="mt-2 flex items-center gap-2.5 font-doto text-[1.6rem] font-black uppercase leading-none tracking-section text-fog sm:text-[2.2rem]">
        <span
          aria-hidden="true"
          className="inline-block h-[0.85em] w-[3px] shrink-0"
          style={{ backgroundColor: MILESTONE_COLOR }}
        />
        {milestone.title}
      </h3>
      <p className="mt-4 max-w-[60ch] font-serif text-[0.9rem] italic leading-[1.75] text-fog/80">
        {milestone.summary}
      </p>
      {milestone.links.length > 0 ? (
        <p className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[0.72rem] uppercase tracking-[0.1em]">
          {milestone.links.map((link: WorkMilestoneLink) => {
            const Icon = LINK_ICONS[link.type];
            return (
              <a
                key={link.type}
                href={link.url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-fog/70 transition-colors duration-200 hover:text-gilt"
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </a>
            );
          })}
        </p>
      ) : null}
    </>
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
    <span className="absolute top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/85 px-1.5 py-0.5 font-metric text-[0.6rem] text-accent ring-1 ring-accent/25">
      {displayYear}
    </span>
  );
}
