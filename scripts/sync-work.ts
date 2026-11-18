import { readFileSync } from "node:fs";
import path from "node:path";
import { WorkSchema } from "../app/content/schemas";
import { writeFileAtomic } from "./sync-helpers";
import { FIELDS, runYtDlp } from "./ytdlp";
import { mapLimit } from "./youtube";
import {
  channelVideosUrl,
  idsFromListing,
  parseSources,
  parseVideoRecord,
  toWorkVideo,
  uniqueById,
  watchUrl,
  type ResolvedVideo,
} from "./work-sources";

// Rewrites the long form list of content/site/work.json from scripts/work-sources.txt, asking yt-dlp (no
// account, no cookies, no configuration file, its own generic user agent) for each channel's uploads and each
// video's title, channel and length. Short form, the stack and the clients are left as they are. If any listed
// video or channel cannot be resolved nothing is written.

const SOURCES = path.join(process.cwd(), "scripts", "work-sources.txt");
const OUTPUT = path.join(process.cwd(), "content", "site", "work.json");
const CONCURRENCY = 4;

const resolveVideo = async (id: string): Promise<ResolvedVideo> => {
  const line = (await runYtDlp(["--no-playlist", "--print", FIELDS, watchUrl(id)])).trim().split("\n")[0] ?? "";
  const video = parseVideoRecord(line);
  if (video === null) throw new Error(`Could not read ${id}`);
  return video;
};

const resolveChannel = async (handle: string): Promise<string[]> => {
  const ids = idsFromListing(await runYtDlp(["--flat-playlist", "--print", FIELDS, channelVideosUrl(handle)]));
  if (ids.length === 0) throw new Error(`@${handle} lists no long form videos`);
  return ids;
};

const main = async (): Promise<void> => {
  const sources = parseSources(readFileSync(SOURCES, "utf8"));
  const listed = await mapLimit(sources, CONCURRENCY, async (source) =>
    source.kind === "video" ? [source.id] : resolveChannel(source.handle),
  );
  const ids = uniqueById(...listed.map((group) => group.map((id) => ({ id })))).map((entry) => entry.id);
  console.log(`${ids.length} long form videos listed (${listed.flat().length} before removing duplicates)`);

  const videos = await mapLimit(ids, CONCURRENCY, resolveVideo);
  const year = new Date().getFullYear();
  const longForm = videos.map((video) => toWorkVideo(video, year));

  const current: unknown = JSON.parse(readFileSync(OUTPUT, "utf8"));
  const work = WorkSchema.parse({ ...(current as object), longForm });
  writeFileAtomic(OUTPUT, `${JSON.stringify(work, null, 2)}\n`);

  console.log(`Wrote ${longForm.length} long form items to content/site/work.json:`);
  for (const video of videos) console.log(`  ${video.id}  ${video.seconds ?? "?"}s  ${video.channel}  ${video.title}`);
};

main().catch((error: unknown) => {
  console.error(`Sync failed, work.json left untouched: ${String(error)}`);
  process.exit(1);
});
