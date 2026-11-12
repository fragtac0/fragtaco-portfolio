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
