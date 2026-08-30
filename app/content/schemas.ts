import { z } from "zod";

const rootRelativePathPattern = /^\/(?!\/).+/;

const HrefSchema = z.union([
  z.string().url(),
  z.string().regex(rootRelativePathPattern, "Expected URL or root-relative path"),
]);

export const FactSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
});

export const FactsSectionSchema = z.object({
  sectionTitle: z.string().min(1),
  eyebrow: z.string().min(1),
  items: z.array(FactSchema).min(1),
});

export const HeroPaintingSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  year: z.number().int().min(1000).max(2100),
  focal: z.string().min(1),
  zoom: z.number().min(0.5).max(2).optional(),
  orientation: z.enum(["landscape", "portrait"]).optional(),
  sourcing: z.literal("verify").optional(),
  missing: z.boolean().optional(),
});

export const HeroPaintingsSchema = z.object({
  items: z.array(HeroPaintingSchema).min(1),
});

export const CreditsLinkSchema = z.object({
  type: z.enum(["website", "github", "x"]),
  url: z.string().url(),
});

export const CreditsSchema = z.object({
  name: z.string().min(1),
  blurb: z.string().min(1),
  image: z.string().min(1),
  links: z.array(CreditsLinkSchema).min(1),
});

export const HomeContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
  }),
  about: z.object({
    paragraphs: z.array(z.string().min(1)),
  }),
  credits: CreditsSchema,
});

export const WorkExperienceKindSchema = z.enum([
  "education",
  "self-taught",
  "job",
  "freelance",
]);

export const WorkExperienceLinkSchema = z.object({
  type: z.enum(["instagram", "youtube"]),
  url: z.string().url(),
});

export const WorkExperienceKeyframeTypeSchema = z.enum(["linear", "bezier", "ease"]);

export const WorkExperienceSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).optional(),
  kind: WorkExperienceKindSchema,
  track: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  clipColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color"),
  topBarOpacity: z.number().min(0).max(1),
  keyframeType: WorkExperienceKeyframeTypeSchema,
  role: z.string().min(1),
  readoutTitle: z.string().min(1).optional(),
  company: z.string().min(1),
  periodLabel: z.string().min(1),
  yearStart: z.number().min(1900).max(2100),
  yearEnd: z.number().min(1900).max(2100).nullable(),
  summary: z.string().min(1),
  location: z.string().min(1).optional(),
  links: z.array(WorkExperienceLinkSchema),
  keyframes: z.array(z.number().min(0).max(1)),
  published: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

// Milestones are point-in-time markers (the M1 lane), not date-range
// clips — a distinct shape from WorkExperienceSchema rather than a
// variant of it. Their links carry a readable label ("watch the
// interview") since the milestone readout renders them as text, not the
// icon-only links row the clip readout uses.
export const WorkMilestoneLinkSchema = z.object({
  type: z.enum(["instagram", "youtube"]),
  url: z.string().url(),
  label: z.string().min(1),
});

export const WorkMilestoneSchema = z.object({
  id: z.string().min(1),
  date: z.number().min(1900).max(2100),
  monthLabel: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  links: z.array(WorkMilestoneLinkSchema).default([]),
});

export const WorkExperienceSectionSchema = z.object({
  sectionTitle: z.string().min(1),
  timelineStart: z.number().int().min(1900).max(2100),
  items: z.array(WorkExperienceSchema),
  milestones: z.array(WorkMilestoneSchema).default([]),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1),
  tech: z.array(z.string().min(1)).min(1),
  githubUrl: z.string().url().nullable().optional(),
  liveUrl: z.string().url().nullable().optional(),
  image: z.string().min(1).nullable().optional(),
  featured: z.boolean(),
  published: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  year: z.number().int().min(1900).max(2100),
  role: z.string().min(1),
  status: z.string().min(1),
});

export const ProjectsGroupSchema = z.object({
  sectionTitle: z.string().min(1),
  items: z.array(ProjectSchema),
});

export const ProjectsSectionSchema = z.object({
  sectionTitle: z.string().min(1),
  longForm: ProjectsGroupSchema,
  shortForm: ProjectsGroupSchema,
});

export const TechStackItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  group: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});

export const TechStackSectionSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  items: z.array(TechStackItemSchema).min(1),
});

export const ReachOutActionSchema = z.object({
  label: z.string().min(1),
  href: HrefSchema,
});

export const ReachOutSegmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(ReachOutActionSchema).min(1),
});

export const ReachOutLaneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(ReachOutActionSchema).min(1),
  segments: z.array(ReachOutSegmentSchema).optional(),
  options: z.array(ReachOutActionSchema).optional(),
});

export const ReachOutSectionSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  lanes: z.array(ReachOutLaneSchema).min(1),
});

export const NavigationItemSchema = z.object({
  key: z.enum(["about", "projects"]),
  label: z.string().min(1),
  href: z.string().min(1),
  visible: z.boolean(),
});

export const SocialLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});
