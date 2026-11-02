import type { SiteCreditsLink } from "../../../types";

const LABELS: Record<SiteCreditsLink["type"], string> = {
  website: "Website",
  github: "GitHub",
  x: "X",
};

export function creditLinkLabel(type: SiteCreditsLink["type"]): string {
  return LABELS[type];
}

/** The short form shown beside the label: the host for a website, the last path segment otherwise. */
export function creditLinkValue(link: SiteCreditsLink): string {
  try {
    const url = new URL(link.url);
    if (link.type === "website") return url.hostname.replace(/^www\./, "");
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last ?? url.hostname;
  } catch {
    return link.url;
  }
}
