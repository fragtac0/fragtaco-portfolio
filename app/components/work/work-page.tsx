import { useLocation, useNavigate } from "@remix-run/react";
import { useRef, useState } from "react";
import type { SiteNavigationItem, SiteSocialLink, SiteWork } from "../../types";
import SiteNav from "../site-nav";
import { introLine } from "./ring-layout";
import Rings from "./rings";
import { useViewFlip } from "./use-view-flip";
import { viewCount, viewFromSearch, viewTitle, viewTotal, type PickedView, type ViewId } from "./view-layout";
import WorkBackground from "./work-background";
import WorkSwitcher from "./work-switcher";
import "./work.css";
import "./work-views.css";

interface WorkPageProps {
  work: SiteWork;
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
}

/**
 * The work page: a fixed stage (the page does not scroll) with the moving ground, the intro in the
 * middle and the four rings round it. The view comes from the address (`?view=long`, `short`,
 * `clients`; anything else is "all"), so it can be linked and Back works. A change of view is
 * applied to the page's `data-view` by `useViewFlip`, which also plays the travel; the first view
 * (the one the page opens with) is set here and does no travel.
 */
export default function WorkPage({ work, navigationItems, socialLinks }: WorkPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const view = viewFromSearch(location.search);
  const rootRef = useRef<HTMLElement>(null);
  const [openedWith] = useState(view);
  // While the page goes back to "all" the title keeps the name of the view it is leaving.
  const [lastPicked, setLastPicked] = useState<PickedView>(view === "all" ? "long" : view);
  if (view !== "all" && view !== lastPicked) setLastPicked(view);

  useViewFlip(rootRef, view);

  const pickView = (next: ViewId) => {
    if (next === view) return;
    navigate(next === "all" ? "?" : `?view=${next}`, { replace: false, preventScrollReset: true });
  };

  return (
    <main className="work-page" ref={rootRef} data-view={openedWith}>
      <WorkBackground />
      <div className="work-stage">
        <div className="work-intro">
          <h1 className="work-title">{work.intro.title}</h1>
          <p className="work-text">
            <span className="work-text-full">{work.intro.text}</span>
            <span className="work-text-short">{introLine(work.intro.text)}</span>
          </p>
        </div>
        <Rings work={work} onPickView={pickView} />
        <div className="work-fade work-fade-top" aria-hidden="true" />
        <div className="work-fade work-fade-bottom" aria-hidden="true" />
        <div className="work-view-title">
          <h2 className="work-view-name">{viewTitle(lastPicked)}</h2>
          <p className="work-view-count">{viewCount(lastPicked, viewTotal(lastPicked, work))}</p>
        </div>
      </div>
      <SiteNav
        items={navigationItems}
        socialLinks={socialLinks}
        upperRow={<WorkSwitcher view={view} onSelect={pickView} />}
      />
    </main>
  );
}
