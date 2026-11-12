import type { PlaylistEntry } from "./youtube";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** A playlist line read from yt-dlp: the channel link is null when the flat listing did not carry one. */
export interface ListedVideo {
  id: string;
  title: string;
  channel: string;
  channelUrl: string | null;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * One line of `yt-dlp --print` JSON as a playlist entry. The channel link is the channel's `@handle` page
 * when YouTube gives one (what the site has always shown), else its `/channel/` page. Null for a line that is
 * not JSON or has no 11-character id or no title.
 */
export function parseListedVideo(line: string): ListedVideo | null {
  let record: unknown;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  if (record === null || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  const id = text(r.id);
  const title = text(r.title);
  if (id === null || !VIDEO_ID.test(id) || title === null) return null;

  return {
    id,
    title,
    channel: text(r.channel) ?? text(r.uploader) ?? "",
    channelUrl: text(r.uploader_url) ?? text(r.channel_url),
  };
}

/** The listed video as a playlist entry, or null while it still lacks a channel name or link. */
export const toPlaylistEntry = (video: ListedVideo): PlaylistEntry | null =>
  video.channel !== "" && video.channelUrl !== null
    ? { id: video.id, title: video.title, channel: video.channel, channelUrl: video.channelUrl }
    : null;
