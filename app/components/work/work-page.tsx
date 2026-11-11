import { useNavigate } from "@remix-run/react";
import type { SiteNavigationItem, SiteSocialLink, SiteWork } from "../../types";
import SiteNav from "../site-nav";
import { introLine } from "./ring-layout";
import Rings from "./rings";
import type { ViewId } from "./view-layout";
import WorkBackground from "./work-background";
import "./work.css";

interface WorkPageProps {
  work: SiteWork;
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
}

/** The work page: a fixed stage (the page does not scroll) with the moving ground, the intro in the middle and the four rings round it. */
export default function WorkPage({ work, navigationItems, socialLinks }: WorkPageProps) {
  const navigate = useNavigate();

  // A client in the rings opens the clients view, which is a link (`?view=clients`) so Back works.
  const pickView = (view: ViewId) => {
    navigate(view === "all" ? "?" : `?view=${view}`, { preventScrollReset: true });
  };

  return (
    <main className="work-page">
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
      </div>
      <SiteNav items={navigationItems} socialLinks={socialLinks} />
    </main>
  );
}
