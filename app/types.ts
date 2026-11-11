export type HomeSectionId = "about";
export type NavigationKey = "home" | "work";

export interface SiteHeroContent {
  name: string;
  roles: string;
}

export interface SiteHeroPainting {
  id: string;
  file: string;
  title: string;
  artist: string;
  year: number;
  focal: string;
  zoom?: number;
  orientation?: "landscape" | "portrait";
  sourcing?: "verify";
  missing?: boolean;
  /**
   * `data:image/jpeg;base64,...` of a 24 px wide copy; shown while the painting loads. The home
   * response leaves it empty for every painting but the first (the only one shown up front).
   */
  blur: string;
}

export interface SiteCreditsLink {
  type: "website" | "github" | "x";
  url: string;
}

export interface SiteCreditsFact {
  label: string;
  value: string;
}

export interface SiteCredits {
  name: string;
  role: string;
  blurb: string;
  note: string;
  image: string;
  facts: SiteCreditsFact[];
  links: SiteCreditsLink[];
}

export type BookStyle = "plain" | "band" | "block";

export interface SiteBook {
  id: string;
  title: string;
  author: string;
  pages: number;
  isbn: string;
  heightIn: number;
  aspect: number;
  spine: string;
  style: BookStyle;
  note: string;
}

export interface SiteVideo {
  id: string;
  title: string;
  channel: string;
  channelUrl: string;
  subscribers: string | null;
  thumb: "sd" | "hq";
}

export interface SiteVideosFile {
  playlistId: string;
  syncedAt: string;
  items: SiteVideo[];
}

export interface SiteHomeContent {
  hero: SiteHeroContent;
  about: {
    title: string;
    who: string[];
    paragraphs: string[];
  };
  credits: SiteCredits;
}

export interface ReachOutAction {
  label: string;
  href: string;
}

export interface ReachOutSegment {
  title: string;
  description: string;
  actions: ReachOutAction[];
}

export interface ReachOutLane {
  id: string;
  label: string;
  title: string;
  description: string;
  actions: ReachOutAction[];
  segments?: ReachOutSegment[];
  options?: ReachOutAction[];
}

export interface SiteReachOutSection {
  eyebrow: string;
  title: string;
  description: string;
  lanes: ReachOutLane[];
}

export interface SiteNavigationItem {
  key: NavigationKey;
  label: string;
  href: string;
  visible: boolean;
}

export interface SiteSocialLink {
  label: string;
  url: string;
}

export type WorkSource = "youtube" | "instagram" | "vimeo" | "other";

export interface WorkVideo {
  id: string;
  title: string;
  for: string;
  year: number;
  url: string;
  cover?: string;
  source: WorkSource;
}

export interface WorkClient {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  url: string;
  socials: { type: "youtube" | "instagram" | "x" | "website"; url: string }[];
}

export interface WorkStackItem {
  id: string;
  mark: string;
  label: string;
}

export interface SiteWork {
  intro: { title: string; text: string };
  stack: WorkStackItem[];
  longForm: WorkVideo[];
  shortForm: WorkVideo[];
  clients: WorkClient[];
}

export interface TimelineRole {
  id: string;
  label: string;
  from: string;
  color: string;
}

export interface TimelineMark {
  date: string;
  label: string;
}

export interface SiteTimeline {
  start: string;
  roles: TimelineRole[];
  marks: TimelineMark[];
}
