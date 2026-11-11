import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SiteVideo } from "../app/types";
import {
  diffVideos,
  extractInitialData,
  hasContinuation,
  mapLimit,
  mergeSubscribers,
  noCountMessage,
  parsePlaylist,
  parseSubscribers,
  thumbFromStatus,
  withRetry,
} from "./youtube";

const readFixture = (name: string): string =>
  readFileSync(path.join(process.cwd(), "scripts", "fixtures", name), "utf8");

const video = (id: string, title: string): SiteVideo => ({
  id,
  title,
  channel: "c",
  channelUrl: "https://www.youtube.com/@c",
  subscribers: "1K",
  thumb: "sd",
});

describe("parsePlaylist", () => {
  const playlist: unknown = JSON.parse(readFixture("playlist.json"));

  it("returns only the video lockups that have all their fields", () => {
    expect(parsePlaylist(playlist).videos).toHaveLength(3);
  });

  it("skips a video lockup without a title and reports its id", () => {
    expect(parsePlaylist(playlist).skipped).toEqual(["untitledVid1"]);
  });

  it("reads id, title, channel and channel url", () => {
    expect(parsePlaylist(playlist).videos[0]).toEqual({
      id: "GrtKxfATyTw",
      title: "Every Type of Mimicry Explained",
      channel: "daninblue",
      channelUrl: "https://www.youtube.com/@daninblue",
    });
  });

  it("throws when the page has no playlist lockups", () => {
    expect(() => parsePlaylist({})).toThrow();
  });
});

describe("parseSubscribers", () => {
  it("reads the page header count, not a featured channel's", () => {
    expect(parseSubscribers(readFixture("channel-header.html"))).toBe("158K");
  });

  it("returns null when there is no count", () => {
    expect(parseSubscribers("<html></html>")).toBeNull();
  });
});

describe("extractInitialData", () => {
  it("parses the embedded object", () => {
    const html = 'x<script>var ytInitialData = {"a":{"b":1}};</script>y';
    expect(extractInitialData(html)).toEqual({ a: { b: 1 } });
  });

  it("throws when it is missing", () => {
    expect(() => extractInitialData("<html>")).toThrow("ytInitialData not found");
  });
});

describe("diffVideos", () => {
  it("counts added, removed and changed videos", () => {
    const prev = [
      video("aaaaaaaaaaa", "kept"),
      video("bbbbbbbbbbb", "old title"),
      video("ccccccccccc", "gone"),
    ];
    const next = [
      video("aaaaaaaaaaa", "kept"),
      video("bbbbbbbbbbb", "new title"),
      video("ddddddddddd", "fresh"),
    ];
    expect(diffVideos(prev, next)).toEqual({ added: 1, removed: 1, changed: 1 });
  });
});

describe("mergeSubscribers", () => {
  it("uses the parsed count when there is one", () => {
    expect(mergeSubscribers("158K", "100K")).toBe("158K");
  });

  it("keeps the previous count when the page had none", () => {
    expect(mergeSubscribers(null, "100K")).toBe("100K");
  });

  it("gives null when the page had none and there is no previous count", () => {
    expect(mergeSubscribers(null, undefined)).toBeNull();
    expect(mergeSubscribers(null, null)).toBeNull();
  });
});

describe("hasContinuation", () => {
  it("is false for a single page", () => {
    expect(hasContinuation(JSON.parse(readFixture("playlist.json")))).toBe(false);
  });

  it("finds a continuationItemRenderer anywhere in the page", () => {
    const data = { a: [{ b: { continuationItemRenderer: { token: "x" } } }] };
    expect(hasContinuation(data)).toBe(true);
  });
});

describe("diffVideos field by field", () => {
  const base = video("aaaaaaaaaaa", "t");
  const changedBy = (patch: Partial<SiteVideo>) =>
    diffVideos([base], [{ ...base, ...patch }]).changed;

  it("is not fooled by key order", () => {
    const reordered: SiteVideo = {
      thumb: base.thumb,
      subscribers: base.subscribers,
      channelUrl: base.channelUrl,
      channel: base.channel,
      title: base.title,
      id: base.id,
    };
    expect(diffVideos([base], [reordered]).changed).toBe(0);
  });

  it("sees a change in each field", () => {
    expect(changedBy({ title: "x" })).toBe(1);
    expect(changedBy({ channel: "x" })).toBe(1);
    expect(changedBy({ channelUrl: "https://www.youtube.com/@x" })).toBe(1);
    expect(changedBy({ subscribers: "2K" })).toBe(1);
    expect(changedBy({ thumb: "hq" })).toBe(1);
  });
});

describe("thumbFromStatus", () => {
  it("gives sd for 200 and hq for 404", () => {
    expect(thumbFromStatus(200, "hq")).toBe("sd");
    expect(thumbFromStatus(404, "sd")).toBe("hq");
  });

  it("keeps the previous value for any other status", () => {
    expect(thumbFromStatus(500, "hq")).toBe("hq");
    expect(thumbFromStatus(429, "sd")).toBe("sd");
    expect(thumbFromStatus(null, "hq")).toBe("hq");
  });

  it("falls back to sd when there is no previous value", () => {
    expect(thumbFromStatus(503, undefined)).toBe("sd");
    expect(thumbFromStatus(null, undefined)).toBe("sd");
  });
});

describe("mapLimit", () => {
  it("never runs more than the limit at once and keeps input order", async () => {
    let running = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    const results = await mapLimit(items, 4, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, (12 - n) % 5));
      running -= 1;
      return n * 2;
    });
    expect(peak).toBe(4);
    expect(results).toEqual(items.map((n) => n * 2));
  });

  it("handles an empty list", async () => {
    expect(await mapLimit([], 4, (n: number) => Promise.resolve(n))).toEqual([]);
  });
});

describe("withRetry", () => {
  it("returns the first success without a retry", async () => {
    const task = vi.fn(() => Promise.resolve("ok"));
    expect(await withRetry(task, 0)).toBe("ok");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("retries once after a failure", async () => {
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    expect(await withRetry(task, 0)).toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("throws the second error and tries only twice", async () => {
    const task = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("down"));
    await expect(withRetry(task, 0)).rejects.toThrow("down");
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe("noCountMessage", () => {
  it("says it keeps the previous count when there is one", () => {
    expect(noCountMessage("https://x", "100K")).toContain("keeping the previous count");
  });

  it("says no count was found when there is no previous count", () => {
    const message = noCountMessage("https://x", undefined);
    expect(message).toContain("no count found");
    expect(message).not.toContain("keeping the previous count");
  });
});

describe("mergeSubscribers header without a count", () => {
  it("keeps the previous count when the header has none", () => {
    const html = '<script>"pageHeaderViewModel":{"x":"no number here"}</script>';
    expect(mergeSubscribers(parseSubscribers(html), "100K")).toBe("100K");
  });
});
