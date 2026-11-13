import type { HomeSectionId, NavigationKey } from "../types";

/** Old links to `/#about` (and `/work#about`) still open the intro card. */
export function isHomeSectionId(value: string): value is HomeSectionId {
  return value === "about";
}

const underPath = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(base + "/");

/** Which dock tab a page belongs to: home on `/`, work on `/work`, under it (the two walls) and on `/experience`. */
export function activeNavKey(pathname: string): NavigationKey | null {
  if (pathname === "/") return "home";
  if (underPath(pathname, "/work") || underPath(pathname, "/experience")) return "work";
  return null;
}

/** A tab's `aria-current`: "page" when the page is the tab's own address, "true" when the page only
 * belongs to the tab (the work tab on a wall or on /experience), nothing otherwise. */
export function tabCurrent(href: string, pathname: string, isActive: boolean): "page" | "true" | undefined {
  if (pathname === href) return "page";
  return isActive ? "true" : undefined;
}

/** Round 5 linked the views as `/work?view=long`, `short` and `clients`: where each goes now (null: not a round 5 link). */
export function legacyViewTarget(search: string): string | null {
  const view = new URLSearchParams(search).get("view");
  if (view === "long") return "/work/long-form";
  if (view === "short") return "/work/short-form";
  if (view === "clients") return "/work";
  return null;
}

/** Whether a link points at the page that is open: pressing it does nothing (no navigation, no page change). A link with a
 * query or a hash points somewhere else on the page, so it is not this. */
export function isOpenAddress(to: string, pathname: string): boolean {
  if (/[?#]/.test(to)) return false;
  const bare = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);
  return bare(to) === bare(pathname);
}
