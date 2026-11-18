import { placeholderArt } from "../../content/placeholder-art";
import { isMissingCover } from "../../content/work-media";

/** The larger thumbnail the rings ask for on a sharp screen, and the one they fall back to where a video has none. */
const SD = "/sddefault.jpg";
const HQ = "/hqdefault.jpg";

/**
 * A video's picture in the page (a ring item, a wall link): it fades in once it has loaded (the tile shows its dark body or
 * its art until then, never a hole), and a picture that cannot be used (no network, or a removed video, which YouTube
 * answers with a small grey picture that does load: `isMissingCover`) is swapped for the local placeholder art, once; a
 * `sddefault` that is missing (not every video has one) is tried again as `hqdefault` first (as `wall-thumbs.ts` does).
 * Read from the picture's own state, since it may have settled before the page was hydrated. Call it from a ref and from
 * `onLoad` and `onError`.
 */
export function shapeCover(img: HTMLImageElement | null, id: string, tall: boolean): void {
  if (!img || !img.complete) return;
  if (!isMissingCover(img.currentSrc || img.src, img.naturalWidth)) {
    img.dataset.ready = "";
  } else if (img.src.includes(SD) && !("hq" in img.dataset)) {
    img.dataset.hq = "";
    img.src = img.src.replace(SD, HQ);
  } else if (!("fallback" in img.dataset)) {
    img.dataset.fallback = "";
    img.src = placeholderArt(id, tall);
  }
}
