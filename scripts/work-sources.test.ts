import { describe, expect, it } from "vitest";
import {
  channelVideosUrl,
  idsFromListing,
  parseSources,
  parseVideoRecord,
  plainDashes,
  toWorkVideo,
  uniqueById,
  watchUrl,
} from "./work-sources";

describe("parseSources", () => {
  it("reads ids and @handles in order, skipping blanks and comments", () => {
    const text = "9hkHhSmcA9s\n\n# a comment\n@AllRiskIsCreative9  # trailing\n-_ovL8w1TMM\n@TheSamderShow\n";

    expect(parseSources(text)).toEqual([
      { kind: "video", id: "9hkHhSmcA9s" },
      { kind: "channel", handle: "AllRiskIsCreative9" },
      { kind: "video", id: "-_ovL8w1TMM" },
      { kind: "channel", handle: "TheSamderShow" },
    ]);
  });

  it("refuses a line that is neither", () => {
    expect(() => parseSources("short")).toThrow(/Not a video id/);
    expect(() => parseSources("@x")).toThrow();
  });
});

describe("addresses", () => {
  it("point at the long form tab and the watch page", () => {
    expect(channelVideosUrl("Abc")).toBe("https://www.youtube.com/@Abc/videos");
    expect(watchUrl("9hkHhSmcA9s")).toBe("https://www.youtube.com/watch?v=9hkHhSmcA9s");
  });
});

describe("idsFromListing", () => {
  it("keeps the channel's order and leaves out Shorts and junk lines", () => {
    const out = [
      JSON.stringify({ id: "aaaaaaaaaaa", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }),
      JSON.stringify({ id: "bbbbbbbbbbb", url: "https://www.youtube.com/shorts/bbbbbbbbbbb" }),
      "WARNING: not json",
      JSON.stringify({ id: "UCqnltx9awILOOP53q80ASJg" }),
      JSON.stringify({ id: "ccccccccccc", webpage_url: "https://www.youtube.com/watch?v=ccccccccccc" }),
    ].join("\n");

    expect(idsFromListing(out)).toEqual(["aaaaaaaaaaa", "ccccccccccc"]);
  });
});

describe("parseVideoRecord", () => {
  const line = (over: Record<string, unknown>) =>
    JSON.stringify({ id: "9hkHhSmcA9s", title: " A title ", channel: "A channel", duration: 1470, upload_date: "20260729", ...over });

  it("reads title, channel, length and upload year", () => {
    expect(parseVideoRecord(line({}))).toEqual({
      id: "9hkHhSmcA9s",
      title: "A title",
      channel: "A channel",
      seconds: 1470,
      year: 2026,
    });
  });

  it("copes with a missing channel, length and date", () => {
    expect(parseVideoRecord(line({ channel: null, duration: null, upload_date: null }))).toMatchObject({
      channel: "YouTube",
      seconds: null,
      year: null,
    });
  });

  it("returns null for a bad id, an empty title or text that is not JSON", () => {
    expect(parseVideoRecord(line({ id: "short" }))).toBeNull();
    expect(parseVideoRecord(line({ title: "  " }))).toBeNull();
    expect(parseVideoRecord("nope")).toBeNull();
  });
});

describe("uniqueById", () => {
  it("keeps the first of each id, in the order given across lists", () => {
    const a = [{ id: "1" }, { id: "2" }];
    const b = [{ id: "2", extra: true }, { id: "3" }, { id: "1" }];

    expect(uniqueById<{ id: string; extra?: boolean }>(a, b)).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
  });
});

describe("plainDashes", () => {
  it("turns a spaced em or en dash into a comma and an unspaced one into a hyphen", () => {
    expect(plainDashes("One — two")).toBe("One, two");
    expect(plainDashes("One – two")).toBe("One, two");
    expect(plainDashes("2020–2024")).toBe("2020-2024");
  });
});

describe("toWorkVideo", () => {
  it("builds a YouTube entry", () => {
    const video = { id: "9hkHhSmcA9s", title: "A — B", channel: "C", seconds: 60, year: null };

    expect(toWorkVideo(video, 2026)).toEqual({
      id: "yt-9hkHhSmcA9s",
      title: "A, B",
      for: "C",
      year: 2026,
      url: "https://www.youtube.com/watch?v=9hkHhSmcA9s",
      source: "youtube",
    });
  });
});
