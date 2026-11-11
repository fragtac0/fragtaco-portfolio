import type { SiteVideo } from "../app/types";

export interface PlaylistEntry {
  id: string;
  title: string;
  channel: string;
  channelUrl: string;
}

export interface ParsedPlaylist {
  videos: PlaylistEntry[];
  /** Ids of video lockups that lacked a title, channel or channel link. */
  skipped: string[];
}

export interface VideoDiff {
  added: number;
  removed: number;
  changed: number;
}

const VIDEO_LOCKUP = "LOCKUP_CONTENT_TYPE_VIDEO";
const YOUTUBE_ORIGIN = "https://www.youtube.com";

/** Walks `path` through objects and arrays; yields undefined at any gap. */
const at = (value: unknown, ...path: Array<string | number>): unknown => {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

export const extractInitialData = (html: string): unknown => {
  const match = /var ytInitialData = (\{.*?\});<\/script>/s.exec(html);
  if (!match?.[1]) throw new Error("ytInitialData not found");
  return JSON.parse(match[1]) as unknown;
};

export const parsePlaylist = (data: unknown): ParsedPlaylist => {
  const contents = at(
    data,
    "contents",
    "twoColumnBrowseResultsRenderer",
    "tabs",
    0,
    "tabRenderer",
    "content",
    "sectionListRenderer",
    "contents",
    0,
    "itemSectionRenderer",
    "contents",
  );
  if (!Array.isArray(contents)) {
    throw new Error("Playlist items not found in ytInitialData");
  }

  const videos: PlaylistEntry[] = [];
  const skipped: string[] = [];
  for (const item of contents as unknown[]) {
    const lockup = at(item, "lockupViewModel");
    if (at(lockup, "contentType") !== VIDEO_LOCKUP) continue;

    const text = at(
      lockup,
      "metadata",
      "lockupMetadataViewModel",
      "metadata",
      "contentMetadataViewModel",
      "metadataRows",
      0,
      "metadataParts",
      0,
      "text",
    );
    const id = asString(at(lockup, "contentId"));
    const title = asString(
      at(lockup, "metadata", "lockupMetadataViewModel", "title", "content"),
    );
    const channel = asString(at(text, "content"))?.trim();
    const basePath = asString(
      at(
        text,
        "commandRuns",
        0,
        "onTap",
        "innertubeCommand",
        "browseEndpoint",
        "canonicalBaseUrl",
      ),
    );
    if (!id || !title || !channel || !basePath) {
      skipped.push(id ?? "unknown id");
      continue;
    }
    videos.push({ id, title, channel, channelUrl: `${YOUTUBE_ORIGIN}${basePath}` });
  }
  return { videos, skipped };
};

/** True when the page carries a continuation token: the playlist has more than one page. */
export const hasContinuation = (value: unknown): boolean => {
  if (value === null || typeof value !== "object") return false;
  if ("continuationItemRenderer" in value) return true;
  return Object.values(value).some(hasContinuation);
};

export const parseSubscribers = (channelHtml: string): string | null => {
  const headerAt = channelHtml.indexOf('"pageHeaderViewModel"');
  if (headerAt === -1) return null;
  const match = /"content":"([\d.,]+[KMB]?) subscribers?"/.exec(
    channelHtml.slice(headerAt),
  );
  return match?.[1] ?? null;
};

const FIELDS = ["id", "title", "channel", "channelUrl", "subscribers", "thumb"] as const;

const sameVideo = (a: SiteVideo, b: SiteVideo): boolean =>
  FIELDS.every((field) => a[field] === b[field]);

export const diffVideos = (prev: SiteVideo[], next: SiteVideo[]): VideoDiff => {
  const before = new Map(prev.map((v) => [v.id, v]));
  const after = new Map(next.map((v) => [v.id, v]));
  let added = 0;
  let changed = 0;
  for (const [id, video] of after) {
    const old = before.get(id);
    if (!old) added += 1;
    else if (!sameVideo(old, video)) changed += 1;
  }
  let removed = 0;
  for (const id of before.keys()) if (!after.has(id)) removed += 1;
  return { added, removed, changed };
};

/** A parsed count wins; a page with no parseable count keeps the previous one. */
export const mergeSubscribers = (
  parsed: string | null,
  previous: string | null | undefined,
): string | null => parsed ?? previous ?? null;

/** 200 means a 640 px thumbnail exists; 404 means it does not; anything else is not an answer. */
export const thumbFromStatus = (
  status: number | null,
  previous: "sd" | "hq" | undefined,
): "sd" | "hq" => {
  if (status === 200) return "sd";
  if (status === 404) return "hq";
  return previous ?? "sd";
};

export const noCountMessage = (
  url: string,
  previous: string | null | undefined,
): string =>
  previous
    ? `no subscriber count at ${url}, keeping the previous count`
    : `no count found at ${url}, and there is no previous count`;

export const channelFailedMessage = (
  url: string,
  previous: string | null | undefined,
  error: unknown,
): string =>
  `channel fetch failed for ${url}, ${previous ? "keeping the previous count" : "and there is no previous count"} (${String(error)})`;

export const thumbFailedMessage = (
  id: string,
  previous: "sd" | "hq" | undefined,
  error: unknown,
): string =>
  `thumbnail check failed for ${id}, ${previous ? `keeping the previous value (${previous})` : "no previous value, using sd"} (${String(error)})`;

export const retryMessage = (error: unknown, delayMs: number): string =>
  `playlist fetch failed (${String(error)}), retrying in ${delayMs / 1000} s`;

/** Runs `worker` over `items`, at most `limit` at a time, keeping order. */
export const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
};

/** Tries `task`, and once more after `delayMs` if it fails; the second error is thrown. */
export const withRetry = async <T>(
  task: () => Promise<T>,
  delayMs: number,
  onRetry: (error: unknown) => void = () => undefined,
): Promise<T> => {
  try {
    return await task();
  } catch (error) {
    onRetry(error);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return task();
  }
};
