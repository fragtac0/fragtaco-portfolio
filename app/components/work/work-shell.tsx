import type { ReactNode } from "react";
import type { SiteNavigationItem, SiteSocialLink } from "../../types";
import SiteNav from "../site-nav";
import WorkGround from "./ground/work-ground";
import WorkSwitcher from "./work-switcher";

interface WorkShellProps {
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
  children: ReactNode;
  /** The shader ground behind the page. On for the three work addresses; `/experience` turns it off (the map is its ground). */
  ground?: boolean;
}

/**
 * What the four work addresses share: the page and the dock with its second row (Long form, Short form,
 * My experience). The layout route `/work` renders it round the outlet, so moving between the rings and
 * the two walls keeps one dock (its row closes when a change starts and opens after it, as the dock row
 * always does); `/experience` is its own route and renders it round the experience page. The ground of the
 * work addresses (WorkGround) is drawn here, behind the page, so it keeps running across the three;
 * `ground={false}` leaves it out for `/experience`.
 */
export default function WorkShell({ navigationItems, socialLinks, children, ground = true }: WorkShellProps) {
  return (
    <>
      {ground ? <WorkGround /> : null}
      {children}
      <SiteNav items={navigationItems} socialLinks={socialLinks} upperRow={<WorkSwitcher />} />
    </>
  );
}
