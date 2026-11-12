import type { ReactNode } from "react";
import type { SiteNavigationItem, SiteSocialLink } from "../../types";
import SiteNav from "../site-nav";
import WorkSwitcher from "./work-switcher";

interface WorkShellProps {
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
  children: ReactNode;
}

/**
 * What the four work addresses share: the page and the dock with its second row (Long form, Short form,
 * My experience). The layout route `/work` renders it round the outlet, so moving between the rings and
 * the two walls keeps one dock (its row closes when a change starts and opens after it, as the dock row
 * always does); `/experience` is its own route and renders it round the timeline page. The ground stays
 * with each page for now (the layout takes it over in Task 9).
 */
export default function WorkShell({ navigationItems, socialLinks, children }: WorkShellProps) {
  return (
    <>
      {children}
      <SiteNav items={navigationItems} socialLinks={socialLinks} upperRow={<WorkSwitcher />} />
    </>
  );
}
