import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { surfaces, textStyles } from "../../config/ui";
import type { SiteFactsSection } from "../../types";

interface FactShufflerProps {
  content: SiteFactsSection;
}

const SESSION_KEY = "factsSeen";
const HOUSE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function readSeen(): string[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(seen: string[]) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(seen));
  } catch {
    /* sessionStorage unavailable — selection still applies for this visit */
  }
}

export default function FactShuffler({ content }: FactShufflerProps) {
  const reducedMotion = useReducedMotion();
  const facts = content.items;
  const total = facts.length;

  // SSR renders the first fact; the client picks a random one on mount.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [seenCount, setSeenCount] = useState(1);

  const current = facts.find((fact) => fact.id === currentId) ?? facts[0];

  const advance = useCallback(
    (fromSeen: string[]) => {
      const unseen = facts.filter((fact) => !fromSeen.includes(fact.id));
      // When everything has been seen, reset the cycle — but never repeat the
      // fact currently on screen as the immediate next pick.
      const pool =
        unseen.length > 0
          ? unseen
          : facts.filter((fact) => fact.id !== currentId);
      const safePool = pool.length > 0 ? pool : facts;
      const pick = safePool[Math.floor(Math.random() * safePool.length)];
      const nextSeen = unseen.length > 0 ? [...fromSeen, pick.id] : [pick.id];

      setCurrentId(pick.id);
      setSeenCount(nextSeen.length);
      writeSeen(nextSeen);
    },
    [facts, currentId],
  );

  useEffect(() => {
    // Establish the visit's first random fact. This must happen on the client
    // (random pick would otherwise cause an SSR hydration mismatch), so an
    // on-mount setState here is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    advance(readSeen());
  }, []);

  const enter = reducedMotion
    ? { opacity: 1, y: 0 }
    : { opacity: 0, y: 12 };

  return (
    <section className={surfaces.factCard}>
      {/* gilt hairline top-left corner mark */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-gilt/55 sm:left-4 sm:top-4 sm:h-5 sm:w-5"
      />

      <div className="flex items-center justify-between gap-4">
        <p className={textStyles.giltLabel}>{content.eyebrow}</p>
        <span
          className={`${textStyles.chipLabel} rounded-full bg-fog/[0.06] px-3 py-1 text-fog/72 ring-1 ring-fog/12`}
        >
          {current.category}
        </span>
      </div>

      <h2 className={`mt-6 ${textStyles.panelTitle}`}>{content.sectionTitle}</h2>

      <div className="relative mt-6 min-h-[14rem] sm:min-h-[12rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={enter}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, transition: { duration: 0.15, ease: HOUSE_EASE } }
            }
            transition={{ duration: reducedMotion ? 0 : 0.4, ease: HOUSE_EASE }}
          >
            <p className={textStyles.factHeadline}>{current.headline}</p>
            <p className={`mt-3 max-w-[52ch] ${textStyles.factBody}`}>
              {current.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => advance(readSeen())}
          className={`${surfaces.glassChip} min-h-[44px] font-mono text-[0.62rem] uppercase tracking-[0.24em] text-fog transition-[color,box-shadow] duration-200 hover:text-gilt hover:ring-gilt/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70 sm:text-[0.7rem]`}
        >
          next fact
          <span aria-hidden="true" className="text-gilt">
            →
          </span>
        </button>

        <p className="font-metric text-[0.9rem] font-semibold tracking-[0.14em] text-fog/60 sm:text-[1.05rem]">
          {String(seenCount).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      </div>
    </section>
  );
}
