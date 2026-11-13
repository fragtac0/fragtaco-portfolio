import { useLocation } from "@remix-run/react";
import type { ReactNode } from "react";
import type { SiteNavigationItem, SiteSocialLink } from "../../types";
import SiteNav from "../site-nav";
import EclipseGround from "../ground/eclipse-ground";
import { placementFor } from "../ground/eclipse-look";
import WorkSwitcher from "./work-switcher";

interface WorkShellProps {
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
  children: ReactNode;
  /** The Eclipse ground behind the page. On for the three work addresses; `/experience` turns it off (the map is its ground). */
  ground?: boolean;
}

/**
 * What the four work addresses share: the page and the dock with its second row (Long form, Short form,
 * My experience). The layout route `/work` renders it round the outlet, so moving between the rings and
 * the two walls keeps one dock (its row closes when a change starts and opens after it, as the dock row
 * always does); `/experience` is its own route and renders it round the experience page. The Eclipse ground
 * (spec 5.1) is drawn here, behind the page, so it stays across the three; its placement follows the address
 * (portfolio 0, long form 1, short form 3) and changes in the same commit as the page. `ground={false}` leaves it out
 * for `/experience`.
 */
export default function WorkShell({ navigationItems, socialLinks, children, ground = true }: WorkShellProps) {
  const { pathname } = useLocation();
  const placement = placementFor(pathname);
  return (
    <>
      {ground && placement !== null ? <EclipseGround placement={placement} /> : null}
      {children}
      <SiteNav items={navigationItems} socialLinks={socialLinks} upperRow={<WorkSwitcher />} />
    </>
  );
}
