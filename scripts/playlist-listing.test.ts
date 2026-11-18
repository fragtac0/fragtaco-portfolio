import { describe, expect, it } from "vitest";
import { parseListedVideo, plainDashes, toPlaylistEntry } from "./playlist-listing";

const line = (over: Record<string, unknown>) =>
  JSON.stringify({
    id: "I2O7blSSzpI",
    title: " Cicada 3301 ",
    channel: "LEMMiNO ",
    channel_url: "https://www.youtube.com/channel/UCRcgy6GzDeccI7dkbbBna3Q",
    uploader_url: "https://www.youtube.com/@LEMMiNO",
    ...over,
  });

describe("plainDashes", () => {
  it("reads an en or em dash as a spaced hyphen, and leaves other text alone", () => {
    expect(plainDashes("A Life of Reading \u2013 Gabriela")).toBe("A Life of Reading - Gabriela");
    expect(plainDashes("One\u2014two")).toBe("One - two");
    expect(plainDashes("Spider-Man: Part 2")).toBe("Spider-Man: Part 2");
  });

  it("is applied to the title and the channel of a listed video", () => {
    const v = parseListedVideo(line({ title: "Why \u2014 now", channel: "A \u2013 B" }));
    expect(v?.title).toBe("Why - now");
    expect(v?.channel).toBe("A - B");
  });
});

describe("parseListedVideo", () => {
  it("prefers the @handle page and trims the text", () => {
    expect(parseListedVideo(line({}))).toEqual({
      id: "I2O7blSSzpI",
      title: "Cicada 3301",
      channel: "LEMMiNO",
      channelUrl: "https://www.youtube.com/@LEMMiNO",
    });
  });

  it("falls back to the /channel/ page, then to null", () => {
    expect(parseListedVideo(line({ uploader_url: null }))?.channelUrl).toBe(
      "https://www.youtube.com/channel/UCRcgy6GzDeccI7dkbbBna3Q",
    );
    expect(parseListedVideo(line({ uploader_url: null, channel_url: null }))?.channelUrl).toBeNull();
  });

  it("returns null for a bad id, no title or text that is not JSON", () => {
    expect(parseListedVideo(line({ id: "x" }))).toBeNull();
    expect(parseListedVideo(line({ title: "" }))).toBeNull();
    expect(parseListedVideo("WARNING")).toBeNull();
    expect(parseListedVideo("3")).toBeNull();
  });
});

describe("toPlaylistEntry", () => {
  it("is complete only with a channel name and link", () => {
    const full = { id: "I2O7blSSzpI", title: "T", channel: "C", channelUrl: "https://www.youtube.com/@C" };

    expect(toPlaylistEntry(full)).toEqual(full);
    expect(toPlaylistEntry({ ...full, channelUrl: null })).toBeNull();
    expect(toPlaylistEntry({ ...full, channel: "" })).toBeNull();
  });
});
