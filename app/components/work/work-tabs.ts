// The three tabs of the dock's second row and what a click on one does. Pure: no DOM, safe on the server.
import type { ChangeKind } from "../../lib/page-change";

export const WORK_TABS = [
  { to: "/work/long-form", label: "Long form" },
  { to: "/work/short-form", label: "Short form" },
  { to: "/experience", label: "My experience" },
] as const;

export type WorkTabTo = (typeof WORK_TABS)[number]["to"];

const bare = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** How the page changes for a tab: a sweep between the two walls in the direction of the tab, radial for every other move. */
export function tabKind(from: string, to: string): ChangeKind {
  const a = bare(from);
  const b = bare(to);
  if (a === "/work/long-form" && b === "/work/short-form") return "linear-right";
  if (a === "/work/short-form" && b === "/work/long-form") return "linear-left";
  return "radial";
}

/** The row's tab for the current address, or null (on `/work` none is active). */
export function activeTab(pathname: string): WorkTabTo | null {
  const here = bare(pathname);
  return WORK_TABS.find((tab) => tab.to === here)?.to ?? null;
}

/** Where a click on a tab goes: its own address, or back to the rings when it is the tab already showing. */
export function rowTarget(tabTo: string, pathname: string): string {
  return bare(pathname) === bare(tabTo) ? "/work" : tabTo;
}
