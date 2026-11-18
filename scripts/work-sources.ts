import type { WorkVideo } from "../app/types";

/** What yt-dlp tells us about one video, reduced to the fields the work page needs. */
export interface ResolvedVideo {
  id: string;
  title: string;
  channel: string;
  /** Length in seconds, or null when YouTube did not say. */
  seconds: number | null;
  /** Four-digit year of the upload, or null. */
  year: number | null;
}

/** A listed source: one video by id, or every long form upload of a channel by handle. */
export type WorkSource = { kind: "video"; id: string } | { kind: "channel"; handle: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HANDLE = /^[A-Za-z0-9._-]{3,30}$/;

/**
 * The sources of the long form list, one per line: a video id, or `@handle` for a channel. Blank lines and
 * `#` comments are skipped. A line that is neither is an error, so a typo is not silently dropped.
 */
export function parseSources(text: string): WorkSource[] {
  const out: WorkSource[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    if (line === "") continue;
    if (line.startsWith("@") && HANDLE.test(line.slice(1))) out.push({ kind: "channel", handle: line.slice(1) });
    else if (VIDEO_ID.test(line)) out.push({ kind: "video", id: line });
    else throw new Error(`Not a video id or a channel handle: ${line}`);
  }
  return out;
}

/** The address of a channel's long form uploads. The Shorts have their own tab, which is never read. */
export const channelVideosUrl = (handle: string): string => `https://www.youtube.com/@${handle}/videos`;

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

const parseLine = (line: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const isShortsUrl = (record: Record<string, unknown>): boolean =>
  [record.url, record.webpage_url].some((value) => typeof value === "string" && value.includes("/shorts/"));

/**
 * The ids of a channel listing printed one JSON object per line (`yt-dlp --flat-playlist --print`),
 * in the channel's order, leaving out anything addressed as a Short and any line that is not a video.
 */
export function idsFromListing(output: string): string[] {
  const ids: string[] = [];
  for (const line of output.split("\n")) {
    const record = parseLine(line);
    if (record === null || typeof record.id !== "string" || !VIDEO_ID.test(record.id) || isShortsUrl(record)) continue;
    ids.push(record.id);
  }
  return ids;
}

/** One printed video record (`id`, `title`, `channel`, `duration`, `upload_date`), or null when it lacks an id or a title. */
export function parseVideoRecord(line: string): ResolvedVideo | null {
  const record = parseLine(line);
  if (record === null) return null;
  const { id, title, channel, duration, upload_date: uploaded } = record;
  if (typeof id !== "string" || !VIDEO_ID.test(id) || typeof title !== "string" || title.trim() === "") return null;

  const year = typeof uploaded === "string" && /^\d{8}$/.test(uploaded) ? Number(uploaded.slice(0, 4)) : null;
  return {
    id,
    title: title.trim(),
    channel: typeof channel === "string" && channel.trim() !== "" ? channel.trim() : "YouTube",
    seconds: typeof duration === "number" && Number.isFinite(duration) ? duration : null,
    year,
  };
}

/** Every list in the order given, each id once: the first place an id appears wins. */
export function uniqueById<T extends { id: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of lists.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** The site writes no em or en dash in copy: a spaced one becomes a comma, an unspaced one a hyphen. */
export function plainDashes(text: string): string {
  return text.replace(/\s+[–—]\s+/g, ", ").replace(/[–—]/g, "-");
}

/** The `work.json` entry for a resolved video. `year` falls back to the year given when YouTube gave none. */
export function toWorkVideo(video: ResolvedVideo, fallbackYear: number): WorkVideo {
  return {
    id: `yt-${video.id}`,
    title: plainDashes(video.title),
    for: plainDashes(video.channel),
    year: video.year ?? fallbackYear,
    url: watchUrl(video.id),
    source: "youtube",
  };
}
