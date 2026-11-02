import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SiteVideo } from "../app/types";
import {
  diffVideos,
  extractInitialData,
  parsePlaylist,
  parseSubscribers,
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

  it("returns only the video lockups", () => {
    expect(parsePlaylist(playlist)).toHaveLength(3);
  });

  it("reads id, title, channel and channel url", () => {
    expect(parsePlaylist(playlist)[0]).toEqual({
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
