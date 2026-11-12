import type { KeyboardEvent } from "react";
import PageLink from "../page-link";
import type { ViewId } from "./view-layout";

const TABS: { view: ViewId; label: string }[] = [
  { view: "all", label: "All" },
  { view: "long", label: "Long form" },
  { view: "short", label: "Short form" },
  { view: "clients", label: "Clients" },
];

/* The dock's own tab look (Doto, tracked), a size smaller; the picked one wears the dock's accent pill. */
const TAB =
  "relative shrink-0 rounded-full px-3 py-2 text-center font-doto text-[length:var(--t-micro)] font-black tracking-[0.06em] text-fog outline-none transition-colors duration-150 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fog sm:px-4 sm:py-2.5 sm:text-[length:var(--t-meta)] sm:tracking-[0.1em]";
const IDLE = "opacity-[var(--dock-idle)]";
const ACTIVE = "border border-accent/40 bg-[var(--accent-soft)] opacity-100 shadow-[inset_0_1px_0_rgba(255,236,214,0.18)]";

/** The ids the tabs and the stage they control point at each other with. */
export const STAGE_ID = "work-stage";
export const tabId = (view: ViewId) => `work-tab-${view}`;

interface WorkSwitcherProps {
  view: ViewId;
  onSelect: (view: ViewId) => void;
}

/**
 * The second row of the dock on /work: all, long form, short form and clients are tabs (a
 * `tablist`) that change the view in place (the stage is their `tabpanel`), and timeline is a link
 * to its own page. The arrow keys, Home and End move focus along the four tabs only; Enter or Space
 * chooses the tab that has focus. Only the picked tab is in the Tab order, and the Timeline link is
 * reached by Tab after it.
 */
export default function WorkSwitcher({ view, onSelect }: WorkSwitcherProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const stops = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")];
    const at = stops.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? stops.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + stops.length) % stops.length;
    stops[next].focus();
  };

  return (
    <div role="presentation" className="work-switcher flex shrink-0 items-center gap-1 sm:gap-1.5" onKeyDown={onKeyDown}>
      <div role="tablist" aria-label="Work view" className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {TABS.map((tab) => {
          const active = tab.view === view;
          return (
            <button
              key={tab.view}
              type="button"
              role="tab"
              id={tabId(tab.view)}
              aria-selected={active}
              aria-controls={STAGE_ID}
              tabIndex={active ? 0 : -1}
              data-view-tab={tab.view}
              className={`${TAB} ${active ? ACTIVE : IDLE}`}
              onClick={() => onSelect(tab.view)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-white/10" />
      <PageLink to="/timeline" className={`${TAB} ${IDLE}`}>
        Timeline
      </PageLink>
    </div>
  );
}
