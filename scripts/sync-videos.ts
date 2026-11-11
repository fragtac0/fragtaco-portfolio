import path from "node:path";
import { VideosFileSchema } from "../app/content/schemas";
import type { SiteVideo } from "../app/types";
import {
  diffVideos,
  extractInitialData,
  channelFailedMessage,
  hasContinuation,
  mapLimit,
  mergeSubscribers,
  noCountMessage,
  parsePlaylist,
  parseSubscribers,
  retryMessage,
  thumbFailedMessage,
  thumbFromStatus,
  withRetry,
} from "./youtube";
import { readPrevious, writeFileAtomic } from "./sync-helpers";

const PLAYLIST_ID = "PLV4vaojDpwnw";
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;
const OUTPUT = path.join(process.cwd(), "content", "site", "videos.json");
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 2_000;
const HEADERS = {
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

const request = (url: string, method: "GET" | "HEAD" = "GET") =>
  fetch(url, {
    method,
    headers: HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

const fetchText = async (url: string): Promise<string> => {
  const res = await request(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.text();
};

const main = async (): Promise<void> => {
  const previous = readPrevious(OUTPUT);
  const previousById = new Map(previous.map((v) => [v.id, v]));
  const previousSubs = new Map(
    previous.map((v) => [v.channelUrl, v.subscribers]),
  );

  const page = extractInitialData(
    await withRetry(() => fetchText(PLAYLIST_URL), RETRY_DELAY_MS, (error) =>
      console.warn(`Warning: ${retryMessage(error, RETRY_DELAY_MS)}`),
    ),
  );
  if (hasContinuation(page)) {
    console.warn(
      "Warning: playlist longer than one page; only the first page was read",
    );
  }
  const { videos: entries, skipped } = parsePlaylist(page);
  for (const id of skipped) {
    console.warn(`Warning: skipped ${id}, it has no title or channel`);
  }
  if (entries.length === 0) throw new Error("The playlist has no videos");
  console.log(`Playlist: ${entries.length} videos`);

  const channelUrls = [...new Set(entries.map((e) => e.channelUrl))];
  const counts = new Map<string, string | null>();
  await mapLimit(channelUrls, CONCURRENCY, async (url) => {
    try {
      const count = parseSubscribers(await fetchText(url));
      if (count === null) {
        console.warn(`Warning: ${noCountMessage(url, previousSubs.get(url))}`);
      }
      counts.set(url, mergeSubscribers(count, previousSubs.get(url)));
    } catch (error) {
      console.warn(
        `Warning: ${channelFailedMessage(url, previousSubs.get(url), error)}`,
      );
      counts.set(url, previousSubs.get(url) ?? null);
    }
  });

  const thumbs = await mapLimit(entries, CONCURRENCY, async (entry) => {
    const before = previousById.get(entry.id)?.thumb;
    try {
      const res = await request(
        `https://i.ytimg.com/vi/${entry.id}/sddefault.jpg`,
        "HEAD",
      );
      return thumbFromStatus(res.status, before);
    } catch (error) {
      console.warn(
        `Warning: ${thumbFailedMessage(entry.id, before, error)}`,
      );
      return thumbFromStatus(null, before);
    }
  });

  const items: SiteVideo[] = entries.map((entry, index) => ({
    ...entry,
    subscribers: counts.get(entry.channelUrl) ?? null,
    thumb: thumbs[index] ?? "sd",
  }));

  const file = VideosFileSchema.parse({
    playlistId: PLAYLIST_ID,
    syncedAt: new Date().toISOString(),
    items,
  });
  writeFileAtomic(OUTPUT, `${JSON.stringify(file, null, 2)}\n`);

  const diff = diffVideos(previous, items);
  const nulls = items.filter((v) => v.subscribers === null).length;
  const hq = items.filter((v) => v.thumb === "hq").length;
  console.log(
    `Wrote ${items.length} videos to content/site/videos.json: ${diff.added} new, ${diff.removed} removed, ${diff.changed} changed.`,
  );
  console.log(
    `${channelUrls.length} channels, ${nulls} videos without a subscriber count, ${hq} with hq thumbnails.`,
  );
};

main().catch((error: unknown) => {
  console.error(`Sync failed, videos.json left untouched: ${String(error)}`);
  process.exit(1);
});
