import { motion } from "motion/react";
import { useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { FaClapperboard, FaHouse } from "react-icons/fa6";
import type { SiteNavigationItem } from "../../types";
import { tabCurrent } from "../../utils/nav";
import PageLink from "../page-link";
import "./dock-nav.css";

interface DockNavItemProps {
  item: SiteNavigationItem;
  isActive: boolean;
  pathname: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

interface DockNavProps {
  items: SiteNavigationItem[];
  activeKey: SiteNavigationItem["key"] | null;
  pathname: string;
  onItemClick: (
    event: MouseEvent<HTMLAnchorElement>,
    item: SiteNavigationItem,
  ) => void;
}

/** The tabs are page links: the page change goes through `changePage` (the view transition) and the
 * other page's code and data load when the pointer, focus or a finger reaches a tab. */
const MotionLink = motion.create(PageLink);

function DockItemIcon({ itemKey }: { itemKey: SiteNavigationItem["key"] }) {
  if (itemKey === "home") {
    return (
      <FaHouse
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
      />
    );
  }

  if (itemKey === "work") {
    return (
      <FaClapperboard
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
      />
    );
  }

  return null;
}

/* At 320 px the dock's content was 18 px wider than its pill (D-119): under 340 px the tabs' minimum
 * width is 4.5rem (72 px, their natural width) and the social icons are 32 px, 4 px less each. Wider
 * screens are unchanged. */
function DockNavItem({ item, isActive, pathname, onClick }: DockNavItemProps) {
  return (
    <MotionLink
      to={item.href}
      aria-current={tabCurrent(item.href, pathname, isActive)}
      onClick={onClick}
      whileHover={{ scale: 1.07, y: -2 }}
      whileTap={{ scale: 0.96 }}
      // A short ease out and no spring: nothing in the dock overshoots.
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="relative z-10 min-w-[4.65rem] max-[339px]:min-w-[4.5rem] shrink-0 rounded-full px-2.5 py-2.5 text-center font-doto text-[length:var(--t-micro)] font-black tracking-[0.06em] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fog sm:min-w-[7rem] sm:px-6 sm:py-3 sm:text-[14px] sm:tracking-[0.12em] text-fog"
    >
      <motion.span
        // An idle label sits at --dock-idle (85%, tokens.css) and the active one at 100% (M-04).
        className={`relative z-10 flex items-center justify-center gap-1.5 transition-opacity duration-[180ms] ease-out sm:gap-2 ${
          isActive ? "opacity-100" : "opacity-[var(--dock-idle)]"
        }`}
        animate={{ y: isActive ? -1 : 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <DockItemIcon itemKey={item.key} />
        {item.label}
      </motion.span>
    </MotionLink>
  );
}

/** The tab that was lit when the last dock was on screen. The dock is rebuilt with each page (the home page and the
 * work pages each render their own), so a tab change across pages has no pill to slide from unless it is remembered here. */
let lastLit: number | null = null;

/** The pill that marks the active tab. It sits behind the tabs, the width of one column of the tabs' grid, and its place is
 * the tab's index (`--dock-lit`), moved by a transform on one ease (dock-nav.css): it slides, never overshoots, and is
 * measured against the dock itself, not the screen, so the dock rising or sinking under it does not disturb it (the shared
 * layout animation it replaces measured in screen coordinates and sprang up and down while the home dock rose). */
function DockPill({ lit }: { lit: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const pill = ref.current;
    const from = lastLit;
    lastLit = lit;
    if (!pill || from === null || from === lit) return;
    // A dock built after a page change starts where the last one's pill was, then slides to its own tab.
    pill.style.setProperty("--dock-lit", String(from));
    void pill.offsetWidth;
    pill.style.setProperty("--dock-lit", String(lit));
  }, [lit]);
  return <span ref={ref} aria-hidden="true" data-dock-pill className="dock-pill" style={{ "--dock-lit": lit } as CSSProperties} />;
}

export default function DockNav({ items, activeKey, pathname, onItemClick }: DockNavProps) {
  const lit = items.findIndex((item) => item.key === activeKey);
  return (
    <div
      className="dock-tabs relative grid shrink-0 grid-flow-col auto-cols-fr items-center justify-center gap-0.5 sm:gap-1"
      style={{ "--dock-count": items.length } as CSSProperties}
    >
      {lit >= 0 ? <DockPill lit={lit} /> : null}
      {items.map((item) => (
        <DockNavItem
          key={item.key}
          item={item}
          isActive={item.key === activeKey}
          pathname={pathname}
          onClick={(event) => onItemClick(event, item)}
        />
      ))}
    </div>
  );
}
