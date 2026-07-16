export type HomeSectionId = "about";
export type NavigationKey = HomeSectionId | "projects";

export interface SiteHeroContent {
  title: string;
  subtitle: string;
}

export interface SiteFact {
  id: string;
  category: string;
  headline: string;
  body: string;
}

export interface SiteFactsSection {
  sectionTitle: string;
  eyebrow: string;
  items: SiteFact[];
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
}

export interface SiteCreditsLink {
  type: "website" | "github" | "x";
  url: string;
}

export interface SiteCredits {
  name: string;
  blurb: string;
  image: string;
  links: SiteCreditsLink[];
}

export interface SiteHomeContent {
  hero: SiteHeroContent;
  about: {
    paragraphs: string[];
  };
  credits: SiteCredits;
}

export type WorkExperienceKind = "education" | "self-taught" | "job" | "freelance";
export type WorkExperienceKeyframeType = "linear" | "bezier" | "ease";

export interface WorkExperienceLink {
  type: "instagram" | "youtube";
  url: string;
}

export interface SiteWorkExperience {
  id: string;
  parentId?: string;
  kind: WorkExperienceKind;
  track: 1 | 2 | 3;
  clipColor: string;
  topBarOpacity: number;
  keyframeType: WorkExperienceKeyframeType;
  role: string;
  readoutTitle?: string;
  company: string;
  periodLabel: string;
  yearStart: number;
  yearEnd: number | null;
  summary: string;
  location?: string;
  links: WorkExperienceLink[];
  keyframes: number[];
  published: boolean;
  sortOrder: number;
}

export interface SiteWorkExperienceSection {
  sectionTitle: string;
  timelineStart: number;
  items: SiteWorkExperience[];
}

export interface SiteProject {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  tech: string[];
  githubUrl?: string | null;
  liveUrl?: string | null;
  image?: string | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  year: number;
  role: string;
  status: string;
}

export interface SiteProjectsGroup {
  sectionTitle: string;
  items: SiteProject[];
}

export interface SiteProjectsSection {
  sectionTitle: string;
  longForm: SiteProjectsGroup;
  shortForm: SiteProjectsGroup;
}

export interface SiteTechStackItem {
  id: string;
  label: string;
  group: string;
  sortOrder: number;
}

export interface SiteTechStackSection {
  eyebrow: string;
  title: string;
  description: string;
  items: SiteTechStackItem[];
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

