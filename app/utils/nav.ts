import type { HomeSectionId, NavigationKey } from "../types";

/** Old links to `/#about` (and `/work#about`) still open the intro card. */
export function isHomeSectionId(value: string): value is HomeSectionId {
  return value === "about";
}

const underPath = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(base + "/");

/** Which dock tab a page belongs to: home on `/`, work on `/work` and `/timeline` and under them. */
export function activeNavKey(pathname: string): NavigationKey | null {
  if (pathname === "/") return "home";
  if (underPath(pathname, "/work") || underPath(pathname, "/timeline")) return "work";
  return null;
}

/** A tab's `aria-current`: "page" when the page is the tab's own address, "true" when the page only
 * belongs to the tab (the work tab on /timeline), nothing otherwise. */
export function tabCurrent(href: string, pathname: string, isActive: boolean): "page" | "true" | undefined {
  if (pathname === href) return "page";
  return isActive ? "true" : undefined;
}
