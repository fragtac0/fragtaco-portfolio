import { useLocation } from "@remix-run/react";
import PageLink from "../page-link";
import { rowTarget, tabKind, WORK_TABS } from "./work-tabs";

/* The dock's own tab look (Doto, tracked), a size smaller; the current one wears the dock's accent pill. */
const TAB =
  "relative shrink-0 rounded-full px-3 py-2 text-center font-doto text-[length:var(--t-micro)] font-black tracking-[0.06em] text-fog outline-none transition-colors duration-150 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fog sm:px-4 sm:py-2.5 sm:text-[length:var(--t-meta)] sm:tracking-[0.1em]";
// Idle and current links both have a 1px border (transparent when idle), so which one is current never changes the row's width.
const IDLE = "border border-transparent opacity-[var(--dock-idle)]";
const ACTIVE = "border border-accent/40 bg-[var(--accent-soft)] opacity-100 shadow-[inset_0_1px_0_rgba(255,236,214,0.18)]";

/** The id of the row, which the rings page's skip link points at. */
export const ROW_ID = "work-row";

/**
 * The second row of the dock on the four work addresses: three links, Long form, Short form and My
 * experience (spec 6.1). They are links, not tabs with panels: the one for the current address wears
 * `aria-current="page"` and does nothing when pressed (no navigation, no page change, focus stays; the way
 * back to the rings is the wall's own button); the others go to their address, sweeping sideways between
 * the two walls (`tabKind`) and growing from the link otherwise. On `/work` none is current.
 */
export default function WorkSwitcher() {
  const { pathname } = useLocation();

  return (
    <div id={ROW_ID} data-work-row className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      {WORK_TABS.map((tab) => {
        // No destination means this is the open tab: it is marked current, and PageLink (same rule, isOpenAddress)
        // swallows a plain click. The link keeps its own address, so a new tab opens there.
        const here = rowTarget(tab.to, pathname) === null;
        return (
          <PageLink
            key={tab.to}
            to={tab.to}
            kind={tabKind(pathname, tab.to)}
            aria-current={here ? "page" : undefined}
            data-work-tab={tab.to}
            className={`${TAB} ${here ? ACTIVE : IDLE}`}
          >
            {tab.label}
          </PageLink>
        );
      })}
    </div>
  );
}
