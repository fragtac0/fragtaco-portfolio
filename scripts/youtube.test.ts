import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SiteVideo } from "../app/types";
import {
  diffVideos,
  channelFailedMessage,
  mapLimit,
  mergeSubscribers,
  noCountMessage,
  parseSubscribers,
  retryMessage,
  thumbFailedMessage,
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

describe("parseSubscribers", () => {
  it("reads the page header count, not a featured channel's", () => {
    expect(parseSubscribers(readFixture("channel-header.html"))).toBe("158K");
  });

  it("returns null when there is no count", () => {
    expect(parseSubscribers("<html></html>")).toBeNull();
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

  it("reports the first error before retrying", async () => {
    const onRetry = vi.fn();
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await withRetry(task, 0, onRetry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(String(onRetry.mock.calls[0]?.[0])).toContain("boom");
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

describe("failure messages", () => {
  it("channel fetch failure only claims to keep a count that exists", () => {
    expect(channelFailedMessage("u", "1K", "e")).toContain("keeping the previous count");
    const none = channelFailedMessage("u", undefined, "e");
    expect(none).toContain("no previous count");
    expect(none).not.toContain("keeping");
  });

  it("thumbnail failure only claims to keep a value that exists", () => {
    expect(thumbFailedMessage("id", "hq", "e")).toContain("keeping the previous value (hq)");
    const none = thumbFailedMessage("id", undefined, "e");
    expect(none).toContain("using sd");
    expect(none).not.toContain("keeping");
  });

  it("retry message names the delay in seconds", () => {
    expect(retryMessage("boom", 2000)).toBe("playlist fetch failed (boom), retrying in 2 s");
  });
});
