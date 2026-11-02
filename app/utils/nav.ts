import type { HomeSectionId } from "../types";

export function isHomeSectionId(value: string): value is HomeSectionId {
  return value === "about";
}

export function getNavHeight(): number {
  return (
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height"),
    ) || 0
  );
}
