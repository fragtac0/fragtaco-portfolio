import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import {
  filterPublishedClients,
  filterPublishedProjects,
  filterPublishedWorkExperiences,
  filterVisibleNavItems,
  ensureUniqueBy,
  sortClients,
  sortMilestones,
  sortProjects,
  sortWorkExperiences,
} from "./mappers";
import {
  ClientsSectionSchema,
  FactsSectionSchema,
  HeroPaintingsSchema,
  HomeContentSchema,
  NavigationItemSchema,
  ProjectsSectionSchema,
  ReachOutSectionSchema,
  SocialLinkSchema,
  TechStackSectionSchema,
  WorkExperienceSectionSchema,
} from "./schemas";
import type {
  SiteClientsSection,
  SiteReachOutSection,
  SiteFactsSection,
  SiteHeroPainting,
  SiteHomeContent,
  SiteNavigationItem,
  SiteProjectsSection,
  SiteSocialLink,
  SiteTechStackSection,
  SiteWorkExperienceSection,
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
  return items.filter((item) => !item.missing);
}

export async function getFactsSection(): Promise<SiteFactsSection> {
  const content = await loadJsonFile("facts.json", FactsSectionSchema);
  const items = ensureUniqueBy(content.items, (item) => item.id, "fact id");

  return {
    ...content,
    items,
  };
}

export async function getProjectsSection(): Promise<SiteProjectsSection> {
  const content = await loadJsonFile("projects.json", ProjectsSectionSchema);
  const allItems = [...content.longForm.items, ...content.shortForm.items];
  ensureUniqueBy(allItems, (item) => item.id, "project id");
  ensureUniqueBy(allItems, (item) => item.slug, "project slug");

  return {
    sectionTitle: content.sectionTitle,
    longForm: {
      sectionTitle: content.longForm.sectionTitle,
      items: sortProjects(filterPublishedProjects(content.longForm.items)),
    },
    shortForm: {
      sectionTitle: content.shortForm.sectionTitle,
      items: sortProjects(filterPublishedProjects(content.shortForm.items)),
    },
  };
}

export async function getReachOutSection(): Promise<SiteReachOutSection> {
  return loadJsonFile("reach-out.json", ReachOutSectionSchema);
}

export async function getTechStackSection(): Promise<SiteTechStackSection> {
  const content = await loadJsonFile("tech-stack.json", TechStackSectionSchema);
  const items = ensureUniqueBy(content.items, (item) => item.id, "tech stack id");

  return {
    ...content,
    items: [...items].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

export async function getWorkExperienceSection(): Promise<SiteWorkExperienceSection> {
  const content = await loadJsonFile(
    "work-experience.json",
    WorkExperienceSectionSchema,
  );
  const items = ensureUniqueBy(
    content.items,
    (item) => item.id,
    "work experience id",
  );
  const milestones = ensureUniqueBy(
    content.milestones,
    (milestone) => milestone.id,
    "work milestone id",
  );

  return {
    ...content,
    items: sortWorkExperiences(filterPublishedWorkExperiences(items)),
    milestones: sortMilestones(milestones),
  };
}

export async function getClientsSection(): Promise<SiteClientsSection> {
  const content = await loadJsonFile("clients.json", ClientsSectionSchema);
  const items = ensureUniqueBy(content.items, (item) => item.id, "client id");

  return {
    ...content,
    items: sortClients(filterPublishedClients(items)),
  };
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
