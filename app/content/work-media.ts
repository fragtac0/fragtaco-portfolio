import type { WorkVideo } from "../types";
import { placeholderArt } from "./placeholder-art";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The 11-character video id in a YouTube link (youtu.be/ID, watch?v=ID, shorts/ID, embed/ID, live/ID),
 * or null for any other link.
 */
export function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m)\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = parsed.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com") {
    const [, kind, id] = parsed.pathname.split("/");
    candidate = kind === "watch" ? parsed.searchParams.get("v") : kind === "shorts" || kind === "embed" || kind === "live" ? id ?? null : null;
  }

  return candidate !== null && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/**
 * The picture for a work item: the file's own cover, else the YouTube thumbnail (`tall` for the
 * portrait cut), else local placeholder art made from the item's id (9 by 16 when `tall`). No picture is stored,
 * and the placeholder needs no network.
 */
export function coverUrl(video: WorkVideo, tall: boolean): string {
  if (video.cover) return video.cover;

  const id = video.source === "youtube" ? youtubeId(video.url) : null;
  if (id) return `https://i.ytimg.com/vi/${id}/${tall ? "oar2" : "hqdefault"}.jpg`;

  return placeholderArt(video.id, tall);
}
