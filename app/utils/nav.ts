import type { HomeSectionId } from "../types";

export function isHomeSectionId(value: string): value is HomeSectionId {
  return value === "about";
}
