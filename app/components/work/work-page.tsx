import type { SiteNavigationItem, SiteSocialLink, SiteWork } from "../../types";
import SiteNav from "../site-nav";
import "./work.css";

interface WorkPageProps {
  work: SiteWork;
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
}

/** The work page. For now: the dark ground and the introduction; the rings come in later parts. */
export default function WorkPage({ work, navigationItems, socialLinks }: WorkPageProps) {
  return (
    <main className="work-page">
      <SiteNav items={navigationItems} socialLinks={socialLinks} />
      <div className="work-intro">
        <h1 className="work-title">{work.intro.title}</h1>
        <p className="work-text">{work.intro.text}</p>
      </div>
    </main>
  );
}
