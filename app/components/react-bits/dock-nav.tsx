import { motion } from "motion/react";
import type { MouseEvent } from "react";
import { FaClapperboard, FaFilm } from "react-icons/fa6";
import type { SiteNavigationItem } from "../../types";

interface DockNavItemProps {
  item: SiteNavigationItem;
  isActive: boolean;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

interface DockNavProps {
  items: SiteNavigationItem[];
  activeKey: SiteNavigationItem["key"];
  onItemClick: (
    event: MouseEvent<HTMLAnchorElement>,
    item: SiteNavigationItem,
  ) => void;
}

function DockItemIcon({ itemKey }: { itemKey: SiteNavigationItem["key"] }) {
  if (itemKey === "about") {
    return (
      <FaClapperboard
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
      />
    );
  }

  if (itemKey === "projects") {
    return (
      <FaFilm
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
      />
    );
  }

  return null;
}

function DockNavItem({ item, isActive, onClick }: DockNavItemProps) {
  return (
    <motion.a
      href={item.href}
      onClick={onClick}
      whileHover={{ scale: 1.07, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={`relative z-10 min-w-[4.65rem] shrink-0 rounded-full px-2.5 py-2.5 text-center font-doto text-[10px] font-black tracking-[0.06em] outline-none focus-visible:ring-1 focus-visible:ring-fog/30 sm:min-w-[7rem] sm:px-6 sm:py-3 sm:text-[14px] sm:tracking-[0.12em] ${
        isActive ? "text-fog" : "text-fog/70"
      }`}
    >
      {isActive ? (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-0 -z-10 rounded-full border border-accent/40 bg-accent/[0.16] shadow-[inset_0_1px_0_rgba(255,236,214,0.18),0_8px_24px_rgba(252,76,0,0.2)]"
          transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.35 }}
        />
      ) : null}
      <motion.span
        className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2"
        animate={{ y: isActive ? -1 : 0, opacity: isActive ? 1 : 0.78 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <DockItemIcon itemKey={item.key} />
        {item.label}
      </motion.span>
    </motion.a>
  );
}

export default function DockNav({ items, activeKey, onItemClick }: DockNavProps) {
  return (
    <div className="relative flex shrink-0 items-center justify-center gap-0.5 sm:gap-1">
      {items.map((item) => (
        <DockNavItem
          key={item.key}
          item={item}
          isActive={item.key === activeKey}
          onClick={(event) => onItemClick(event, item)}
        />
      ))}
    </div>
  );
}
