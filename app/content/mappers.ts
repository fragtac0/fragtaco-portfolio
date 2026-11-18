import type { SiteNavigationItem } from "../types";

export function ensureUniqueBy<T>(
  items: T[],
  selector: (item: T) => string,
  label: string,
): T[] {
  const seen = new Set<string>();

  for (const item of items) {
    const value = selector(item);

    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }

    seen.add(value);
  }

  return items;
}

export function filterVisibleNavItems(
  items: SiteNavigationItem[],
): SiteNavigationItem[] {
  return items.filter((item) => item.visible);
}
