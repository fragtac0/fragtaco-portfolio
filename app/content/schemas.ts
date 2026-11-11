import { z } from "zod";
import { youtubeId } from "./work-media";

const rootRelativePathPattern = /^\/(?!\/).+/;

const HrefSchema = z.union([
  z.string().url(),
  z.string().regex(rootRelativePathPattern, "Expected URL or root-relative path"),
]);

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
  // 24 px JPEG shown while the painting loads; written by scripts/make-paintings.mjs
  blur: z.string().startsWith("data:image/").max(2499).optional(),
}).refine((painting) => painting.missing === true || painting.blur !== undefined, {
  message: "blur is required on a painting that is not missing (run yarn paintings)",
  path: ["blur"],
});

export const HeroPaintingsSchema = z.object({
  items: z.array(HeroPaintingSchema).min(1),
});

export const CreditsLinkSchema = z.object({
  type: z.enum(["website", "github", "x"]),
  url: z.string().url(),
});

export const CreditsFactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const CreditsSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  blurb: z.string().min(1),
  note: z.string().min(1),
  image: z.string().min(1),
  facts: z.array(CreditsFactSchema).min(1),
  links: z.array(CreditsLinkSchema).min(1),
});

export const HomeContentSchema = z.object({
  hero: z.object({
    name: z.string().min(1),
    roles: z.string().min(1),
  }),
  about: z.object({
    title: z.string().min(1),
    who: z.array(z.string().min(1)).min(1),
    paragraphs: z.array(z.string().min(1)),
  }),
  credits: CreditsSchema,
});

export const BookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  pages: z.number().int().positive(),
  isbn: z.string().regex(/^\d{13}$/, "Expected a 13-digit ISBN"),
  heightIn: z.number().min(4).max(16),
  aspect: z.number().min(0.4).max(1.2),
  spine: z.string().regex(/^#[0-9a-f]{6}$/i, "Expected a 6-digit hex color"),
  style: z.enum(["plain", "band", "block"]),
  note: z.string().min(1),
});

export const BooksSectionSchema = z.object({
  items: z.array(BookSchema).min(1),
});

export const VideoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Expected an 11-character video id"),
  title: z.string().min(1),
  channel: z.string().min(1),
  channelUrl: z.string().url(),
  subscribers: z
    .string()
    .regex(/^[\d.,]+[KMB]?$/, "Expected a subscriber count like 158K")
    .nullable(),
  thumb: z.enum(["sd", "hq"]),
});

export const VideosFileSchema = z.object({
  playlistId: z.string().min(1),
  syncedAt: z.string().min(1),
  items: z.array(VideoSchema),
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
  key: z.enum(["home", "work"]),
  label: z.string().min(1),
  href: z.string().min(1),
  visible: z.boolean(),
});

export const SocialLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

// Work page (content/site/work.json). A cover or avatar is a path under public/ or a full https URL.
const ImageRefSchema = z.union([
  z.string().url().startsWith("https://"),
  z.string().regex(rootRelativePathPattern, "Expected an https URL or a root-relative path"),
]);

const HttpsUrlSchema = z.string().url().startsWith("https://");

export const WorkSourceSchema = z.enum(["youtube", "instagram", "vimeo", "other"]);

export const WorkStackItemSchema = z.object({
  id: z.string().min(1),
  mark: z.string().min(1).max(3),
  label: z.string().min(1),
  // The app's own icon, a file in public/stack/. Optional: with none, the two-letter mark is shown.
  icon: z
    .string()
    .regex(/^\/stack\/[A-Za-z0-9._-]+\.(svg|png)$/, "Expected a path under /stack/ ending in .svg or .png")
    .optional(),
});

export const WorkVideoSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    for: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    url: HttpsUrlSchema,
    cover: ImageRefSchema.optional(),
    source: WorkSourceSchema,
  })
  .refine((video) => video.source !== "youtube" || video.cover !== undefined || youtubeId(video.url) !== null, {
    message: "A YouTube item without a cover needs a URL that holds an 11-character video id",
    path: ["url"],
  });

export const WorkClientSocialSchema = z.object({
  type: z.enum(["youtube", "instagram", "x", "website"]),
  url: HttpsUrlSchema,
});

export const WorkClientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  avatar: ImageRefSchema,
  url: HttpsUrlSchema,
  socials: z.array(WorkClientSocialSchema),
});

const hasUniqueIds = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;
const uniqueIds = { message: "Ids must be unique within the list" };

export const WorkSchema = z.object({
  intro: z.object({
    title: z.string().min(1),
    text: z
      .string()
      .min(1)
      .refine((text) => text.trim().split(/\s+/).length <= 20, "The intro text has at most 20 words"),
  }),
  stack: z.array(WorkStackItemSchema).refine(hasUniqueIds, uniqueIds),
  longForm: z.array(WorkVideoSchema).refine(hasUniqueIds, uniqueIds),
  shortForm: z.array(WorkVideoSchema).refine(hasUniqueIds, uniqueIds),
  clients: z.array(WorkClientSchema).refine(hasUniqueIds, uniqueIds),
});

// Timeline page (content/site/timeline.json). Dates are real ISO days; each role runs until the next starts.
const isRealIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const IsoDateSchema = z.string().refine(isRealIsoDate, "Expected a real date as YYYY-MM-DD");

export const TimelineRoleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  from: IsoDateSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a colour as #rrggbb"),
});

export const TimelineMarkSchema = z.object({
  date: IsoDateSchema,
  label: z.string().min(1),
});

// ISO dates compare correctly as strings.
export const TimelineSchema = z
  .object({
    start: IsoDateSchema,
    roles: z.array(TimelineRoleSchema).min(1).refine(hasUniqueIds, uniqueIds),
    marks: z.array(TimelineMarkSchema),
  })
  .superRefine((timeline, ctx) => {
    if (timeline.roles.length > 0 && timeline.roles[0].from !== timeline.start) {
      ctx.addIssue({ code: "custom", path: ["roles", 0, "from"], message: "The first role starts on the start date" });
    }
    timeline.roles.forEach((role, i) => {
      if (i > 0 && role.from <= timeline.roles[i - 1].from) {
        ctx.addIssue({ code: "custom", path: ["roles", i, "from"], message: "Roles must be in strictly ascending date order" });
      }
    });
    timeline.marks.forEach((mark, i) => {
      if (mark.date < timeline.start) {
        ctx.addIssue({ code: "custom", path: ["marks", i, "date"], message: "A mark cannot be before the start date" });
      }
    });
  });
