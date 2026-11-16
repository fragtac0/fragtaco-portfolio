// The three tabs of the dock's second row and what a click on one does. Pure: no DOM, safe on the server.
import { isOpenAddress } from "../../utils/nav";

export const WORK_TABS = [
  { to: "/work/long-form", label: "Long form" },
  { to: "/work/short-form", label: "Short form" },
  { to: "/experience", label: "My experience" },
] as const;

export type WorkTabTo = (typeof WORK_TABS)[number]["to"];

/** Where a click on a tab goes: its own address, or null when it is the tab already open (the click does nothing). */
export function rowTarget(tabTo: string, pathname: string): string | null {
  return isOpenAddress(tabTo, pathname) ? null : tabTo;
}
