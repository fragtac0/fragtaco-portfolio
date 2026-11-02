import type { SiteVideo } from "../app/types";

export interface PlaylistEntry {
  id: string;
  title: string;
  channel: string;
  channelUrl: string;
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

export const parsePlaylist = (data: unknown): PlaylistEntry[] => {
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

  const entries: PlaylistEntry[] = [];
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
      throw new Error(`Playlist item is missing fields: ${id ?? "unknown id"}`);
    }
    entries.push({ id, title, channel, channelUrl: `${YOUTUBE_ORIGIN}${basePath}` });
  }
  return entries;
};

export const parseSubscribers = (channelHtml: string): string | null => {
  const headerAt = channelHtml.indexOf('"pageHeaderViewModel"');
  if (headerAt === -1) return null;
  const match = /"content":"([\d.,]+[KMB]?) subscribers?"/.exec(
    channelHtml.slice(headerAt),
  );
  return match?.[1] ?? null;
};

export const diffVideos = (prev: SiteVideo[], next: SiteVideo[]): VideoDiff => {
  const before = new Map(prev.map((v) => [v.id, v]));
  const after = new Map(next.map((v) => [v.id, v]));
  let added = 0;
  let changed = 0;
  for (const [id, video] of after) {
    const old = before.get(id);
    if (!old) added += 1;
    else if (JSON.stringify(old) !== JSON.stringify(video)) changed += 1;
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
