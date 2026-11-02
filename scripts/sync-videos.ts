import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { VideosFileSchema } from "../app/content/schemas";
import type { SiteVideo } from "../app/types";
import {
  diffVideos,
  extractInitialData,
  parsePlaylist,
  parseSubscribers,
} from "./youtube";

const PLAYLIST_ID = "PLV4vaojDpwnw";
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;
const OUTPUT = path.join(process.cwd(), "content", "site", "videos.json");
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 20_000;
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

/** Runs `worker` over `items`, at most `limit` at a time, keeping order. */
const mapLimit = async <T, R>(
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

const readPrevious = (): SiteVideo[] => {
  if (!existsSync(OUTPUT)) return [];
  const parsed = VideosFileSchema.safeParse(
    JSON.parse(readFileSync(OUTPUT, "utf8")),
  );
  return parsed.success ? parsed.data.items : [];
};

const main = async (): Promise<void> => {
  const previous = readPrevious();
  const previousById = new Map(previous.map((v) => [v.id, v]));
  const previousSubs = new Map(
    previous.map((v) => [v.channelUrl, v.subscribers]),
  );

  const entries = parsePlaylist(extractInitialData(await fetchText(PLAYLIST_URL)));
  if (entries.length === 0) throw new Error("The playlist has no videos");
  console.log(`Playlist: ${entries.length} videos`);

  const channelUrls = [...new Set(entries.map((e) => e.channelUrl))];
  const counts = new Map<string, string | null>();
  await mapLimit(channelUrls, CONCURRENCY, async (url) => {
    try {
      const count = parseSubscribers(await fetchText(url));
      if (count === null) console.warn(`Warning: no subscriber count at ${url}`);
      counts.set(url, count);
    } catch (error) {
      console.warn(
        `Warning: channel fetch failed for ${url}, keeping the previous count (${String(error)})`,
      );
      counts.set(url, previousSubs.get(url) ?? null);
    }
  });

  const thumbs = await mapLimit(entries, CONCURRENCY, async (entry) => {
    try {
      const res = await request(
        `https://i.ytimg.com/vi/${entry.id}/sddefault.jpg`,
        "HEAD",
      );
      return res.status === 200 ? ("sd" as const) : ("hq" as const);
    } catch (error) {
      console.warn(
        `Warning: thumbnail check failed for ${entry.id}, keeping the previous value (${String(error)})`,
      );
      return previousById.get(entry.id)?.thumb ?? ("sd" as const);
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
  writeFileSync(OUTPUT, `${JSON.stringify(file, null, 2)}\n`);

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
