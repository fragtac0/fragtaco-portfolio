import { Link } from "@remix-run/react";
import { motion } from "motion/react";
import type { MouseEvent } from "react";
import { FaClapperboard, FaHouse } from "react-icons/fa6";
import type { SiteNavigationItem } from "../../types";
import { tabCurrent } from "../../utils/nav";

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

/** The tabs are client-side links: the page change gets the view transition and the other page's
 * code and data load when the pointer, focus or a finger reaches a tab. */
const MotionLink = motion.create(Link);

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
      viewTransition
      prefetch="intent"
      aria-current={tabCurrent(item.href, pathname, isActive)}
      onClick={onClick}
      whileHover={{ scale: 1.07, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className="relative z-10 min-w-[4.65rem] max-[339px]:min-w-[4.5rem] shrink-0 rounded-full px-2.5 py-2.5 text-center font-doto text-[length:var(--t-micro)] font-black tracking-[0.06em] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fog sm:min-w-[7rem] sm:px-6 sm:py-3 sm:text-[14px] sm:tracking-[0.12em] text-fog"
    >
      {isActive ? (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-0 -z-10 rounded-full border border-accent/40 bg-accent/[0.16] shadow-[inset_0_1px_0_rgba(255,236,214,0.18),0_8px_24px_rgba(252,76,0,0.2)]"
          transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.35 }}
        />
      ) : null}
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

export default function DockNav({ items, activeKey, pathname, onItemClick }: DockNavProps) {
  return (
    <div className="relative flex shrink-0 items-center justify-center gap-0.5 sm:gap-1">
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
