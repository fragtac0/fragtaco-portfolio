import { describe, expect, it } from "vitest";
import type { WorkVideo } from "../types";
import { coverUrl, youtubeId } from "./work-media";

const video = (over: Partial<WorkVideo>): WorkVideo => ({
  id: "ft-long-01",
  title: "Placeholder long 01",
  for: "Placeholder",
  year: 2026,
  url: "https://www.youtube.com/@fragtaco",
  source: "other",
  ...over,
});

describe("youtubeId", () => {
  it("reads a youtu.be link", () => {
    expect(youtubeId("https://youtu.be/GrtKxfATyTw")).toBe("GrtKxfATyTw");
  });

  it("reads a watch link with other parameters", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=GrtKxfATyTw&t=3")).toBe("GrtKxfATyTw");
  });

  it("reads a shorts link", () => {
    expect(youtubeId("https://www.youtube.com/shorts/GrtKxfATyTw")).toBe("GrtKxfATyTw");
  });

  it("returns null for other hosts, channel pages and bad ids", () => {
    expect(youtubeId("https://www.instagram.com/reel/GrtKxfATyTw/")).toBeNull();
    expect(youtubeId("https://www.youtube.com/@fragtaco")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
  });
});

describe("coverUrl", () => {
  it("prefers the cover in the file", () => {
    expect(coverUrl(video({ cover: "/work/a.jpg" }), false)).toBe("/work/a.jpg");
  });

  it("builds the YouTube thumbnail when there is no cover", () => {
    const v = video({ source: "youtube", url: "https://youtu.be/GrtKxfATyTw" });

    expect(coverUrl(v, false)).toBe("https://i.ytimg.com/vi/GrtKxfATyTw/hqdefault.jpg");
    expect(coverUrl(v, true)).toBe("https://i.ytimg.com/vi/GrtKxfATyTw/oar2.jpg");
  });

  it("falls back to a seeded picsum picture for other sources", () => {
    expect(coverUrl(video({ id: "ft-x" }), false)).toBe("https://picsum.photos/seed/ft-x/640/360");
    expect(coverUrl(video({ id: "ft-x" }), true)).toBe("https://picsum.photos/seed/ft-x/360/640");
  });

  it("falls back to picsum for a YouTube item whose url has no id", () => {
    expect(coverUrl(video({ source: "youtube", id: "ft-y" }), false)).toBe(
      "https://picsum.photos/seed/ft-y/640/360",
    );
  });
});
