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

/** The width of the grey "no thumbnail" picture that i.ytimg.com answers a removed or private video with (HTTP 404 and an image body). */
const YOUTUBE_MISSING_WIDTH = 120;

/**
 * True when a picture that loaded is not a usable cover: YouTube's grey placeholder for a missing video (its thumbnail
 * host, a natural width of 120 or less; every real thumbnail is wider), or a picture with no size at all. The page then
 * swaps it for the local art.
 */
export function isMissingCover(src: string, naturalWidth: number): boolean {
  if (naturalWidth <= 0) return true;
  try {
    return new URL(src).hostname === "i.ytimg.com" && naturalWidth <= YOUTUBE_MISSING_WIDTH;
  } catch {
    return false;
  }
}

/** The picture width in pixels of YouTube's `hqdefault` (480 by 360, the 16 by 9 picture 480 wide): a tile wider than this on the screen's pixels wants `sddefault` (640 by 480). */
export const HQ_PICTURE_WIDTH = 480;

/**
 * The picture for a work item: the file's own cover, else the YouTube thumbnail (`tall` for the
 * portrait cut; `sharp` asks for the larger `sddefault` of a landscape one, for a tile wider than `hqdefault` is at the
 * screen's pixels, and the page falls back to `hqdefault` where a video has none, `cover-image.ts`), else local placeholder
 * art made from the item's id (9 by 16 when `tall`). No picture is stored, and the placeholder needs no network.
 */
export function coverUrl(video: WorkVideo, tall: boolean, sharp = false): string {
  if (video.cover) return video.cover;

  const id = video.source === "youtube" ? youtubeId(video.url) : null;
  if (id) return `https://i.ytimg.com/vi/${id}/${tall ? "oar2" : sharp ? "sddefault" : "hqdefault"}.jpg`;

  return placeholderArt(video.id, tall);
}
