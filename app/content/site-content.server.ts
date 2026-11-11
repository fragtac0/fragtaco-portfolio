import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import { ensureUniqueBy, filterVisibleNavItems } from "./mappers";
import {
  BooksSectionSchema,
  HeroPaintingsSchema,
  HomeContentSchema,
  NavigationItemSchema,
  ReachOutSectionSchema,
  SocialLinkSchema,
  TimelineSchema,
  VideosFileSchema,
  WorkSchema,
} from "./schemas";
import type {
  SiteBook,
  SiteReachOutSection,
  SiteHeroPainting,
  SiteHomeContent,
  SiteNavigationItem,
  SiteSocialLink,
  SiteTimeline,
  SiteVideosFile,
  SiteWork,
} from "../types";

const SITE_CONTENT_ROOT = path.join(process.cwd(), "content", "site");

async function loadJsonFile<T>(
  fileName: string,
  schema: ZodType<T>,
): Promise<T> {
  const filePath = path.join(SITE_CONTENT_ROOT, fileName);
  const raw = await readFile(filePath, "utf8");
  const json = JSON.parse(raw) as unknown;

  return schema.parse(json);
}

export async function getHomeContent(): Promise<SiteHomeContent> {
  return loadJsonFile("home.json", HomeContentSchema);
}

export async function getHeroPaintings(): Promise<SiteHeroPainting[]> {
  const content = await loadJsonFile(
    "hero-paintings.json",
    HeroPaintingsSchema,
  );
  const items = ensureUniqueBy(content.items, (item) => item.id, "painting id");

  // Manifest entries flagged missing:true have no usable file on disk
  // (verified unavailable/too-low-res on Commons) — kept in the JSON for
  // documentation, filtered out here so the shuffle never picks them.
  // The schema guarantees a blur on every painting that is not missing.
  return items.filter((item): item is typeof item & { blur: string } => !item.missing);
}

export async function getBooks(): Promise<SiteBook[]> {
  const content = await loadJsonFile("books.json", BooksSectionSchema);

  return ensureUniqueBy(content.items, (item) => item.id, "book id");
}

export async function getVideos(): Promise<SiteVideosFile> {
  const content = await loadJsonFile("videos.json", VideosFileSchema);
  const items = ensureUniqueBy(content.items, (item) => item.id, "video id");

  return {
    ...content,
    items,
  };
}

export async function getReachOutSection(): Promise<SiteReachOutSection> {
  return loadJsonFile("reach-out.json", ReachOutSectionSchema);
}

export async function getWork(): Promise<SiteWork> {
  return loadJsonFile("work.json", WorkSchema);
}

export async function getTimeline(): Promise<SiteTimeline> {
  return loadJsonFile("timeline.json", TimelineSchema);
}

export async function getNavigationItems(): Promise<SiteNavigationItem[]> {
  const items = await loadJsonFile(
    "navigation.json",
    NavigationItemSchema.array(),
  );

  return filterVisibleNavItems(items);
}

export async function getSocialLinks(): Promise<SiteSocialLink[]> {
  return loadJsonFile("social-links.json", SocialLinkSchema.array());
}
