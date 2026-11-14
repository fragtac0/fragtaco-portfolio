import type { MOMENT_ICONS } from "./content/experience-schema";

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
  /** The ground colour of the book: the spine before the cover's own colours arrive, the placeholder bar and the plain grid. */
  color: string;
  /** A picture of the real spine, a path served from `public/` (for example `/books/story-spine.webp`). Optional. */
  spine?: string;
  style: BookStyle;
  /** The spine design this book wears (a key of the series, spine-series.ts); defaults to its own id. */
  series?: string;
  note: string;
}

export interface SiteVideo {
  id: string;
  title: string;
  channel: string;
  channelUrl: string;
  subscribers: string | null;
  thumb: "sd" | "hq";
  /** The day it was published (YYYY-MM-DD), shown under a chosen video when the sync has it. */
  published?: string | null;
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
  /** The app's own icon, a file under /stack/. With none, the two-letter mark is shown. */
  icon?: string;
}

export interface SiteWork {
  intro: { title: string; text: string };
  stack: WorkStackItem[];
  longForm: WorkVideo[];
  shortForm: WorkVideo[];
  clients: WorkClient[];
}

/** The icon of a milestone's bead on the map (Phosphor, fill weight; the nine names are `MOMENT_ICONS`, spec 9.3). */
export type ExperienceIcon = (typeof MOMENT_ICONS)[number];

export interface ExperienceMoment {
  id: string;
  /** `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or `now` (the last moment only). */
  date: string;
  /** The date as shown. */
  label: string;
  title: string;
  /** The part of the title shown struck through. */
  struck?: string;
  line: string;
  /** The icon on the milestone's bead. */
  icon: ExperienceIcon;
}

export interface ExperiencePlace {
  id: string;
  name: string;
  lon: number;
  lat: number;
  line: string;
  sources: string[];
  /** Where the name sits, in screen pixels from the feature. */
  label?: { dx: number; dy: number };
  /** The label sits on the cliff trace at this bearing from the summit (degrees clockwise from east). */
  cliffBearing?: number;
}

export interface ExperienceFact {
  id: string;
  text: string;
  source: string;
}

export interface SiteExperience {
  frame: { centre: { lon: number; lat: number }; spanDeg: number };
  /** `description` is the one quiet line under the title. */
  heading: { title: string; description: string };
  moments: ExperienceMoment[];
  /** The words of the map's controls: the Overview and My climb switch, and the "of" in a card's "3 of 9". */
  ui: { overview: string; climb: string; of: string };
  caption: { title: string; line: string; /** The fact shown with the caption (its height and width). */ factId: string; credit: string };
  /** Hand-placed points of the route, in order (Task 19 places them on the picture). */
  route: { lon: number; lat: number }[];
  /** The cliff round the mountain (Olympus Rupes), traced by the Gazetteer as a closed ring. */
  cliff: { source: string; points: { lon: number; lat: number }[] };
  /** The summit craters' outer extent in degrees (Olympus Paterae). */
  rim: { north: number; south: number; east: number; west: number; source: string };
  places: ExperiencePlace[];
  facts: ExperienceFact[];
}
