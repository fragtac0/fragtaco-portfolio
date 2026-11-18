import { describe, expect, it } from "vitest";
import { placeholderArt } from "../../content/placeholder-art";
import { shapeCover } from "./cover-image";

/** A stand-in for a loaded picture: the parts shapeCover reads and writes. */
function picture(src: string, naturalWidth: number) {
  return { src, currentSrc: src, naturalWidth, complete: true, dataset: {} as Record<string, string> } as unknown as HTMLImageElement;
}
const SD = "https://i.ytimg.com/vi/abcdefghijk/sddefault.jpg";
const HQ = "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg";

describe("shapeCover (R54.2b: sddefault with an hqdefault fallback)", () => {
  it("marks a real picture ready and leaves its address alone", () => {
    const img = picture(SD, 640);
    shapeCover(img, "ft-1", false);
    expect(img.dataset).toHaveProperty("ready");
    expect(img.src).toBe(SD);
  });

  it("tries hqdefault when sddefault is missing (YouTube's grey 120 px picture), then the local art if that is missing too", () => {
    const img = picture(SD, 120);
    shapeCover(img, "ft-1", false);
    expect(img.src).toBe(HQ);
    expect(img.dataset).not.toHaveProperty("ready");
    (img as unknown as { naturalWidth: number }).naturalWidth = 120;
    shapeCover(img, "ft-1", false);
    expect(img.src).toBe(placeholderArt("ft-1", false));
  });

  it("goes straight to the art when hqdefault itself is missing, and does nothing before the picture has settled", () => {
    const img = picture(HQ, 120);
    shapeCover(img, "ft-2", true);
    expect(img.src).toBe(placeholderArt("ft-2", true));
    const pending = picture(SD, 0);
    (pending as unknown as { complete: boolean }).complete = false;
    shapeCover(pending, "ft-3", false);
    expect(pending.src).toBe(SD);
  });
});
